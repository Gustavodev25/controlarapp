import { useAuthContext } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';

const ACTIVE_PRO_STATUSES = new Set(['active', 'trialing']);

export function SubscriptionBlocker({ children }: { children: React.ReactNode }) {
    const { profile, isLoading, isAuthenticated } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Aguarda carregamento e exige autenticação
        if (isLoading || !isAuthenticated) return;

        // Admin nunca é bloqueado
        if (profile?.isAdmin) return;

        // Não redireciona se já está na tela de planos
        if (pathname.includes('plans')) return;

        const plan = String(profile?.subscription?.plan || '').trim().toLowerCase();
        const status = String(profile?.subscription?.status || '').trim().toLowerCase();

        const isPro = (plan === 'pro' || plan === 'premium') && ACTIVE_PRO_STATUSES.has(status);

        if (!isPro) {
            router.replace('/settings/plans?forced=true');
        }
    }, [profile, isLoading, isAuthenticated, pathname]);

    return <>{children}</>;
}
