/**
 * IAP Service — Skips native module loading entirely in Expo Go.
 *
 * `react-native-iap` depends on `react-native-nitro-modules` which throws
 * at the top-level when running inside Expo Go. Metro propagates this as an
 * uncaught global error even inside try-catch. We detect Expo Go via
 * expo-constants and never attempt to require `react-native-iap` at all.
 */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// ---------------------------------------------------------------------------
// Expo Go detection — MUST happen before any require of react-native-iap
// ---------------------------------------------------------------------------

const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ---------------------------------------------------------------------------
// Lazy module reference (only loaded in native builds)
// ---------------------------------------------------------------------------

let _iap: typeof import('react-native-iap') | null = null;

function getIAP(): typeof import('react-native-iap') | null {
    if (isExpoGo) return null;
    if (_iap) return _iap;

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _iap = require('react-native-iap') as typeof import('react-native-iap');
        return _iap;
    } catch (e) {
        console.warn('[IAP] react-native-iap could not be loaded:', e);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Re-exported types (these are type-only so no runtime cost)
// ---------------------------------------------------------------------------

export type StorePurchase = import('react-native-iap').Purchase;
export type SubscriptionPurchase = StorePurchase;
export type PurchaseError = import('react-native-iap').PurchaseError;
export type ProductSubscription = import('react-native-iap').ProductSubscription;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKEND_URL =
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ||
    'https://backendcontrolarapp-production.up.railway.app';

export const PRO_PRODUCT_ID = 'com.gustavodev25.controlarapp.pro.monthly';
export const PRO_PRICE_STRING = 'R$ 34,90';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurchaseResult {
    success: boolean;
    alreadyActive?: boolean;
    userCancelled?: boolean;
    hasPro?: boolean;
    syncedFromStoreKit?: boolean;
    status?: string;
    expiresAt?: string | null;
    cancelAtPeriodEnd?: boolean;
    autoRenewStatus?: string | null;
    error?: string;
}

export interface RestoreResult {
    success: boolean;
    hasPro: boolean;
    error?: string;
}

export interface OfferingsResult {
    priceString: string;
    error?: string;
}

export interface AppleSubscriptionSnapshot {
    plan: string;
    status: string;
    provider?: string | null;
    paymentProvider?: string | null;
    iapSource?: string | null;
    productId?: string | null;
    billingCycle?: 'monthly' | 'yearly' | null;
    price?: number | null;
    currency?: string | null;
    expiresAt?: string | null;
    nextBillingDate?: string | null;
    renewalDate?: string | null;
    startedAt?: string | null;
    cancelledAt?: string | null;
    cancelAtPeriodEnd?: boolean;
    autoRenewStatus?: string | null;
    transactionId?: string | null;
    originalTransactionId?: string | null;
    updatedAt?: string | null;
}

export interface AppleSubscriptionStatusResult {
    success: boolean;
    hasPro: boolean;
    plan: string;
    status: string;
    provider: string | null;
    expiresAt: string | null;
    cancelAtPeriodEnd: boolean;
    autoRenewStatus?: string | null;
    subscription: AppleSubscriptionSnapshot | null;
    error?: string;
}

interface AppleSubscriptionStatusOptions {
    refreshServerStatus?: boolean;
}

let connectionPromise: Promise<void> | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isJws = (value?: string | null) => {
    return typeof value === 'string' && value.split('.').length === 3;
};

const toFiniteNumber = (value: any): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const getPurchaseTransactionId = (purchase?: any): string | null => {
    return purchase?.transactionId || purchase?.id || null;
};

const getPurchaseOriginalTransactionId = (purchase?: any): string | null => {
    return (
        purchase?.originalTransactionIdentifierIOS ||
        purchase?.originalTransactionId ||
        purchase?.transactionId ||
        purchase?.id ||
        null
    );
};

const normalizeStoreKitPurchaseForBackend = (
    purchase?: Partial<StorePurchase> | Record<string, any> | null,
    signedTransactionInfo?: string | null
) => {
    if (!purchase && !signedTransactionInfo) return null;

    const rawPurchase = (purchase || {}) as Record<string, any>;

    return {
        productId: rawPurchase.productId || PRO_PRODUCT_ID,
        transactionId: getPurchaseTransactionId(rawPurchase),
        originalTransactionId: getPurchaseOriginalTransactionId(rawPurchase),
        purchaseToken: isJws(rawPurchase.purchaseToken) ? rawPurchase.purchaseToken : null,
        signedTransactionInfo: signedTransactionInfo || (isJws(rawPurchase.purchaseToken) ? rawPurchase.purchaseToken : null),
        purchaseState: rawPurchase.purchaseState || null,
        transactionDate: toFiniteNumber(rawPurchase.transactionDate),
        expirationDateIOS: toFiniteNumber(rawPurchase.expirationDateIOS),
        originalTransactionDateIOS: toFiniteNumber(rawPurchase.originalTransactionDateIOS),
        environmentIOS: rawPurchase.environmentIOS || null,
        isAutoRenewing: typeof rawPurchase.isAutoRenewing === 'boolean' ? rawPurchase.isAutoRenewing : null,
        renewalInfoIOS: rawPurchase.renewalInfoIOS || null,
        store: rawPurchase.store || rawPurchase.platform || 'ios',
    };
};

function getTrustedDisplayPrice(product: ProductSubscription): string {
    const displayPrice = String(product.displayPrice || '').trim();
    const currency = String((product as any).currency || '').trim().toUpperCase();

    if (!displayPrice) return PRO_PRICE_STRING;

    const isDollarPrice =
        (displayPrice.includes('$') && !displayPrice.includes('R$')) ||
        /\bUSD\b/i.test(displayPrice);
    if (isDollarPrice) return PRO_PRICE_STRING;

    if (currency && currency !== 'BRL' && !displayPrice.includes('R$')) {
        return PRO_PRICE_STRING;
    }

    return displayPrice;
}

// ---------------------------------------------------------------------------
// Re-exported helpers (lazy)
// ---------------------------------------------------------------------------

export function purchaseUpdatedListener(
    listener: (purchase: SubscriptionPurchase) => void
) {
    const iap = getIAP();
    if (!iap) {
        // Return a no-op subscription so callers don't break
        return { remove: () => {} };
    }
    return iap.purchaseUpdatedListener(listener as any);
}

export function purchaseErrorListener(
    listener: (error: PurchaseError) => void
) {
    const iap = getIAP();
    if (!iap) {
        return { remove: () => {} };
    }
    return iap.purchaseErrorListener(listener as any);
}

export async function finishTransaction(opts: {
    purchase: SubscriptionPurchase;
    isConsumable: boolean;
}): Promise<void> {
    const iap = getIAP();
    if (!iap) return;
    await iap.finishTransaction(opts as any);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function initializePurchases(_userId?: string): Promise<void> {
    if (Platform.OS !== 'ios') return;
    if (isExpoGo) {
        console.log('[IAP] Skipping — running in Expo Go');
        return;
    }

    const iap = getIAP();
    if (!iap) return;

    if (!connectionPromise) {
        connectionPromise = iap
            .initConnection()
            .then(() => undefined)
            .catch((e) => {
                connectionPromise = null;
                console.error('[IAP] initConnection error:', e);
            });
    }

    await connectionPromise;
}

export async function getProOffering(): Promise<OfferingsResult> {
    if (Platform.OS !== 'ios' || isExpoGo) return { priceString: PRO_PRICE_STRING };

    const iap = getIAP();
    if (!iap) return { priceString: PRO_PRICE_STRING };

    try {
        await initializePurchases();
        const products = await iap.fetchProducts({
            skus: [PRO_PRODUCT_ID],
            type: 'subs',
        }) as ProductSubscription[];
        const product = products.find((item) => item.id === PRO_PRODUCT_ID) || products[0];
        if (product) {
            return { priceString: getTrustedDisplayPrice(product) };
        }
    } catch (e) {
        console.error('[IAP] fetchProducts error:', e);
    }
    return { priceString: PRO_PRICE_STRING };
}

function createFallbackStatus(error?: string): AppleSubscriptionStatusResult {
    return {
        success: false,
        hasPro: false,
        plan: 'free',
        status: 'inactive',
        provider: null,
        expiresAt: null,
        cancelAtPeriodEnd: false,
        subscription: null,
        error,
    };
}

export async function getAppleSubscriptionStatus(
    firebaseUid: string,
    options: AppleSubscriptionStatusOptions = {}
): Promise<AppleSubscriptionStatusResult> {
    try {
        const refreshParam = options.refreshServerStatus ? '&refresh=true' : '';
        const response = await fetch(
            `${BACKEND_URL}/api/apple/subscription-status?firebaseUid=${encodeURIComponent(firebaseUid)}${refreshParam}`
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao consultar assinatura Apple');
        }

        return {
            success: true,
            hasPro: data.hasPro === true,
            plan: String(data.plan || data.subscription?.plan || 'free').trim().toLowerCase(),
            status: String(data.status || data.subscription?.status || 'inactive').trim().toLowerCase(),
            provider: data.provider || data.subscription?.provider || null,
            expiresAt: data.expiresAt || data.subscription?.expiresAt || null,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd === true || data.subscription?.cancelAtPeriodEnd === true,
            autoRenewStatus: data.autoRenewStatus || data.subscription?.autoRenewStatus || null,
            subscription: data.subscription || null,
        };
    } catch (e: any) {
        console.error('[IAP] subscription-status error:', e);
        return createFallbackStatus(e?.message || 'Erro ao consultar assinatura Apple');
    }
}

async function getStoreKitSignedTransaction(purchase?: Partial<StorePurchase> | Record<string, any> | null): Promise<string | null> {
    const purchaseToken = (purchase as any)?.purchaseToken;
    if (isJws(purchaseToken)) return purchaseToken;

    const iap = getIAP();
    if (!iap || typeof (iap as any).getTransactionJwsIOS !== 'function') return null;

    try {
        await initializePurchases();
        const signedTransaction = await (iap as any).getTransactionJwsIOS(PRO_PRODUCT_ID);
        return isJws(signedTransaction) ? signedTransaction : null;
    } catch (e) {
        console.warn('[IAP] getTransactionJwsIOS unavailable:', e);
        return null;
    }
}

async function getActiveStoreKitPurchase(): Promise<Record<string, any> | null> {
    if (Platform.OS !== 'ios' || isExpoGo) return null;

    const iap = getIAP();
    if (!iap) return null;

    await initializePurchases();

    try {
        if (typeof (iap as any).getActiveSubscriptions === 'function') {
            const subscriptions = await (iap as any).getActiveSubscriptions([PRO_PRODUCT_ID]);
            const activeSubscription = Array.isArray(subscriptions)
                ? subscriptions.find((item: any) => item?.productId === PRO_PRODUCT_ID && item?.isActive !== false)
                : null;

            if (activeSubscription) return activeSubscription;
        }
    } catch (e) {
        console.warn('[IAP] getActiveSubscriptions unavailable:', e);
    }

    try {
        if (typeof (iap as any).currentEntitlementIOS === 'function') {
            const entitlement = await (iap as any).currentEntitlementIOS(PRO_PRODUCT_ID);
            if (entitlement?.productId === PRO_PRODUCT_ID) return entitlement;
        }
    } catch (e) {
        console.warn('[IAP] currentEntitlementIOS unavailable:', e);
    }

    try {
        const purchases = await iap.getAvailablePurchases({
            onlyIncludeActiveItemsIOS: true,
            alsoPublishToEventListenerIOS: false,
        });
        return (purchases || []).find((item: StorePurchase) => item.productId === PRO_PRODUCT_ID) || null;
    } catch (e) {
        console.warn('[IAP] getAvailablePurchases unavailable:', e);
        return null;
    }
}

export async function syncStoreKitPurchaseWithBackend(
    firebaseUid: string,
    purchase?: Partial<StorePurchase> | Record<string, any> | null
): Promise<PurchaseResult> {
    if (Platform.OS !== 'ios' || isExpoGo) {
        return { success: false, hasPro: false, error: 'StoreKit indisponivel neste ambiente' };
    }

    try {
        const signedTransactionInfo = await getStoreKitSignedTransaction(purchase);
        if (!signedTransactionInfo) {
            return {
                success: false,
                hasPro: false,
                error: 'Nao foi possivel obter a transacao assinada da App Store.',
            };
        }

        const normalizedPurchase = normalizeStoreKitPurchaseForBackend(purchase, signedTransactionInfo);

        const response = await fetch(`${BACKEND_URL}/api/apple/sync-storekit-purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firebaseUid,
                signedTransactionInfo,
                purchase: normalizedPurchase,
            }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Erro ao sincronizar compra Apple');

        return {
            success: data.hasPro === true,
            hasPro: data.hasPro === true,
            syncedFromStoreKit: true,
            status: data.status,
            expiresAt: data.expiresAt || null,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
            autoRenewStatus: data.autoRenewStatus || null,
            error: data.error,
        };
    } catch (e: any) {
        console.error('[IAP] sync-storekit-purchase error:', e);
        return {
            success: false,
            hasPro: false,
            error: e?.message || 'Erro ao sincronizar compra Apple',
        };
    }
}

export async function syncActiveStoreKitPurchaseWithBackend(firebaseUid: string): Promise<PurchaseResult> {
    const activePurchase = await getActiveStoreKitPurchase();
    if (!activePurchase) {
        return { success: false, hasPro: false, error: 'Nenhuma assinatura Pro ativa encontrada na App Store.' };
    }

    return syncStoreKitPurchaseWithBackend(firebaseUid, activePurchase);
}

export async function syncAppleSubscriptionStatus(
    firebaseUid: string,
    options: AppleSubscriptionStatusOptions = {}
): Promise<AppleSubscriptionStatusResult> {
    const currentStatus = await getAppleSubscriptionStatus(firebaseUid, options);

    if (Platform.OS !== 'ios' || isExpoGo) {
        return currentStatus;
    }

    if (currentStatus.hasPro) {
        return currentStatus;
    }

    const storeKitSync = await syncActiveStoreKitPurchaseWithBackend(firebaseUid);
    if (storeKitSync.success || storeKitSync.hasPro) {
        return getAppleSubscriptionStatus(firebaseUid);
    }

    return currentStatus;
}

export async function checkProStatus(firebaseUid: string): Promise<boolean> {
    const status = await syncAppleSubscriptionStatus(firebaseUid);
    return status.hasPro === true;
}

export async function validateReceiptWithBackend(
    firebaseUid: string,
    receiptData: string,
    purchase?: StorePurchase
): Promise<PurchaseResult> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/apple/validate-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firebaseUid,
                receiptData,
                productId: purchase?.productId,
                transactionId: purchase?.transactionId,
                originalTransactionId: (purchase as any)?.originalTransactionIdentifierIOS,
                purchaseToken: purchase?.purchaseToken,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Erro ao validar recibo');
        return {
            success: data.hasPro === true,
            hasPro: data.hasPro === true,
            status: data.status,
            expiresAt: data.expiresAt || null,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
            autoRenewStatus: data.autoRenewStatus || null,
        };
    } catch (e: any) {
        console.error('[IAP] validate-receipt error:', e);
        return { success: false, error: e?.message || 'Erro ao validar recibo' };
    }
}

async function getReceiptDataForValidation(
    options: { refreshIfMissing?: boolean; attempts?: number; retryDelayMs?: number } = {}
): Promise<string | null> {
    if (Platform.OS !== 'ios' || isExpoGo) return null;

    const iap = getIAP();
    if (!iap) return null;

    const attempts = Math.max(1, options.attempts ?? 1);
    const retryDelayMs = options.retryDelayMs ?? 600;

    await initializePurchases();

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const receipt = await iap.getReceiptIOS();
            if (receipt) return receipt;
        } catch (e) {
            console.warn('[IAP] getReceiptIOS unavailable:', e);
        }

        if (attempt < attempts - 1) {
            await wait(retryDelayMs);
        }
    }

    if (options.refreshIfMissing !== true) {
        return null;
    }

    try {
        const refreshedReceipt = await iap.requestReceiptRefreshIOS();
        return refreshedReceipt || null;
    } catch (e) {
        console.warn('[IAP] requestReceiptRefreshIOS failed:', e);
    }

    try {
        const receiptData = await iap.getReceiptDataIOS();
        return receiptData || null;
    } catch (e) {
        console.error('[IAP] getReceiptDataIOS failed:', e);
        return null;
    }
}

export async function validatePurchaseWithBackend(
    firebaseUid: string,
    purchase: StorePurchase
): Promise<PurchaseResult> {
    const storeKitResult = await syncStoreKitPurchaseWithBackend(firebaseUid, purchase);
    if (storeKitResult.success) {
        return storeKitResult;
    }

    const receiptData = await getReceiptDataForValidation({
        refreshIfMissing: false,
        attempts: 3,
        retryDelayMs: 700,
    });

    if (receiptData) {
        const receiptResult = await validateReceiptWithBackend(firebaseUid, receiptData, purchase);
        if (receiptResult.success || receiptResult.error) {
            return receiptResult;
        }
    }

    return {
        success: false,
        hasPro: false,
        error: storeKitResult.error || 'Compra feita na Apple, mas ainda nao foi possivel ativar o Pro. Toque em Restaurar compras.',
    };
}

export async function restorePurchases(firebaseUid: string): Promise<RestoreResult> {
    const accountStatus = await getAppleSubscriptionStatus(firebaseUid, { refreshServerStatus: true });
    if (accountStatus.hasPro) {
        return { success: true, hasPro: true };
    }

    if (Platform.OS !== 'ios' || isExpoGo) {
        return {
            success: accountStatus.success,
            hasPro: false,
            error: accountStatus.error || 'IAP not available in this environment',
        };
    }

    const iap = getIAP();
    if (!iap) {
        return {
            success: accountStatus.success,
            hasPro: false,
            error: accountStatus.error || 'IAP not available',
        };
    }

    try {
        await initializePurchases();

        const activeSync = await syncActiveStoreKitPurchaseWithBackend(firebaseUid);
        if (activeSync.success || activeSync.hasPro) {
            return { success: true, hasPro: true };
        }

        await iap.restorePurchases();
        const purchases = await iap.getAvailablePurchases({
            onlyIncludeActiveItemsIOS: true,
            alsoPublishToEventListenerIOS: false,
        });
        const proPurchase = purchases.find(p => p.productId === PRO_PRODUCT_ID);
        if (!proPurchase) {
            const refreshedAccountStatus = await getAppleSubscriptionStatus(firebaseUid, { refreshServerStatus: true });
            return { success: true, hasPro: refreshedAccountStatus.hasPro };
        }
        const result = await validatePurchaseWithBackend(firebaseUid, proPurchase);
        if (result.success) {
            await iap.finishTransaction({ purchase: proPurchase as any, isConsumable: false });
        }
        return { success: true, hasPro: result.success };
    } catch (e: any) {
        console.error('[IAP] restorePurchases error:', e);
        return { success: false, hasPro: false, error: e.message };
    }
}

export async function purchaseProSubscription(): Promise<void> {
    if (Platform.OS !== 'ios') {
        throw new Error('Assinaturas no iOS devem ser feitas pela App Store.');
    }
    if (isExpoGo) {
        throw new Error('Compras não são suportadas no Expo Go. Use um build nativo (EAS).');
    }
    const iap = getIAP();
    if (!iap) throw new Error('IAP não disponível neste ambiente');
    await initializePurchases();
    await iap.requestPurchase({
        request: {
            apple: { sku: PRO_PRODUCT_ID },
        },
        type: 'subs',
    });
}

export async function openSubscriptionManagement(): Promise<void> {
    if (Platform.OS !== 'ios' || isExpoGo) return;

    const iap = getIAP();
    if (!iap) throw new Error('IAP nao disponivel neste ambiente');

    await initializePurchases();
    await iap.deepLinkToSubscriptions();
}
