import { useAuthContext } from '@/contexts/AuthContext';
import { syncStoreSubscriptionStatus } from '@/services/iapService';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';

const ACTIVE_PRO_STATUSES = new Set(['active', 'trial', 'trialing']);
const NATIVE_STORE_PROVIDERS = new Set(['apple', 'app_store', 'storekit', 'google', 'google_play', 'play_store']);
const STORE_STATUS_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

const parseSubscriptionDateMs = (value: any): number | null => {
    if (!value) return null;

    if (typeof value?.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date?.getTime?.()) ? null : date.getTime();
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.getTime();
    }

    if (typeof value === 'number' && Number.isFinite(value)) return value;

    if (typeof value === 'object' && Number.isFinite(value?.seconds)) {
        return Number(value.seconds) * 1000;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Keeps non-Pro users on the subscription screen while allowing native-store
 * renewals to sync before an expired local trial blocks access.
 */
export function SubscriptionBlocker({ children }: { children: React.ReactNode }) {
    const { profile, isLoading, isAuthenticated, user, refreshProfile } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();
    const hasRedirectedRef = useRef(false);
    const syncInFlightKeyRef = useRef<string | null>(null);
    const syncedSubscriptionKeyRef = useRef<string | null>(null);
    const [, forceStoreSyncRender] = useState(0);

    const subscription = profile?.subscription as any;
    const plan = String(subscription?.plan || '').trim().toLowerCase();
    const status = String(subscription?.status || '').trim().toLowerCase();
    const provider = String(
        subscription?.provider ||
        subscription?.paymentProvider ||
        subscription?.iapSource ||
        ''
    ).trim().toLowerCase();
    const expiresMs = parseSubscriptionDateMs(
        subscription?.expiresAt ||
        subscription?.renewalDate ||
        subscription?.nextBillingDate
    );
    const isPaidPlan = plan === 'pro' || plan === 'premium';
    const isActiveStatus = ACTIVE_PRO_STATUSES.has(status);
    const isNativeStoreSubscription = NATIVE_STORE_PROVIDERS.has(provider);
    const subscriptionKey = [
        user?.uid || '',
        plan,
        status,
        provider,
        expiresMs || '',
    ].join(':');
    const shouldSyncNativeStoreStatus =
        Boolean(user?.uid) &&
        isPaidPlan &&
        isActiveStatus &&
        isNativeStoreSubscription &&
        (
            !expiresMs ||
            status === 'trial' ||
            status === 'trialing' ||
            expiresMs <= Date.now() + STORE_STATUS_REFRESH_WINDOW_MS
        );

    useEffect(() => {
        if (!shouldSyncNativeStoreStatus || !user?.uid) return;
        if (
            syncedSubscriptionKeyRef.current === subscriptionKey ||
            syncInFlightKeyRef.current === subscriptionKey
        ) {
            return;
        }

        let cancelled = false;
        syncInFlightKeyRef.current = subscriptionKey;

        syncStoreSubscriptionStatus(user.uid, {
            refreshServerStatus: !expiresMs || expiresMs <= Date.now() + STORE_STATUS_REFRESH_WINDOW_MS,
        })
            .then(async (statusResult) => {
                if (!cancelled && statusResult.success) {
                    await refreshProfile();
                }
            })
            .catch((error) => {
                console.warn('[SubscriptionBlocker] Store subscription sync failed:', error);
            })
            .finally(() => {
                if (syncInFlightKeyRef.current === subscriptionKey) {
                    syncInFlightKeyRef.current = null;
                }
                syncedSubscriptionKeyRef.current = subscriptionKey;
                if (!cancelled) {
                    forceStoreSyncRender((value) => value + 1);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [expiresMs, refreshProfile, shouldSyncNativeStoreStatus, subscriptionKey, user?.uid]);

    useEffect(() => {
        if (isLoading || !isAuthenticated) {
            hasRedirectedRef.current = false;
            syncInFlightKeyRef.current = null;
            syncedSubscriptionKeyRef.current = null;
            return;
        }

        if (profile?.isAdmin) return;

        const isExpiredNativeStoreSubscription =
            isNativeStoreSubscription &&
            isPaidPlan &&
            isActiveStatus &&
            !!expiresMs &&
            expiresMs <= Date.now();
        const isWaitingForStoreSync =
            shouldSyncNativeStoreStatus &&
            (
                syncInFlightKeyRef.current === subscriptionKey ||
                syncedSubscriptionKeyRef.current !== subscriptionKey
            );
        const isPro = isPaidPlan && isActiveStatus && !isExpiredNativeStoreSubscription;

        if (isPro) {
            hasRedirectedRef.current = false;
            return;
        }

        if (isWaitingForStoreSync) {
            return;
        }

        if (
            pathname.includes('subscription') ||
            pathname.includes('plans') ||
            pathname.includes('legal') ||
            pathname.includes('login') ||
            pathname.includes('register') ||
            pathname.includes('welcome')
        ) {
            return;
        }

        if (hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;

        router.replace('/settings/subscription');
    }, [
        expiresMs,
        isActiveStatus,
        isAuthenticated,
        isLoading,
        isNativeStoreSubscription,
        isPaidPlan,
        pathname,
        profile,
        router,
        shouldSyncNativeStoreStatus,
        subscriptionKey,
    ]);

    return <>{children}</>;
}
