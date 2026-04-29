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

export type SubscriptionPurchase = import('react-native-iap').SubscriptionPurchase;
export type PurchaseError = import('react-native-iap').PurchaseError;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKEND_URL =
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ||
    'https://backendcontrolarapp-production.up.railway.app';

export const PRO_PRODUCT_ID = 'com.gustavodev25.controlarapp.pro.monthly';
export const PRO_PRICE_STRING = 'R$ 35,90';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PurchaseResult {
    success: boolean;
    alreadyActive?: boolean;
    userCancelled?: boolean;
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

    try {
        await iap.initConnection();
    } catch (e) {
        console.error('[IAP] initConnection error:', e);
    }
}

export async function getProOffering(): Promise<OfferingsResult> {
    if (Platform.OS !== 'ios' || isExpoGo) return { priceString: PRO_PRICE_STRING };

    const iap = getIAP();
    if (!iap) return { priceString: PRO_PRICE_STRING };

    try {
        const products = await iap.getSubscriptions({ skus: [PRO_PRODUCT_ID] });
        if (products.length > 0) {
            return { priceString: products[0].localizedPrice || PRO_PRICE_STRING };
        }
    } catch (e) {
        console.error('[IAP] getSubscriptions error:', e);
    }
    return { priceString: PRO_PRICE_STRING };
}

export async function checkProStatus(firebaseUid: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${BACKEND_URL}/api/apple/subscription-status?firebaseUid=${encodeURIComponent(firebaseUid)}`
        );
        const data = await response.json();
        return data.hasPro === true;
    } catch {
        return false;
    }
}

export async function validateReceiptWithBackend(
    firebaseUid: string,
    receiptData: string
): Promise<PurchaseResult> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/apple/validate-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebaseUid, receiptData }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao validar recibo');
        return { success: data.hasPro === true };
    } catch (e: any) {
        console.error('[IAP] validate-receipt error:', e);
        return { success: false, error: e.message };
    }
}

export async function restorePurchases(firebaseUid: string): Promise<RestoreResult> {
    if (Platform.OS !== 'ios' || isExpoGo) {
        return { success: false, hasPro: false, error: 'IAP not available in this environment' };
    }

    const iap = getIAP();
    if (!iap) return { success: false, hasPro: false, error: 'IAP not available' };

    try {
        const purchases = await iap.getAvailablePurchases();
        const proPurchase = purchases.find(p => p.productId === PRO_PRODUCT_ID);
        if (!proPurchase?.transactionReceipt) {
            return { success: true, hasPro: false };
        }
        const result = await validateReceiptWithBackend(firebaseUid, proPurchase.transactionReceipt);
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
    if (isExpoGo) {
        throw new Error('Compras não são suportadas no Expo Go. Use um build nativo (EAS).');
    }
    const iap = getIAP();
    if (!iap) throw new Error('IAP não disponível neste ambiente');
    await iap.requestSubscription({ sku: PRO_PRODUCT_ID });
}
