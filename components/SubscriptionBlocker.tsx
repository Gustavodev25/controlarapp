import { useAuthContext } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';

const ACTIVE_PRO_STATUSES = new Set(['active', 'trialing']);

/**
 * SubscriptionBlocker — Redirects non-Pro users to the subscription screen
 * instead of signing them out. Users can switch accounts from there.
 */
export function SubscriptionBlocker({ children }: { children: React.ReactNode }) {
    const { profile, isLoading, isAuthenticated } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();
    const hasRedirectedRef = useRef(false);

    useEffect(() => {
        if (isLoading || !isAuthenticated) {
            hasRedirectedRef.current = false;
            return;
        }

        // Admins always have access
        if (profile?.isAdmin) return;

        const plan = String(profile?.subscription?.plan || '').trim().toLowerCase();
        const status = String(profile?.subscription?.status || '').trim().toLowerCase();
        const isPro = (plan === 'pro' || plan === 'premium') && ACTIVE_PRO_STATUSES.has(status);

        if (isPro) {
            hasRedirectedRef.current = false;
            return;
        }

        // Already on subscription/plans pages — don't redirect
        if (pathname.includes('subscription') || pathname.includes('plans') || pathname.includes('login') || pathname.includes('register') || pathname.includes('welcome')) {
            return;
        }

        // Prevent multiple redirects
        if (hasRedirectedRef.current) return;
        hasRedirectedRef.current = true;

        // Redirect to subscription page (user stays logged in)
        router.replace('/settings/subscription');
    }, [profile, isLoading, isAuthenticated, pathname]);

    return <>{children}</>;
}
