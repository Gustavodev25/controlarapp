const express = require('express');
const router = express.Router();
const { getFirebaseAdmin, isFirebaseConfigured } = require('../lib/firebaseAdmin');
const crypto = require('crypto');
const { Buffer } = require('buffer');

const fetch = global.fetch || require('node-fetch');

const PRO_PRODUCT_ID = 'com.gustavodev25.controlarapp.pro.monthly';
const APP_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.gustavodev25.controlarapp';
const PRO_PRICE = 34.90;
const PRO_CURRENCY = 'BRL';
const DAY_MS = 24 * 60 * 60 * 1000;
const APPLE_TRIAL_DAYS = 7;
const APPLE_MONTHLY_FALLBACK_DAYS = 29;
const APPLE_MONTHLY_FALLBACK_MS = APPLE_MONTHLY_FALLBACK_DAYS * DAY_MS;
const APPLE_PRODUCTION_VERIFY_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_VERIFY_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const VALID_APPLE_RECEIPT_STATUSES = new Set([0, 21006]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trial', 'trialing']);
const APPLE_PROVIDER_VALUES = new Set(['apple', 'app_store', 'storekit']);
const MANUAL_PROVIDER_VALUES = new Set(['manual', 'admin']);
const APPLE_SERVER_API_PRODUCTION_URL = process.env.APPLE_SERVER_API_PRODUCTION_URL || 'https://api.storekit.apple.com';
const APPLE_SERVER_API_SANDBOX_URL = process.env.APPLE_SERVER_API_SANDBOX_URL || 'https://api.storekit-sandbox.apple.com';
const APPLE_SERVER_API_REFRESH_THROTTLE_MS = 15 * 60 * 1000;
const APPLE_SERVER_ACTIVE_STATUS_CODES = new Set([1, 4]);
const APPLE_SERVER_STATUS = Object.freeze({
    ACTIVE: 1,
    EXPIRED: 2,
    BILLING_RETRY: 3,
    BILLING_GRACE_PERIOD: 4,
    REVOKED: 5,
});

function parseAppleMillis(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isAppleFreeTrial({ receipt, transactionPayload, purchase } = {}) {
    if (String(receipt?.is_trial_period || '').trim().toLowerCase() === 'true') {
        return true;
    }

    const discountType = String(
        transactionPayload?.offerDiscountType ||
        transactionPayload?.rawOfferDiscountType ||
        purchase?.offerIOS?.paymentMode ||
        purchase?.offerIOS?.paymentModeIOS ||
        purchase?.offerIOS?.rawPaymentMode ||
        ''
    ).trim().toLowerCase().replace(/_/g, '-');

    if (discountType) {
        return discountType === 'free-trial' || discountType === 'freetrial';
    }

    const offerType = String(
        transactionPayload?.offerType ||
        transactionPayload?.rawOfferType ||
        purchase?.offerIOS?.type ||
        purchase?.offerIOS?.offerType ||
        ''
    ).trim().toLowerCase();
    const offerIdentifier = String(
        transactionPayload?.offerIdentifier ||
        purchase?.offerIOS?.id ||
        purchase?.offerIOS?.identifier ||
        ''
    ).trim().toLowerCase();

    return (
        offerType === 'introductory' ||
        offerType === 'introductory-offer' ||
        offerType === '1' ||
        offerIdentifier.includes('trial') ||
        offerIdentifier.includes('free')
    );
}

function dateValueToMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

function resolveMonthlyEntitlementPeriod({
    explicitExpiresMs,
    purchaseMs,
    signedMs,
    nowMs = Date.now(),
    allowFallback = true,
}) {
    const appleExpiresMs = parseAppleMillis(explicitExpiresMs);
    const anchorMs =
        parseAppleMillis(purchaseMs) ||
        parseAppleMillis(signedMs) ||
        nowMs;

    return {
        periodStartMs: anchorMs,
        expiresMs: appleExpiresMs || (allowFallback ? anchorMs + APPLE_MONTHLY_FALLBACK_MS : null),
        usedFallbackExpiration: !appleExpiresMs && allowFallback,
    };
}

function base64UrlDecode(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64');
}

function base64UrlEncode(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function hashValue(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function hashToUuid(hash, version = '5') {
    const chars = String(hash || '').slice(0, 32).padEnd(32, '0').split('');
    chars[12] = version;
    chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
    return [
        chars.slice(0, 8).join(''),
        chars.slice(8, 12).join(''),
        chars.slice(12, 16).join(''),
        chars.slice(16, 20).join(''),
        chars.slice(20, 32).join(''),
    ].join('-');
}

function getExpectedAppleAppAccountToken(firebaseUid) {
    return hashToUuid(hashValue(firebaseUid)).toLowerCase();
}

function normalizeUuid(value) {
    return String(value || '').trim().toLowerCase();
}

function parseJwsPart(value) {
    return JSON.parse(base64UrlDecode(value).toString('utf8'));
}

function normalizePrivateKey(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';

    const withNewlines = rawValue.replace(/\\n/g, '\n');
    if (withNewlines.includes('-----BEGIN')) {
        return withNewlines;
    }

    try {
        const decoded = Buffer.from(withNewlines, 'base64').toString('utf8').trim();
        if (decoded.includes('-----BEGIN')) {
            return decoded.replace(/\\n/g, '\n');
        }
    } catch (e) {
        // Ignore invalid base64 and let createPrivateKey surface the real error.
    }

    return withNewlines;
}

function getAppleServerApiCredentials() {
    const keyId =
        process.env.APPLE_IAP_KEY_ID ||
        process.env.APP_STORE_CONNECT_KEY_ID ||
        process.env.APPLE_KEY_ID;
    const issuerId =
        process.env.APPLE_IAP_ISSUER_ID ||
        process.env.APP_STORE_CONNECT_ISSUER_ID ||
        process.env.APPLE_ISSUER_ID;
    const privateKey =
        process.env.APPLE_IAP_PRIVATE_KEY ||
        process.env.APP_STORE_CONNECT_PRIVATE_KEY ||
        process.env.APPLE_PRIVATE_KEY;

    if (!keyId || !issuerId || !privateKey) {
        return null;
    }

    return {
        keyId,
        issuerId,
        privateKey: normalizePrivateKey(privateKey),
    };
}

function createAppleServerApiToken() {
    const credentials = getAppleServerApiCredentials();
    if (!credentials) return null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = {
        alg: 'ES256',
        kid: credentials.keyId,
        typ: 'JWT',
    };
    const payload = {
        iss: credentials.issuerId,
        iat: nowSeconds,
        exp: nowSeconds + (50 * 60),
        aud: 'appstoreconnect-v1',
        bid: APP_BUNDLE_ID,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signer = crypto.createSign('sha256');
    signer.update(signingInput);
    signer.end();

    const signature = signer.sign({
        key: crypto.createPrivateKey(credentials.privateKey),
        dsaEncoding: 'ieee-p1363',
    });

    return `${signingInput}.${base64UrlEncode(signature)}`;
}

function verifyAppleJwsSignature(jws, header) {
    if (!Array.isArray(header?.x5c) || header.x5c.length === 0) {
        throw new Error('Apple transaction is missing certificate chain');
    }

    const certs = header.x5c.map((cert) => new crypto.X509Certificate(Buffer.from(cert, 'base64')));
    const leafCert = certs[0];
    const now = new Date();

    if (new Date(leafCert.validFrom) > now || new Date(leafCert.validTo) < now) {
        throw new Error('Apple transaction certificate is not valid now');
    }

    if (certs[1] && !leafCert.verify(certs[1].publicKey)) {
        throw new Error('Apple transaction leaf certificate verification failed');
    }

    if (certs[2] && !certs[1].verify(certs[2].publicKey)) {
        throw new Error('Apple transaction intermediate certificate verification failed');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = jws.split('.');
    const verifier = crypto.createVerify('sha256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    const signature = base64UrlDecode(encodedSignature);
    const verified = verifier.verify(
        { key: leafCert.publicKey, dsaEncoding: 'ieee-p1363' },
        signature
    );

    if (!verified) {
        throw new Error('Apple transaction signature verification failed');
    }
}

function decodeAppleSignedJws(jws, label = 'Apple signed data') {
    const parts = String(jws || '').split('.');
    if (parts.length !== 3) {
        throw new Error(`Invalid ${label}`);
    }

    const header = parseJwsPart(parts[0]);
    if (header.alg !== 'ES256') {
        throw new Error(`Unsupported ${label} signature algorithm`);
    }

    verifyAppleJwsSignature(jws, header);
    return parseJwsPart(parts[1]);
}

function decodeAppleTransactionJws(jws) {
    return decodeAppleSignedJws(jws, 'Apple signed transaction');
}

function decodeAppleRenewalInfoJws(jws) {
    if (!jws) return null;
    return decodeAppleSignedJws(jws, 'Apple signed renewal info');
}

function getLatestProReceipt(receipts) {
    return receipts
        .filter((receipt) => receipt?.product_id === PRO_PRODUCT_ID)
        .sort((a, b) => {
            const bExpires = parseAppleMillis(b.expires_date_ms) || 0;
            const aExpires = parseAppleMillis(a.expires_date_ms) || 0;
            if (bExpires !== aExpires) return bExpires - aExpires;

            const bPurchase = parseAppleMillis(b.purchase_date_ms) || 0;
            const aPurchase = parseAppleMillis(a.purchase_date_ms) || 0;
            return bPurchase - aPurchase;
        })[0] || null;
}

function getReceiptTransactions(result) {
    const latestReceipts = Array.isArray(result.latest_receipt_info)
        ? result.latest_receipt_info
        : [];

    if (latestReceipts.length > 0) {
        return latestReceipts;
    }

    return Array.isArray(result.receipt?.in_app) ? result.receipt.in_app : [];
}

function getRenewalInfo(result, receipt) {
    const renewalItems = Array.isArray(result.pending_renewal_info)
        ? result.pending_renewal_info
        : [];

    return renewalItems.find((item) =>
        item?.product_id === PRO_PRODUCT_ID &&
        (!receipt?.original_transaction_id || item.original_transaction_id === receipt.original_transaction_id)
    ) || null;
}

async function validateAppleReceipt(receiptData, useSandbox = false) {
    const response = await fetch(useSandbox ? APPLE_SANDBOX_VERIFY_URL : APPLE_PRODUCTION_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'receipt-data': receiptData,
            'password': process.env.APPLE_SHARED_SECRET,
            'exclude-old-transactions': true,
        }),
    });

    if (!response.ok) {
        throw new Error(`Apple verifyReceipt HTTP ${response.status}`);
    }

    return response.json();
}

function normalizeAppleServerStatus(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function mapAppleServerStatus(statusCode, cancellationMs) {
    if (cancellationMs || statusCode === APPLE_SERVER_STATUS.REVOKED) return 'cancelled';
    if (statusCode === APPLE_SERVER_STATUS.ACTIVE || statusCode === APPLE_SERVER_STATUS.BILLING_GRACE_PERIOD) {
        return 'active';
    }
    if (statusCode === APPLE_SERVER_STATUS.BILLING_RETRY) return 'past_due';
    return 'expired';
}

function getAppleServerAutoRenewStatus(renewalPayload) {
    const autoRenewStatus = renewalPayload?.autoRenewStatus;
    if (autoRenewStatus === 1 || autoRenewStatus === '1') return 'enabled';
    if (autoRenewStatus === 0 || autoRenewStatus === '0') return 'disabled';
    return null;
}

function getAppleOriginalTransactionId(sub) {
    return (
        sub?.originalTransactionId ||
        sub?.appleOriginalTransactionId ||
        sub?.original_transaction_id ||
        sub?.transactionId ||
        sub?.appleTransactionId ||
        null
    );
}

function getAppleServerApiEnvironmentCandidates(preferredEnvironment) {
    const configuredEnvironment = String(
        process.env.APPLE_SERVER_API_ENVIRONMENT ||
        process.env.APPLE_IAP_ENVIRONMENT ||
        preferredEnvironment ||
        'production'
    ).trim().toLowerCase();

    if (configuredEnvironment === 'auto') return ['production', 'sandbox'];
    if (configuredEnvironment === 'sandbox') return ['sandbox'];
    return ['production'];
}

function getAppleServerApiBaseUrl(environment) {
    return environment === 'sandbox'
        ? APPLE_SERVER_API_SANDBOX_URL
        : APPLE_SERVER_API_PRODUCTION_URL;
}

async function fetchAppleServerSubscriptionStatuses(anyTransactionId, preferredEnvironment) {
    const token = createAppleServerApiToken();
    if (!token) {
        throw new Error('Apple App Store Server API credentials are not configured');
    }

    let lastError = null;
    const environments = getAppleServerApiEnvironmentCandidates(preferredEnvironment);

    for (const environment of environments) {
        const baseUrl = getAppleServerApiBaseUrl(environment).replace(/\/+$/, '');
        const url = `${baseUrl}/inApps/v1/subscriptions/${encodeURIComponent(anyTransactionId)}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });

            const responseText = await response.text();
            const responseBody = responseText ? JSON.parse(responseText) : {};

            if (response.ok) {
                return { responseBody, environment };
            }

            lastError = new Error(
                `Apple subscription status ${response.status}: ${JSON.stringify(responseBody).slice(0, 240)}`
            );
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Apple subscription status request failed');
}

function getLatestProServerApiTransaction(statusResponse) {
    const groups = Array.isArray(statusResponse?.data) ? statusResponse.data : [];
    const candidates = [];

    for (const group of groups) {
        const lastTransactions = Array.isArray(group?.lastTransactions) ? group.lastTransactions : [];

        for (const item of lastTransactions) {
            try {
                if (!item?.signedTransactionInfo) continue;

                const transactionPayload = decodeAppleTransactionJws(item.signedTransactionInfo);
                const renewalPayload = decodeAppleRenewalInfoJws(item.signedRenewalInfo);
                const productId =
                    transactionPayload?.productId ||
                    renewalPayload?.autoRenewProductId ||
                    renewalPayload?.productId ||
                    null;

                if (productId !== PRO_PRODUCT_ID) continue;

                const statusCode = normalizeAppleServerStatus(item.status || group.status);
                const expiresMs = parseAppleMillis(transactionPayload.expiresDate);
                const purchaseMs = parseAppleMillis(transactionPayload.purchaseDate);
                const signedMs = parseAppleMillis(transactionPayload.signedDate);
                const priority = statusCode === APPLE_SERVER_STATUS.ACTIVE
                    ? 5
                    : statusCode === APPLE_SERVER_STATUS.BILLING_GRACE_PERIOD
                        ? 4
                        : statusCode === APPLE_SERVER_STATUS.BILLING_RETRY
                            ? 3
                            : statusCode === APPLE_SERVER_STATUS.EXPIRED
                                ? 2
                                : 1;

                candidates.push({
                    item,
                    transactionPayload,
                    renewalPayload,
                    statusCode,
                    priority,
                    sortMs: expiresMs || purchaseMs || signedMs || 0,
                });
            } catch (error) {
                console.warn('[Apple IAP] Ignoring invalid App Store Server API transaction:', error.message);
            }
        }
    }

    return candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.sortMs - a.sortMs;
    })[0] || null;
}

function mirrorSubscriptionField(update, field, value) {
    if (value === undefined) return;
    update.subscription = update.subscription || {};
    update.profile = update.profile || {};
    update.profile.subscription = update.profile.subscription || {};
    update.subscription[field] = value;
    update.profile.subscription[field] = value;
}

function mirrorPaymentField(update, field, value) {
    if (value === undefined) return;
    update.paymentMethod = update.paymentMethod || {};
    update.profile = update.profile || {};
    update.profile.paymentMethod = update.profile.paymentMethod || {};
    update.paymentMethod[field] = value;
    update.profile.paymentMethod[field] = value;
}

function normalizeSubscriptionStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'canceled') return 'cancelled';
    if (normalized === 'trial_expired' || normalized === 'trial-expired') return 'expired';
    return normalized || 'inactive';
}

function serializeDateValue(value) {
    const millis = dateValueToMillis(value);
    return millis ? new Date(millis).toISOString() : null;
}

function resolveProvider(sub) {
    return String(sub?.provider || sub?.paymentProvider || sub?.iapSource || '')
        .trim()
        .toLowerCase();
}

function buildStatusSnapshot(sub) {
    if (!sub) {
        return {
            hasPro: false,
            plan: 'free',
            status: 'inactive',
            provider: null,
            expiresAt: null,
            cancelAtPeriodEnd: false,
            subscription: null,
        };
    }

    const now = Date.now();
    const plan = String(sub.plan || '').trim().toLowerCase() || 'free';
    const provider = resolveProvider(sub);
    const isApple = APPLE_PROVIDER_VALUES.has(provider);
    const isManual = MANUAL_PROVIDER_VALUES.has(provider);
    const expiresMs = dateValueToMillis(sub.expiresAt || sub.renewalDate || sub.nextBillingDate);
    const isPaidPlan = plan === 'pro' || plan === 'premium';
    const expiresByDate = isApple || isManual;
    const expiredByDate = expiresByDate && isPaidPlan && !!expiresMs && expiresMs <= now;
    let status = normalizeSubscriptionStatus(sub.status);

    if (expiredByDate && ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
        status = 'expired';
    }

    const hasPro =
        isPaidPlan &&
        ACTIVE_SUBSCRIPTION_STATUSES.has(status) &&
        (!expiresByDate || !expiresMs || expiresMs > now);

    const cancelAtPeriodEnd =
        sub.cancelAtPeriodEnd === true ||
        String(sub.autoRenewStatus || '').trim().toLowerCase() === 'disabled';

    const subscription = {
        plan,
        status,
        provider: sub.provider || (isApple ? 'apple' : provider || null),
        paymentProvider: sub.paymentProvider || null,
        iapSource: sub.iapSource || null,
        productId: sub.productId || (isApple ? PRO_PRODUCT_ID : null),
        billingCycle: sub.billingCycle || (isApple ? 'monthly' : null),
        price: typeof sub.price === 'number' ? sub.price : (isApple ? PRO_PRICE : null),
        currency: sub.currency || (isApple ? PRO_CURRENCY : null),
        expiresAt: expiresMs ? new Date(expiresMs).toISOString() : null,
        nextBillingDate: serializeDateValue(sub.nextBillingDate),
        renewalDate: serializeDateValue(sub.renewalDate),
        startedAt: serializeDateValue(sub.startedAt || sub.startDate || sub.createdAt),
        cancelledAt: serializeDateValue(sub.cancelledAt || sub.cancellationDate),
        cancelAtPeriodEnd,
        autoRenewStatus: sub.autoRenewStatus || null,
        transactionId: sub.transactionId || sub.appleTransactionId || null,
        originalTransactionId: sub.originalTransactionId || sub.appleOriginalTransactionId || null,
        updatedAt: serializeDateValue(sub.updatedAt || sub.lastUpdatedAt),
    };

    return {
        hasPro,
        plan,
        status,
        provider: provider || null,
        expiresAt: subscription.expiresAt,
        cancelAtPeriodEnd,
        autoRenewStatus: subscription.autoRenewStatus,
        subscription,
    };
}

async function verifyFirebaseUser(req, expectedUid) {
    const authorization = String(req.headers.authorization || '');
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!idToken) {
        const error = new Error('Missing Firebase authorization token');
        error.statusCode = 401;
        throw error;
    }

    const admin = getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded?.uid || decoded.uid !== expectedUid) {
        const error = new Error('Firebase user does not match subscription account');
        error.statusCode = 403;
        throw error;
    }

    return decoded;
}

function assertAppleAppAccountTokenMatches(firebaseUid, transactionPayload, purchase = {}) {
    const appAccountToken = normalizeUuid(transactionPayload?.appAccountToken || purchase?.appAccountToken);
    if (!appAccountToken) return false;

    const expectedAppAccountToken = getExpectedAppleAppAccountToken(firebaseUid);
    if (appAccountToken !== expectedAppAccountToken) {
        throw new Error('Apple transaction account token does not match the signed-in user');
    }

    return true;
}

async function bindAppleTransactionToUser({ admin, firebaseUid, originalTransactionId, transactionId }) {
    if (!originalTransactionId) {
        throw new Error('Apple purchase is missing original transaction id');
    }

    const db = admin.firestore();
    const originalTransactionIdHash = hashValue(originalTransactionId);
    const mappingRef = db.collection('appleStorePurchases').doc(originalTransactionIdHash);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(mappingRef);
        const existingUid = existing.exists ? existing.data()?.firebaseUid : null;

        if (existingUid && existingUid !== firebaseUid) {
            throw new Error('Apple purchase is already linked to another account');
        }

        const mappingData = {
            firebaseUid,
            originalTransactionId,
            productId: PRO_PRODUCT_ID,
            updatedAt: serverTimestamp,
        };

        if (transactionId) {
            mappingData.latestTransactionId = transactionId;
        }

        transaction.set(mappingRef, mappingData, { merge: true });
    });

    return originalTransactionIdHash;
}

async function getFirebaseUidForAppleTransaction({ admin, originalTransactionId }) {
    if (!originalTransactionId) return null;

    const db = admin.firestore();
    const originalTransactionIdHash = hashValue(originalTransactionId);
    const mappingRef = db.collection('appleStorePurchases').doc(originalTransactionIdHash);
    const mappingDoc = await mappingRef.get();

    return mappingDoc.exists ? mappingDoc.data()?.firebaseUid || null : null;
}

function inferAppleNotificationStatusCode(notificationPayload, transactionPayload) {
    const explicitStatus = normalizeAppleServerStatus(notificationPayload?.data?.status);
    if (explicitStatus) return explicitStatus;

    const notificationType = String(notificationPayload?.notificationType || '').trim().toUpperCase();
    const subtype = String(notificationPayload?.subtype || '').trim().toUpperCase();

    if (transactionPayload?.revocationDate) return APPLE_SERVER_STATUS.REVOKED;
    if (notificationType === 'EXPIRED') return APPLE_SERVER_STATUS.EXPIRED;
    if (notificationType === 'REFUND' || notificationType === 'REVOKE') return APPLE_SERVER_STATUS.REVOKED;
    if (notificationType === 'DID_FAIL_TO_RENEW') return APPLE_SERVER_STATUS.BILLING_RETRY;
    if (notificationType === 'GRACE_PERIOD_EXPIRED') return APPLE_SERVER_STATUS.EXPIRED;
    if (notificationType === 'DID_RENEW' || notificationType === 'SUBSCRIBED') return APPLE_SERVER_STATUS.ACTIVE;
    if (notificationType === 'DID_CHANGE_RENEWAL_STATUS' && subtype === 'AUTO_RENEW_DISABLED') {
        return transactionPayload?.expiresDate && parseAppleMillis(transactionPayload.expiresDate) > Date.now()
            ? APPLE_SERVER_STATUS.ACTIVE
            : APPLE_SERVER_STATUS.EXPIRED;
    }

    return transactionPayload?.expiresDate && parseAppleMillis(transactionPayload.expiresDate) > Date.now()
        ? APPLE_SERVER_STATUS.ACTIVE
        : APPLE_SERVER_STATUS.EXPIRED;
}

async function persistComputedAppleStatus({ admin, userRef, sub, snapshot }) {
    const provider = resolveProvider(sub);
    if (!sub || (!APPLE_PROVIDER_VALUES.has(provider) && !MANUAL_PROVIDER_VALUES.has(provider))) return false;

    const currentStatus = normalizeSubscriptionStatus(sub.status);
    if (currentStatus === snapshot.status) return false;

    const update = {};
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    mirrorSubscriptionField(update, 'status', snapshot.status);
    mirrorSubscriptionField(update, 'updatedAt', serverTimestamp);

    await userRef.set(update, { merge: true });
    return true;
}

async function persistAppleSubscription({ firebaseUid, result, latestReceipt, renewalInfo, requestBody }) {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const deleteField = admin.firestore.FieldValue.delete();
    const userRef = db.collection('users').doc(firebaseUid);

    const now = Date.now();
    const purchaseMs = parseAppleMillis(latestReceipt.purchase_date_ms);
    const startedMs =
        parseAppleMillis(latestReceipt.original_purchase_date_ms) ||
        purchaseMs ||
        now;
    const cancellationMs = parseAppleMillis(latestReceipt.cancellation_date_ms);
    const entitlementPeriod = resolveMonthlyEntitlementPeriod({
        explicitExpiresMs: latestReceipt.expires_date_ms,
        purchaseMs,
        signedMs: startedMs,
        nowMs: now,
        allowFallback: result.status !== 21006,
    });
    const expiresMs = entitlementPeriod.expiresMs;
    const hasPro = expiresMs > now && !cancellationMs;
    const autoRenewStatus = renewalInfo?.auto_renew_status == null
        ? null
        : renewalInfo.auto_renew_status === '1' ? 'enabled' : 'disabled';
    const transactionId = requestBody.transactionId || latestReceipt.transaction_id || null;
    const originalTransactionId =
        requestBody.originalTransactionId ||
        latestReceipt.original_transaction_id ||
        null;
    const originalTransactionIdHash = await bindAppleTransactionToUser({
        admin,
        firebaseUid,
        originalTransactionId,
        transactionId,
    });
    const trialEndsMs = isAppleFreeTrial({ receipt: latestReceipt }) && purchaseMs
        ? purchaseMs + APPLE_TRIAL_DAYS * DAY_MS
        : null;
    const isTrialing = hasPro && trialEndsMs && trialEndsMs > now;

    const status = hasPro
        ? isTrialing ? 'trialing' : 'active'
        : cancellationMs
            ? 'cancelled'
            : 'expired';

    const update = {};
    mirrorSubscriptionField(update, 'plan', 'pro');
    mirrorSubscriptionField(update, 'status', status);
    mirrorSubscriptionField(update, 'provider', 'apple');
    mirrorSubscriptionField(update, 'paymentProvider', 'apple');
    mirrorSubscriptionField(update, 'iapSource', 'app_store');
    mirrorSubscriptionField(update, 'productId', PRO_PRODUCT_ID);
    mirrorSubscriptionField(update, 'billingCycle', 'monthly');
    mirrorSubscriptionField(update, 'price', PRO_PRICE);
    mirrorSubscriptionField(update, 'currency', PRO_CURRENCY);
    mirrorSubscriptionField(update, 'updatedAt', serverTimestamp);
    mirrorSubscriptionField(update, 'storeEnvironment', result.environment || null);
    mirrorSubscriptionField(update, 'transactionId', transactionId);
    mirrorSubscriptionField(update, 'originalTransactionId', originalTransactionId);
    mirrorSubscriptionField(update, 'appleOriginalTransactionIdHash', originalTransactionIdHash);
    mirrorSubscriptionField(update, 'appleTransactionId', latestReceipt.transaction_id || null);
    mirrorSubscriptionField(update, 'appleOriginalTransactionId', latestReceipt.original_transaction_id || null);
    mirrorSubscriptionField(update, 'autoRenewStatus', autoRenewStatus);
    mirrorSubscriptionField(update, 'cancelAtPeriodEnd', hasPro && autoRenewStatus === 'disabled');
    mirrorSubscriptionField(update, 'appleExpirationFallbackApplied', entitlementPeriod.usedFallbackExpiration);
    mirrorSubscriptionField(update, 'startedAt', new Date(startedMs));
    if (trialEndsMs) {
        mirrorSubscriptionField(update, 'trialEndsAt', new Date(trialEndsMs));
    } else {
        mirrorSubscriptionField(update, 'trialEndsAt', deleteField);
    }
    if (expiresMs) {
        const expiresAt = new Date(expiresMs);
        mirrorSubscriptionField(update, 'expiresAt', expiresAt);
        mirrorSubscriptionField(update, 'nextBillingDate', expiresAt);
        mirrorSubscriptionField(update, 'renewalDate', expiresAt);
    }
    if (cancellationMs) {
        mirrorSubscriptionField(update, 'cancelledAt', new Date(cancellationMs));
    } else {
        mirrorSubscriptionField(update, 'cancelledAt', deleteField);
    }

    mirrorPaymentField(update, 'type', 'app_store');
    mirrorPaymentField(update, 'brand', 'App Store');
    mirrorPaymentField(update, 'provider', 'apple');
    mirrorPaymentField(update, 'updatedAt', serverTimestamp);

    await userRef.set(update, { merge: true });

    if (hasPro && transactionId) {
        await userRef.collection('payments').doc(`apple_${transactionId}`).set({
            id: `apple_${transactionId}`,
            provider: 'apple',
            paymentMethod: { type: 'app_store', brand: 'App Store' },
            productId: PRO_PRODUCT_ID,
            transactionId,
            originalTransactionId,
            amount: PRO_PRICE,
            currency: PRO_CURRENCY,
            status: isTrialing ? 'trialing' : 'paid',
            createdAt: purchaseMs ? new Date(purchaseMs) : serverTimestamp,
            paidAt: purchaseMs ? new Date(purchaseMs) : serverTimestamp,
            expiresAt: expiresMs ? new Date(expiresMs) : null,
            updatedAt: serverTimestamp,
        }, { merge: true });
    }

    return {
        hasPro,
        status,
        expiresMs,
        cancelAtPeriodEnd: hasPro && autoRenewStatus === 'disabled',
        autoRenewStatus,
    };
}

function getStoreKitAutoRenewStatus(purchase) {
    const renewalInfo = purchase?.renewalInfoIOS || {};
    if (typeof renewalInfo.willAutoRenew === 'boolean') {
        return renewalInfo.willAutoRenew ? 'enabled' : 'disabled';
    }

    if (typeof purchase?.isAutoRenewing === 'boolean') {
        return purchase.isAutoRenewing ? 'enabled' : 'disabled';
    }

    return null;
}

async function persistStoreKitSubscription({ firebaseUid, transactionPayload, purchase }) {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const deleteField = admin.firestore.FieldValue.delete();
    const userRef = db.collection('users').doc(firebaseUid);

    const now = Date.now();
    const explicitExpiresMs =
        parseAppleMillis(transactionPayload.expiresDate) ||
        parseAppleMillis(purchase?.expirationDateIOS);
    const purchaseMs =
        parseAppleMillis(transactionPayload.purchaseDate) ||
        parseAppleMillis(purchase?.transactionDate) ||
        now;
    const signedMs = parseAppleMillis(transactionPayload.signedDate);
    const startedMs =
        parseAppleMillis(transactionPayload.originalPurchaseDate) ||
        parseAppleMillis(purchase?.originalTransactionDateIOS) ||
        purchaseMs;
    const cancellationMs =
        parseAppleMillis(transactionPayload.revocationDate) ||
        parseAppleMillis(purchase?.revocationDateIOS);
    const entitlementPeriod = resolveMonthlyEntitlementPeriod({
        explicitExpiresMs,
        purchaseMs,
        signedMs,
        nowMs: now,
    });
    const expiresMs = entitlementPeriod.expiresMs;
    const hasPro = expiresMs > now && !cancellationMs;
    const transactionId =
        transactionPayload.transactionId ||
        purchase?.transactionId ||
        purchase?.id ||
        null;
    const originalTransactionId =
        transactionPayload.originalTransactionId ||
        purchase?.originalTransactionId ||
        purchase?.originalTransactionIdentifierIOS ||
        transactionId ||
        null;
    const originalTransactionIdHash = await bindAppleTransactionToUser({
        admin,
        firebaseUid,
        originalTransactionId,
        transactionId,
    });
    const autoRenewStatus = getStoreKitAutoRenewStatus(purchase);
    const trialEndsMs = isAppleFreeTrial({ transactionPayload, purchase })
        ? purchaseMs + APPLE_TRIAL_DAYS * DAY_MS
        : null;
    const isTrialing = hasPro && trialEndsMs && trialEndsMs > now;

    const status = hasPro
        ? isTrialing ? 'trialing' : 'active'
        : cancellationMs
            ? 'cancelled'
            : 'expired';

    const update = {};
    mirrorSubscriptionField(update, 'plan', 'pro');
    mirrorSubscriptionField(update, 'status', status);
    mirrorSubscriptionField(update, 'provider', 'apple');
    mirrorSubscriptionField(update, 'paymentProvider', 'apple');
    mirrorSubscriptionField(update, 'iapSource', 'app_store');
    mirrorSubscriptionField(update, 'productId', PRO_PRODUCT_ID);
    mirrorSubscriptionField(update, 'billingCycle', 'monthly');
    mirrorSubscriptionField(update, 'price', PRO_PRICE);
    mirrorSubscriptionField(update, 'currency', PRO_CURRENCY);
    mirrorSubscriptionField(update, 'updatedAt', serverTimestamp);
    mirrorSubscriptionField(update, 'storeEnvironment', transactionPayload.environment || purchase?.environmentIOS || null);
    mirrorSubscriptionField(update, 'transactionId', transactionId);
    mirrorSubscriptionField(update, 'originalTransactionId', originalTransactionId);
    mirrorSubscriptionField(update, 'appleOriginalTransactionIdHash', originalTransactionIdHash);
    mirrorSubscriptionField(update, 'appleTransactionId', transactionId);
    mirrorSubscriptionField(update, 'appleOriginalTransactionId', originalTransactionId);
    mirrorSubscriptionField(update, 'appAccountToken', transactionPayload.appAccountToken || purchase?.appAccountToken || null);
    mirrorSubscriptionField(update, 'storeKitVerified', true);
    mirrorSubscriptionField(update, 'appleExpirationFallbackApplied', entitlementPeriod.usedFallbackExpiration);
    if (autoRenewStatus) {
        mirrorSubscriptionField(update, 'autoRenewStatus', autoRenewStatus);
    }
    mirrorSubscriptionField(update, 'cancelAtPeriodEnd', hasPro && autoRenewStatus === 'disabled');
    mirrorSubscriptionField(update, 'startedAt', new Date(startedMs));
    if (trialEndsMs) {
        mirrorSubscriptionField(update, 'trialEndsAt', new Date(trialEndsMs));
    } else {
        mirrorSubscriptionField(update, 'trialEndsAt', deleteField);
    }

    if (expiresMs) {
        const expiresAt = new Date(expiresMs);
        mirrorSubscriptionField(update, 'expiresAt', expiresAt);
        mirrorSubscriptionField(update, 'nextBillingDate', expiresAt);
        mirrorSubscriptionField(update, 'renewalDate', expiresAt);
    }

    if (cancellationMs) {
        mirrorSubscriptionField(update, 'cancelledAt', new Date(cancellationMs));
    } else {
        mirrorSubscriptionField(update, 'cancelledAt', deleteField);
    }

    mirrorPaymentField(update, 'type', 'app_store');
    mirrorPaymentField(update, 'brand', 'App Store');
    mirrorPaymentField(update, 'provider', 'apple');
    mirrorPaymentField(update, 'updatedAt', serverTimestamp);

    await userRef.set(update, { merge: true });

    if (hasPro && transactionId) {
        await userRef.collection('payments').doc(`apple_${transactionId}`).set({
            id: `apple_${transactionId}`,
            provider: 'apple',
            paymentMethod: { type: 'app_store', brand: 'App Store' },
            productId: PRO_PRODUCT_ID,
            transactionId,
            originalTransactionId,
            amount: PRO_PRICE,
            currency: PRO_CURRENCY,
            status: isTrialing ? 'trialing' : 'paid',
            createdAt: new Date(purchaseMs),
            paidAt: new Date(purchaseMs),
            expiresAt: expiresMs ? new Date(expiresMs) : null,
            updatedAt: serverTimestamp,
            storeKitVerified: true,
        }, { merge: true });
    }

    return {
        hasPro,
        status,
        expiresMs,
        cancelAtPeriodEnd: hasPro && autoRenewStatus === 'disabled',
        autoRenewStatus,
    };
}

async function persistAppStoreServerSubscription({
    firebaseUid,
    transactionPayload,
    renewalPayload,
    statusCode,
    serverEnvironment,
}) {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const deleteField = admin.firestore.FieldValue.delete();
    const userRef = db.collection('users').doc(firebaseUid);

    const now = Date.now();
    const explicitExpiresMs = parseAppleMillis(transactionPayload.expiresDate);
    const gracePeriodExpiresMs = parseAppleMillis(renewalPayload?.gracePeriodExpiresDate);
    const purchaseMs =
        parseAppleMillis(transactionPayload.purchaseDate) ||
        now;
    const signedMs = parseAppleMillis(transactionPayload.signedDate);
    const startedMs =
        parseAppleMillis(transactionPayload.originalPurchaseDate) ||
        purchaseMs;
    const cancellationMs =
        parseAppleMillis(transactionPayload.revocationDate) ||
        parseAppleMillis(renewalPayload?.revocationDate);
    const entitlementPeriod = resolveMonthlyEntitlementPeriod({
        explicitExpiresMs,
        purchaseMs,
        signedMs,
        nowMs: now,
        allowFallback: APPLE_SERVER_ACTIVE_STATUS_CODES.has(statusCode),
    });

    let expiresMs = entitlementPeriod.expiresMs;
    if (gracePeriodExpiresMs && (!expiresMs || gracePeriodExpiresMs > expiresMs)) {
        expiresMs = gracePeriodExpiresMs;
    }

    const hasPro = APPLE_SERVER_ACTIVE_STATUS_CODES.has(statusCode) && !cancellationMs;
    if (hasPro && (!expiresMs || expiresMs <= now)) {
        expiresMs = now + DAY_MS;
    }

    const autoRenewStatus = getAppleServerAutoRenewStatus(renewalPayload);
    const transactionId = transactionPayload.transactionId || null;
    const originalTransactionId =
        transactionPayload.originalTransactionId ||
        renewalPayload?.originalTransactionId ||
        transactionId ||
        null;
    const originalTransactionIdHash = await bindAppleTransactionToUser({
        admin,
        firebaseUid,
        originalTransactionId,
        transactionId,
    });
    const trialEndsMs = isAppleFreeTrial({ transactionPayload })
        ? purchaseMs + APPLE_TRIAL_DAYS * DAY_MS
        : null;
    const isTrialing = hasPro && trialEndsMs && trialEndsMs > now;
    const status = isTrialing ? 'trialing' : mapAppleServerStatus(statusCode, cancellationMs);

    const update = {};
    mirrorSubscriptionField(update, 'plan', 'pro');
    mirrorSubscriptionField(update, 'status', status);
    mirrorSubscriptionField(update, 'provider', 'apple');
    mirrorSubscriptionField(update, 'paymentProvider', 'apple');
    mirrorSubscriptionField(update, 'iapSource', 'app_store');
    mirrorSubscriptionField(update, 'productId', PRO_PRODUCT_ID);
    mirrorSubscriptionField(update, 'billingCycle', 'monthly');
    mirrorSubscriptionField(update, 'price', PRO_PRICE);
    mirrorSubscriptionField(update, 'currency', PRO_CURRENCY);
    mirrorSubscriptionField(update, 'updatedAt', serverTimestamp);
    mirrorSubscriptionField(update, 'serverStatusCheckedAt', serverTimestamp);
    mirrorSubscriptionField(update, 'serverStatusCode', statusCode);
    mirrorSubscriptionField(update, 'storeEnvironment', transactionPayload.environment || serverEnvironment || null);
    mirrorSubscriptionField(update, 'transactionId', transactionId);
    mirrorSubscriptionField(update, 'originalTransactionId', originalTransactionId);
    mirrorSubscriptionField(update, 'appleOriginalTransactionIdHash', originalTransactionIdHash);
    mirrorSubscriptionField(update, 'appleTransactionId', transactionId);
    mirrorSubscriptionField(update, 'appleOriginalTransactionId', originalTransactionId);
    mirrorSubscriptionField(update, 'appAccountToken', transactionPayload.appAccountToken || null);
    mirrorSubscriptionField(update, 'appStoreServerVerified', true);
    mirrorSubscriptionField(update, 'appleExpirationFallbackApplied', entitlementPeriod.usedFallbackExpiration);
    mirrorSubscriptionField(update, 'appleGracePeriodFallbackApplied', hasPro && !gracePeriodExpiresMs && explicitExpiresMs && explicitExpiresMs <= now);
    if (autoRenewStatus) {
        mirrorSubscriptionField(update, 'autoRenewStatus', autoRenewStatus);
    }
    mirrorSubscriptionField(update, 'cancelAtPeriodEnd', hasPro && autoRenewStatus === 'disabled');
    mirrorSubscriptionField(update, 'startedAt', new Date(startedMs));
    if (trialEndsMs) {
        mirrorSubscriptionField(update, 'trialEndsAt', new Date(trialEndsMs));
    } else {
        mirrorSubscriptionField(update, 'trialEndsAt', deleteField);
    }

    if (expiresMs) {
        const expiresAt = new Date(expiresMs);
        mirrorSubscriptionField(update, 'expiresAt', expiresAt);
        mirrorSubscriptionField(update, 'nextBillingDate', expiresAt);
        mirrorSubscriptionField(update, 'renewalDate', expiresAt);
    }

    if (cancellationMs) {
        mirrorSubscriptionField(update, 'cancelledAt', new Date(cancellationMs));
    } else {
        mirrorSubscriptionField(update, 'cancelledAt', deleteField);
    }

    mirrorPaymentField(update, 'type', 'app_store');
    mirrorPaymentField(update, 'brand', 'App Store');
    mirrorPaymentField(update, 'provider', 'apple');
    mirrorPaymentField(update, 'updatedAt', serverTimestamp);

    await userRef.set(update, { merge: true });

    if (hasPro && transactionId) {
        await userRef.collection('payments').doc(`apple_${transactionId}`).set({
            id: `apple_${transactionId}`,
            provider: 'apple',
            paymentMethod: { type: 'app_store', brand: 'App Store' },
            productId: PRO_PRODUCT_ID,
            transactionId,
            originalTransactionId,
            amount: PRO_PRICE,
            currency: PRO_CURRENCY,
            status: isTrialing ? 'trialing' : 'paid',
            createdAt: new Date(purchaseMs),
            paidAt: new Date(purchaseMs),
            expiresAt: expiresMs ? new Date(expiresMs) : null,
            updatedAt: serverTimestamp,
            appStoreServerVerified: true,
        }, { merge: true });
    }

    return {
        hasPro,
        status,
        expiresMs,
        cancelAtPeriodEnd: hasPro && autoRenewStatus === 'disabled',
        autoRenewStatus,
    };
}

function shouldRefreshAppleSubscriptionFromServerApi(sub, forceRefresh = false) {
    if (!sub || !APPLE_PROVIDER_VALUES.has(resolveProvider(sub))) return false;
    if (!getAppleOriginalTransactionId(sub)) return false;
    if (!getAppleServerApiCredentials()) return false;
    if (forceRefresh) return true;

    const checkedMs = dateValueToMillis(sub.serverStatusCheckedAt || sub.appleServerStatusCheckedAt);
    if (checkedMs && checkedMs > Date.now() - APPLE_SERVER_API_REFRESH_THROTTLE_MS) {
        return false;
    }

    const status = normalizeSubscriptionStatus(sub.status);
    const expiresMs = dateValueToMillis(sub.expiresAt || sub.renewalDate || sub.nextBillingDate);
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(status)) return true;
    if (!expiresMs) return true;
    return expiresMs <= Date.now() + DAY_MS;
}

async function refreshAppleSubscriptionFromServerApi({ firebaseUid, sub, forceRefresh = false }) {
    if (!shouldRefreshAppleSubscriptionFromServerApi(sub, forceRefresh)) {
        return null;
    }

    const originalTransactionId = getAppleOriginalTransactionId(sub);
    const preferredEnvironment = String(sub.storeEnvironment || sub.environment || '').trim().toLowerCase();
    const { responseBody, environment } = await fetchAppleServerSubscriptionStatuses(
        originalTransactionId,
        preferredEnvironment
    );
    const latestTransaction = getLatestProServerApiTransaction(responseBody);

    if (!latestTransaction) {
        return null;
    }

    return persistAppStoreServerSubscription({
        firebaseUid,
        transactionPayload: latestTransaction.transactionPayload,
        renewalPayload: latestTransaction.renewalPayload,
        statusCode: latestTransaction.statusCode,
        serverEnvironment: environment,
    });
}

router.post('/validate-receipt', async (req, res) => {
    const { firebaseUid, receiptData } = req.body;

    if (!firebaseUid || !receiptData) {
        return res.status(400).json({ error: 'Missing firebaseUid or receiptData' });
    }

    if (!process.env.APPLE_SHARED_SECRET) {
        console.error('[Apple IAP] APPLE_SHARED_SECRET not configured');
        return res.status(500).json({ error: 'Apple IAP not configured on server' });
    }
    if (!isFirebaseConfigured()) {
        return res.status(503).json({ error: 'Firebase Admin not configured on server' });
    }

    try {
        await verifyFirebaseUser(req, firebaseUid);
        let result = await validateAppleReceipt(receiptData, false);

        // 21007 = sandbox receipt sent to production. App Review also uses sandbox.
        if (result.status === 21007) {
            result = await validateAppleReceipt(receiptData, true);
        }

        if (!VALID_APPLE_RECEIPT_STATUSES.has(result.status)) {
            console.error('[Apple IAP] Apple returned status:', result.status);
            return res.status(400).json({
                hasPro: false,
                error: `Apple validation failed (status ${result.status})`,
            });
        }

        const latestReceipts = getReceiptTransactions(result);
        const latestReceipt = getLatestProReceipt(latestReceipts);

        if (!latestReceipt) {
            console.warn(`[Apple IAP] No ${PRO_PRODUCT_ID} transaction found for uid=${firebaseUid}`);
            return res.json({ hasPro: false, status: 'not_found' });
        }

        const renewalInfo = getRenewalInfo(result, latestReceipt);
        const persisted = await persistAppleSubscription({
            firebaseUid,
            result,
            latestReceipt,
            renewalInfo,
            requestBody: req.body,
        });

        console.log(`[Apple IAP] validate-receipt: uid=${firebaseUid} hasPro=${persisted.hasPro} status=${persisted.status}`);
        return res.json({
            hasPro: persisted.hasPro,
            status: persisted.status,
            productId: PRO_PRODUCT_ID,
            expiresAt: persisted.expiresMs ? new Date(persisted.expiresMs).toISOString() : null,
            cancelAtPeriodEnd: persisted.cancelAtPeriodEnd,
            autoRenewStatus: persisted.autoRenewStatus,
        });
    } catch (e) {
        console.error('[Apple IAP] validate-receipt error:', e);
        return res.status(e.statusCode || 500).json({ error: e.message });
    }
});

router.post('/sync-storekit-purchase', async (req, res) => {
    const { firebaseUid, signedTransactionInfo, purchase = {} } = req.body || {};

    if (!firebaseUid || !signedTransactionInfo) {
        return res.status(400).json({ error: 'Missing firebaseUid or signedTransactionInfo' });
    }
    if (!isFirebaseConfigured()) {
        return res.status(503).json({ error: 'Firebase Admin not configured on server' });
    }

    try {
        await verifyFirebaseUser(req, firebaseUid);
        const transactionPayload = decodeAppleTransactionJws(signedTransactionInfo);
        const productId = transactionPayload.productId || purchase.productId;
        const bundleId = transactionPayload.bundleId;

        if (bundleId !== APP_BUNDLE_ID) {
            return res.status(400).json({ hasPro: false, error: 'Apple transaction bundle mismatch' });
        }

        if (productId !== PRO_PRODUCT_ID) {
            return res.status(400).json({ hasPro: false, error: 'Apple transaction product mismatch' });
        }
        assertAppleAppAccountTokenMatches(firebaseUid, transactionPayload, purchase);

        const persisted = await persistStoreKitSubscription({
            firebaseUid,
            transactionPayload,
            purchase,
        });

        console.log(`[Apple IAP] sync-storekit-purchase: uid=${firebaseUid} hasPro=${persisted.hasPro} status=${persisted.status}`);
        return res.json({
            hasPro: persisted.hasPro,
            status: persisted.status,
            productId: PRO_PRODUCT_ID,
            expiresAt: persisted.expiresMs ? new Date(persisted.expiresMs).toISOString() : null,
            cancelAtPeriodEnd: persisted.cancelAtPeriodEnd,
            autoRenewStatus: persisted.autoRenewStatus,
        });
    } catch (e) {
        console.error('[Apple IAP] sync-storekit-purchase error:', e);
        return res.status(e.statusCode || 400).json({ hasPro: false, error: e.message });
    }
});

router.post('/notifications', async (req, res) => {
    const { signedPayload } = req.body || {};

    if (!signedPayload) {
        return res.status(400).json({ error: 'Missing signedPayload' });
    }
    if (!isFirebaseConfigured()) {
        return res.status(503).json({ error: 'Firebase Admin not configured on server' });
    }

    try {
        const notificationPayload = decodeAppleSignedJws(signedPayload, 'Apple server notification');
        const notificationType = String(notificationPayload.notificationType || '').trim().toUpperCase();

        if (notificationType === 'TEST') {
            return res.json({ success: true, notificationType: 'TEST' });
        }

        const notificationData = notificationPayload.data || {};
        const signedTransactionInfo = notificationData.signedTransactionInfo;
        if (!signedTransactionInfo) {
            console.log('[Apple IAP] Notification ignored without transaction:', notificationType);
            return res.json({ success: true, ignored: true, reason: 'missing_transaction' });
        }

        const transactionPayload = decodeAppleTransactionJws(signedTransactionInfo);
        const productId = transactionPayload.productId || null;
        if (transactionPayload.bundleId && transactionPayload.bundleId !== APP_BUNDLE_ID) {
            return res.status(400).json({ success: false, error: 'Apple notification bundle mismatch' });
        }
        if (productId !== PRO_PRODUCT_ID) {
            return res.json({ success: true, ignored: true, reason: 'non_pro_product' });
        }

        const originalTransactionId = transactionPayload.originalTransactionId || transactionPayload.transactionId || null;
        const admin = getFirebaseAdmin();
        const firebaseUid = await getFirebaseUidForAppleTransaction({ admin, originalTransactionId });
        if (!firebaseUid) {
            console.warn('[Apple IAP] Notification has no linked Firebase user:', {
                notificationType,
                originalTransactionId,
            });
            return res.json({ success: true, pending: true, reason: 'unlinked_transaction' });
        }

        const renewalPayload = decodeAppleRenewalInfoJws(notificationData.signedRenewalInfo);
        const statusCode = inferAppleNotificationStatusCode(notificationPayload, transactionPayload);
        const persisted = await persistAppStoreServerSubscription({
            firebaseUid,
            transactionPayload,
            renewalPayload,
            statusCode,
            serverEnvironment: notificationData.environment || transactionPayload.environment || null,
        });

        console.log(`[Apple IAP] notification: uid=${firebaseUid} type=${notificationType} hasPro=${persisted.hasPro} status=${persisted.status}`);
        return res.json({
            success: true,
            hasPro: persisted.hasPro,
            status: persisted.status,
            productId: PRO_PRODUCT_ID,
            expiresAt: persisted.expiresMs ? new Date(persisted.expiresMs).toISOString() : null,
            cancelAtPeriodEnd: persisted.cancelAtPeriodEnd,
            autoRenewStatus: persisted.autoRenewStatus,
        });
    } catch (e) {
        console.error('[Apple IAP] notification error:', e);
        return res.status(400).json({ success: false, error: e.message });
    }
});

router.get('/subscription-status', async (req, res) => {
    const { firebaseUid } = req.query;
    if (!firebaseUid) return res.status(400).json({ error: 'Missing firebaseUid' });

    if (!isFirebaseConfigured()) {
        return res.json(buildStatusSnapshot(null));
    }

    try {
        await verifyFirebaseUser(req, firebaseUid);
        const admin = getFirebaseAdmin();
        const db = admin.firestore();
        const userRef = db.collection('users').doc(firebaseUid);
        const doc = await userRef.get();
        if (!doc.exists) {
            return res.json(buildStatusSnapshot(null));
        }

        let data = doc.data() || {};
        let sub = data.subscription || data.profile?.subscription;
        const forceRefresh = req.query.refresh === 'true' || req.query.forceRefresh === 'true';

        try {
            const refreshed = await refreshAppleSubscriptionFromServerApi({
                firebaseUid,
                sub,
                forceRefresh,
            });

            if (refreshed) {
                const refreshedDoc = await userRef.get();
                data = refreshedDoc.data() || {};
                sub = data.subscription || data.profile?.subscription;
            }
        } catch (refreshError) {
            console.error('[Apple IAP] App Store Server API refresh failed:', refreshError.message);
        }

        const snapshot = buildStatusSnapshot(sub);
        await persistComputedAppleStatus({ admin, userRef, sub, snapshot });

        return res.json(snapshot);
    } catch (e) {
        console.error('[Apple IAP] subscription-status error:', e);
        return res.status(e.statusCode || 500).json({ error: e.message });
    }
});

module.exports = router;
module.exports._test = {
    APPLE_TRIAL_DAYS,
    APPLE_MONTHLY_FALLBACK_DAYS,
    APPLE_MONTHLY_FALLBACK_MS,
    isAppleFreeTrial,
    resolveMonthlyEntitlementPeriod,
    mapAppleServerStatus,
    getAppleServerAutoRenewStatus,
    shouldRefreshAppleSubscriptionFromServerApi,
    getExpectedAppleAppAccountToken,
    assertAppleAppAccountTokenMatches,
    inferAppleNotificationStatusCode,
};
