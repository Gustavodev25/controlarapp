const express = require('express');
const router = express.Router();
const { getFirebaseAdmin } = require('../lib/firebaseAdmin');
const { repairAppleSubscriptionForUid } = require('./apple')._admin;

const PRO_PRICE = 34.90;
const PRO_CURRENCY = 'BRL';

function getBearerToken(req) {
    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    return String(req.headers['x-admin-token'] || '').trim();
}

function requireAdminToken(req, res, next) {
    const expectedToken = String(process.env.ADMIN_API_TOKEN || '').trim();
    if (!expectedToken) {
        return res.status(503).json({
            success: false,
            error: 'ADMIN_API_TOKEN is not configured',
        });
    }

    const providedToken = getBearerToken(req);
    if (!providedToken || providedToken !== expectedToken) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
        });
    }

    return next();
}

function parseDateOnlySaoPaulo(value, fieldName) {
    const raw = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw new Error(`${fieldName} must use YYYY-MM-DD`);
    }

    const date = new Date(`${raw}T03:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${fieldName} is invalid`);
    }

    return date;
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

router.post('/users/:uid/grant-pro', requireAdminToken, async (req, res) => {
    const firebaseUid = String(req.params.uid || '').trim();
    if (!firebaseUid) {
        return res.status(400).json({ success: false, error: 'Missing uid' });
    }

    try {
        const admin = getFirebaseAdmin();
        const db = admin.firestore();
        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
        const userRef = db.collection('users').doc(firebaseUid);
        const startedAt = parseDateOnlySaoPaulo(req.body?.startedAt || '2026-05-22', 'startedAt');
        const expiresAt = parseDateOnlySaoPaulo(req.body?.expiresAt || '2026-06-22', 'expiresAt');

        if (expiresAt <= startedAt) {
            return res.status(400).json({
                success: false,
                error: 'expiresAt must be after startedAt',
            });
        }

        const update = {};
        mirrorSubscriptionField(update, 'plan', 'pro');
        mirrorSubscriptionField(update, 'status', 'active');
        mirrorSubscriptionField(update, 'provider', 'manual');
        mirrorSubscriptionField(update, 'paymentProvider', 'manual');
        mirrorSubscriptionField(update, 'iapSource', null);
        mirrorSubscriptionField(update, 'productId', 'manual_pro_monthly');
        mirrorSubscriptionField(update, 'billingCycle', 'monthly');
        mirrorSubscriptionField(update, 'price', PRO_PRICE);
        mirrorSubscriptionField(update, 'currency', PRO_CURRENCY);
        mirrorSubscriptionField(update, 'startedAt', startedAt);
        mirrorSubscriptionField(update, 'expiresAt', expiresAt);
        mirrorSubscriptionField(update, 'nextBillingDate', expiresAt);
        mirrorSubscriptionField(update, 'renewalDate', expiresAt);
        mirrorSubscriptionField(update, 'cancelAtPeriodEnd', false);
        mirrorSubscriptionField(update, 'autoRenewStatus', 'manual');
        mirrorSubscriptionField(update, 'manualGrant', true);
        mirrorSubscriptionField(update, 'manualGrantReason', req.body?.reason || 'admin_grant');
        mirrorSubscriptionField(update, 'updatedAt', serverTimestamp);

        mirrorPaymentField(update, 'type', 'manual');
        mirrorPaymentField(update, 'brand', 'Manual');
        mirrorPaymentField(update, 'provider', 'manual');
        mirrorPaymentField(update, 'updatedAt', serverTimestamp);

        await userRef.set(update, { merge: true });

        await userRef.collection('payments').doc(`manual_pro_${startedAt.toISOString().slice(0, 10)}`).set({
            id: `manual_pro_${startedAt.toISOString().slice(0, 10)}`,
            provider: 'manual',
            paymentMethod: { type: 'manual', brand: 'Manual' },
            productId: 'manual_pro_monthly',
            amount: PRO_PRICE,
            currency: PRO_CURRENCY,
            status: 'paid',
            createdAt: startedAt,
            paidAt: startedAt,
            expiresAt,
            updatedAt: serverTimestamp,
            manualGrant: true,
            reason: req.body?.reason || 'admin_grant',
        }, { merge: true });

        return res.json({
            success: true,
            firebaseUid,
            subscription: {
                plan: 'pro',
                status: 'active',
                provider: 'manual',
                startedAt: startedAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                nextBillingDate: expiresAt.toISOString(),
                renewalDate: expiresAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('[Admin] grant-pro error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

router.post('/users/:uid/repair-apple-subscription', requireAdminToken, async (req, res) => {
    const firebaseUid = String(req.params.uid || '').trim();
    if (!firebaseUid) {
        return res.status(400).json({ success: false, error: 'Missing uid' });
    }

    const body = req.body || {};
    const apply = body.apply === true || String(req.query.apply || '').trim().toLowerCase() === 'true';

    try {
        const result = await repairAppleSubscriptionForUid({
            firebaseUid,
            receiptData: body.receiptData,
            signedTransactionInfo: body.signedTransactionInfo,
            purchase: body.purchase || {},
            transactionId: body.transactionId,
            originalTransactionId: body.originalTransactionId,
            preferredEnvironment: body.preferredEnvironment || body.environment,
            apply,
            allowProviderChange: body.allowProviderChange === true,
            reason: body.reason || 'ios_apple_charged_but_starter_2026-05-25',
            requestId: body.requestId || req.headers['x-request-id'],
            caseDate: body.caseDate || '2026-05-25',
        });

        return res.json(result);
    } catch (error) {
        const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
        console.error('[Admin] repair-apple-subscription error:', error);
        return res.status(statusCode).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
});

module.exports = router;
