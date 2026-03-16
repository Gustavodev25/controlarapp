import { useAuthContext } from '@/contexts/AuthContext';
import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';

import React, { useEffect, useRef, useState } from 'react';
import {
    Modal,
    Platform,
    StyleSheet,
    Text,
    View
} from 'react-native';

const BLOCKED_STATUSES = new Set(['cancelled', 'canceled', 'expired', 'past_due', 'trial_expired']);

export function SubscriptionBlocker({ children }: { children: React.ReactNode }) {
    const { profile, isLoading } = useAuthContext();
    const [isBlocked, setIsBlocked] = useState(false);
    const lottieRef = useRef<LottieView>(null);

    useEffect(() => {
        if (isLoading) return;

        if (profile?.isAdmin) {
            setIsBlocked(false);
            return;
        }

        const subscription = profile?.subscription;
        if (!subscription) {
            setIsBlocked(false);
            return;
        }

        const plan = String(subscription.plan || 'free').trim().toLowerCase();
        if (plan !== 'pro' && plan !== 'premium') {
            setIsBlocked(false);
            return;
        }

        const status = String(subscription.status || 'free').trim().toLowerCase();

        // Important: do not block by date only. Date fields can be stale/legacy.
        setIsBlocked(BLOCKED_STATUSES.has(status));
    }, [profile, isLoading]);

    useEffect(() => {
        if (!isBlocked) return;

        lottieRef.current?.play();

        const interval = setInterval(() => {
            lottieRef.current?.reset();
            lottieRef.current?.play();
        }, 2000);

        return () => clearInterval(interval);
    }, [isBlocked]);



    if (!isBlocked) {
        return <>{children}</>;
    }

    return (
        <>
            {children}
            <Modal
                visible={isBlocked}
                transparent
                animationType="fade"
                statusBarTranslucent
            >
                <BlurView intensity={80} tint="dark" style={styles.overlay}>
                    <View style={styles.container}>
                        <View style={styles.card}>
                            <View style={styles.iconContainer}>
                                <LottieView
                                    ref={lottieRef}
                                    source={require('../assets/expirado.json')}
                                    style={styles.lottie}
                                    loop={false}
                                    autoPlay={false}
                                />
                            </View>

                            <Text style={styles.title}>Plano Expirado</Text>
                            <Text style={styles.message}>
                                Sua assinatura finalizou. Renove para continuar com acesso total.
                            </Text>

                            {Platform.OS !== 'ios' && (
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoBoxText}>
                                        Gerencie sua assinatura pelo site controlarmais.com.br
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </BlurView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
    },
    card: {
        width: '100%',
        backgroundColor: '#18181B',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    iconContainer: {
        marginBottom: 24,
        width: 72,
        height: 72,
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottie: {
        width: 48,
        height: 48,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.4,
    },
    message: {
        fontSize: 15,
        color: '#A1A1AA',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        paddingHorizontal: 8,
    },
    infoBox: {
        width: '100%',
        backgroundColor: 'rgba(142, 142, 147, 0.1)',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    infoBoxText: {
        fontSize: 14,
        color: '#A1A1AA',
        textAlign: 'center',
        lineHeight: 20,
    },
});
