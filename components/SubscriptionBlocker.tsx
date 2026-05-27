import { useAuthContext } from '@/contexts/AuthContext';
import { useAppleSubscriptionAutoSync } from '@/hooks/useAppleSubscriptionAutoSync';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';

const ACTIVE_PRO_STATUSES = new Set(['active', 'trialing']);

/**
 * SubscriptionBlocker — Redirects non-Pro users to the subscription screen
 * instead of signing them out. Users can switch accounts from there.
 */
export function SubscriptionBlocker({ children }: { children: React.ReactNode }) {
    const { user, profile, isLoading, isAuthenticated, refreshProfile } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();
    const hasRedirectedRef = useRef(false);
    const appleSubscriptionSync = useAppleSubscriptionAutoSync({
        userId: user?.uid,
        isAuthenticated,
        isAuthLoading: isLoading,
        enabled: !profile?.isAdmin,
        onSynced: refreshProfile,
    });

    useEffect(() => {
        if (
            isLoading ||
            !isAuthenticated ||
            appleSubscriptionSync.isInitialSyncing ||
            !appleSubscriptionSync.hasCompletedInitialSync
        ) {
            hasRedirectedRef.current = false;
            return;
        }

        // Admins always have access
        if (profile?.isAdmin) return;

        const plan = String(profile?.subscription?.plan || '').trim().toLowerCase();
        const status = String(profile?.subscription?.status || '').trim().toLowerCase();
        const profileHasPro = (plan === 'pro' || plan === 'premium') && ACTIVE_PRO_STATUSES.has(status);
        const isPro = appleSubscriptionSync.syncedHasPro ?? profileHasPro;

        if (isPro) {
            hasRedirectedRef.current = false;
            return;
        }

        // Already on subscription/plans pages — don't redirect
        if (pathname.includes('subscription') || pathname.includes('plans') || pathname.includes('legal') || pathname.includes('login') || pathname.includes('register') || pathname.includes('welcome')) {
            return;
        }

        // Prevent multiple redirects
        if (hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;

        // Redirect to subscription page (user stays logged in)
        router.replace('/settings/subscription');
    }, [
        appleSubscriptionSync.hasCompletedInitialSync,
        appleSubscriptionSync.isInitialSyncing,
        appleSubscriptionSync.syncedHasPro,
        profile,
        isLoading,
        isAuthenticated,
        pathname,
        router,
    ]);

    return <>{children}</>;
}
