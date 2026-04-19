import { useAuthContext } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';

const ACTIVE_PRO_STATUSES = new Set(['active', 'trialing']);

export function SubscriptionBlocker({ children }: { children: React.ReactNode }) {
    const { profile, isLoading, isAuthenticated, signOut } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();
    const blockingRef = useRef(false);

    useEffect(() => {
        if (isLoading || !isAuthenticated) return;
        if (profile?.isAdmin) return;

        const plan = String(profile?.subscription?.plan || '').trim().toLowerCase();
        const status = String(profile?.subscription?.status || '').trim().toLowerCase();
        const isPro = (plan === 'pro' || plan === 'premium') && ACTIVE_PRO_STATUSES.has(status);

        if (isPro) {
            blockingRef.current = false;
            return;
        }

        if (blockingRef.current) return;
        blockingRef.current = true;

        if (Platform.OS === 'android') {
            signOut();
            Alert.alert(
                'Assinatura necessária',
                'Para acessar o Controlar+, assine em nosso site.',
                [
                    {
                        text: 'Assinar agora',
                        onPress: () => Linking.openURL('https://www.controlarmais.com.br/'),
                    },
                    { text: 'OK', style: 'cancel' },
                ]
            );
        } else {
            if (pathname.includes('plans')) return;
            router.replace('/settings/plans?forced=true');
        }
    }, [profile, isLoading, isAuthenticated, pathname]);

    return <>{children}</>;
}
