/**
 * iapService.ts
 * Stripe-based In-App Purchase service for iOS (Apple Pay)
 *
 * Substitui o RevenueCat, usando Stripe Payment Sheet com Apple Pay.
 * O fluxo funciona assim:
 *   1. App chama backend /api/stripe/create-payment-intent → recebe setupIntent + ephemeralKey
 *   2. App apresenta Stripe Payment Sheet (com Apple Pay habilitado)
 *   3. Usuário confirma pagamento via Apple Pay ou cartão
 *   4. App chama backend /api/stripe/create-subscription com o paymentMethodId
 *   5. Webhook Stripe atualiza Firebase automaticamente
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Stripe payments always use the production backend.
// API_BASE_URL resolves to localhost:3001 on physical devices in dev mode (unreachable),
// so we use the production URL directly here.
const STRIPE_BACKEND_URL =
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ||
    'https://backendcontrolarapp-production-3182.up.railway.app';

const STRIPE_API_URL = `${STRIPE_BACKEND_URL}/api/stripe`;

export const PRO_PRICE_STRING = 'R$ 35,90';
export const PRO_PRODUCT_ID = 'pro_monthly';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface PurchaseResult {
    success: boolean;
    subscriptionId?: string;
    clientSecret?: string;
    requiresAction?: boolean;
    alreadyActive?: boolean;
    userCancelled?: boolean;
    error?: string;
}

export interface RestoreResult {
    success: boolean;
    hasPro: boolean;
    error?: string;
}

export interface StripeConfig {
    publishableKey: string;
}

export interface SetupResult {
    success: boolean;
    setupIntentClientSecret?: string;
    ephemeralKey?: string;
    customerId?: string;
    publishableKey?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// Buscar configuração do Stripe (publishable key)
// ---------------------------------------------------------------------------

let _cachedConfig: StripeConfig | null = null;

export async function getStripeConfig(): Promise<StripeConfig> {
    if (_cachedConfig) return _cachedConfig;

    try {
        const response = await fetch(`${STRIPE_API_URL}/config`);
        const data = await response.json();
        _cachedConfig = { publishableKey: data.publishableKey };
        return _cachedConfig;
    } catch (error: any) {
        console.error('[IAP] Falha ao buscar config Stripe:', error);
        // Fallback para a chave pública do .env
        return {
            publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
        };
    }
}

// ---------------------------------------------------------------------------
// Setup: prepara customer + ephemeral key + setup intent
// ---------------------------------------------------------------------------

export async function setupStripePayment(
    firebaseUid: string,
    email: string,
    name?: string
): Promise<SetupResult> {
    try {
        const response = await fetch(`${STRIPE_API_URL}/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebaseUid, email, name }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[IAP] Resposta não-JSON do servidor:', response.status, text.slice(0, 200));
            throw new Error(`Servidor retornou status ${response.status}. Verifique se o backend está atualizado.`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao configurar pagamento');
        }

        return {
            success: true,
            setupIntentClientSecret: data.setupIntentClientSecret,
            ephemeralKey: data.ephemeralKey,
            customerId: data.customerId,
            publishableKey: data.publishableKey,
        };
    } catch (error: any) {
        console.error('[IAP] Erro no setup:', error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Criar assinatura com payment method
// ---------------------------------------------------------------------------

export async function createSubscription(
    firebaseUid: string,
    email: string,
    paymentMethodId: string,
    name?: string
): Promise<PurchaseResult> {
    try {
        const response = await fetch(`${STRIPE_API_URL}/create-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebaseUid, email, paymentMethodId, name }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao criar assinatura');
        }

        if (data.alreadyActive) {
            return {
                success: true,
                alreadyActive: true,
                subscriptionId: data.subscriptionId,
            };
        }

        return {
            success: data.status === 'active',
            subscriptionId: data.subscriptionId,
            clientSecret: data.clientSecret,
            requiresAction: data.requiresAction,
        };
    } catch (error: any) {
        console.error('[IAP] Erro ao criar assinatura:', error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Restaurar compras
// ---------------------------------------------------------------------------

export async function restorePurchases(
    firebaseUid: string,
    email: string
): Promise<RestoreResult> {
    if (Platform.OS !== 'ios') {
        return { success: false, hasPro: false };
    }

    try {
        const response = await fetch(`${STRIPE_API_URL}/restore-purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebaseUid, email }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao restaurar');
        }

        return {
            success: true,
            hasPro: data.hasPro,
        };
    } catch (error: any) {
        console.error('[IAP] Falha ao restaurar compras:', error);
        return { success: false, hasPro: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Verificar status da assinatura
// ---------------------------------------------------------------------------

export async function checkProStatus(firebaseUid: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${STRIPE_API_URL}/subscription-status?firebaseUid=${encodeURIComponent(firebaseUid)}`
        );
        const data = await response.json();
        return data.hasSubscription && data.status === 'active';
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Cancelar assinatura
// ---------------------------------------------------------------------------

export async function cancelSubscription(firebaseUid: string): Promise<{
    success: boolean;
    cancelAt?: Date;
    error?: string;
}> {
    try {
        const response = await fetch(`${STRIPE_API_URL}/cancel-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebaseUid }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao cancelar');
        }

        return {
            success: true,
            cancelAt: data.cancelAt ? new Date(data.cancelAt) : undefined,
        };
    } catch (error: any) {
        console.error('[IAP] Erro ao cancelar:', error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Offerings - Compatibilidade com interface antiga
// ---------------------------------------------------------------------------

export interface OfferingsResult {
    priceString: string;
    error?: string;
}

export async function getProOffering(): Promise<OfferingsResult> {
    return { priceString: PRO_PRICE_STRING };
}

// ---------------------------------------------------------------------------
// Inicialização (compatibilidade — agora no-op pois o Stripe não precisa de init)
// ---------------------------------------------------------------------------

export async function initializePurchases(_userId: string): Promise<void> {
    // Stripe não precisa de inicialização no SDK client como o RevenueCat
    // A inicialização é feita sob demanda quando o Payment Sheet é aberto
    console.log('[IAP] Stripe mode — sem inicialização necessária');
}
