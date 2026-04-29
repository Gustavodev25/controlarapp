import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import {
    checkProStatus,
    finishTransaction,
    getProOffering,
    initializePurchases,
    PRO_PRODUCT_ID,
    PRO_PRICE_STRING,
    purchaseErrorListener,
    purchaseProSubscription,
    purchaseUpdatedListener,
    restorePurchases,
    validateReceiptWithBackend,
    type PurchaseError,
    type SubscriptionPurchase,
} from '@/services/iapService';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, LogOut, RefreshCw, Shield, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PlansScreen() {
    const router = useRouter();
    const { forced } = useLocalSearchParams();
    const isForced = forced === 'true';
    const insets = useSafeAreaInsets();
    const { user, profile, refreshProfile, signOut } = useAuthContext();

    const handleSwitchAccount = async () => {
        await signOut();
        router.replace('/(public)/login');
    };

    const [iapLoading, setIapLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [priceString, setPriceString] = useState(PRO_PRICE_STRING);
    const [iapReady, setIapReady] = useState(false);
    const [alreadyPro, setAlreadyPro] = useState(false);

    const isIOS = Platform.OS === 'ios';
    const currentPlan = profile?.subscription?.plan ?? 'free';
    const currentStatus = profile?.subscription?.status ?? '';
    const isPro =
        (currentPlan === 'pro' || currentPlan === 'premium') &&
        (currentStatus === 'active' || currentStatus === 'trialing');

    // Verifica status e inicializa StoreKit ao abrir
    useEffect(() => {
        if (!user?.uid) return;
        let cancelled = false;

        const setup = async () => {
            await initializePurchases(user.uid);
            const proActive = await checkProStatus(user.uid);
            if (cancelled) return;
            setAlreadyPro(proActive);

            const { priceString: price } = await getProOffering();
            if (cancelled) return;
            setPriceString(price);
            setIapReady(true);
        };

        setup();
        return () => { cancelled = true; };
    }, [user?.uid]);

    // Listeners nativos do StoreKit
    useEffect(() => {
        if (!isIOS) return;

        const purchaseSub = purchaseUpdatedListener(async (purchase: SubscriptionPurchase) => {
            if (purchase.productId !== PRO_PRODUCT_ID) return;
            const receiptData = purchase.transactionReceipt;
            if (!receiptData || !user?.uid) return;

            setIapLoading(true);
            try {
                const result = await validateReceiptWithBackend(user.uid, receiptData);
                await finishTransaction({ purchase, isConsumable: false });

                if (result.success) {
                    await refreshProfile();
                    Alert.alert(
                        'Bem-vindo ao Pro!',
                        'Sua assinatura foi ativada com sucesso. Aproveite todos os recursos ilimitados.',
                        [{ text: 'Continuar', onPress: () => isForced ? router.replace('/(tabs)/dashboard') : router.back() }]
                    );
                } else {
                    Alert.alert(
                        'Falha na ativação',
                        result.error ?? 'Não foi possível ativar a assinatura. Tente novamente.',
                        [{ text: 'OK' }]
                    );
                }
            } finally {
                setIapLoading(false);
            }
        });

        const errorSub = purchaseErrorListener((error: PurchaseError) => {
            if ((error as any).code === 'E_USER_CANCELLED') {
                setIapLoading(false);
                return;
            }
            setIapLoading(false);
            Alert.alert('Erro no pagamento', error.message || 'Não foi possível processar o pagamento.');
        });

        return () => {
            purchaseSub.remove();
            errorSub.remove();
        };
    }, [user?.uid, isForced]);

    // Bloqueia botão voltar no Android se forçado
    useEffect(() => {
        if (!isForced) return;
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => backHandler.remove();
    }, [isForced]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handlePurchase = async () => {
        if (!user?.uid || !user?.email) {
            Alert.alert('Autenticação necessária', 'Faça login para assinar o plano Pro.', [{ text: 'OK' }]);
            return;
        }

        setIapLoading(true);
        try {
            await purchaseProSubscription();
            // Resultado chega via purchaseUpdatedListener acima
        } catch (e: any) {
            if (e?.code === 'E_USER_CANCELLED') {
                setIapLoading(false);
                return;
            }
            setIapLoading(false);
            Alert.alert('Erro', e?.message || 'Ocorreu um erro inesperado. Tente novamente.');
        }
    };

    const handleRestore = async () => {
        if (!user?.uid) return;

        setRestoring(true);
        try {
            const result = await restorePurchases(user.uid);

            if (result.hasPro) {
                await refreshProfile();
                Alert.alert(
                    'Compra restaurada!',
                    'Sua assinatura Pro foi restaurada com sucesso.',
                    [{ text: 'OK', onPress: () => isForced ? router.replace('/(tabs)/dashboard') : router.back() }]
                );
            } else {
                Alert.alert(
                    'Nenhuma compra encontrada',
                    'Não encontramos uma assinatura Pro ativa vinculada a este Apple ID.',
                    [{ text: 'OK' }]
                );
            }
        } finally {
            setRestoring(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Animações
    // ---------------------------------------------------------------------------

    const mainCardOpacity = useSharedValue(0);
    const mainCardTranslateY = useSharedValue(30);
    const featuresCardOpacity = useSharedValue(0);
    const featuresCardTranslateY = useSharedValue(30);
    const guaranteeCardOpacity = useSharedValue(0);
    const guaranteeCardTranslateY = useSharedValue(30);
    const securityOpacity = useSharedValue(0);
    const heroOpacity = useSharedValue(0);
    const buttonOpacity = useSharedValue(0);

    useEffect(() => {
        mainCardOpacity.value = withDelay(100, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
        mainCardTranslateY.value = withDelay(100, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
        featuresCardOpacity.value = withDelay(200, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
        featuresCardTranslateY.value = withDelay(200, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
        guaranteeCardOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
        guaranteeCardTranslateY.value = withDelay(300, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
        securityOpacity.value = withDelay(450, withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }));
        heroOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
        buttonOpacity.value = withDelay(500, withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }));
    }, []);

    const mainCardStyle = useAnimatedStyle(() => ({
        opacity: mainCardOpacity.value,
        transform: [{ translateY: mainCardTranslateY.value }],
    }));
    const featuresCardStyle = useAnimatedStyle(() => ({
        opacity: featuresCardOpacity.value,
        transform: [{ translateY: featuresCardTranslateY.value }],
    }));
    const guaranteeCardStyle = useAnimatedStyle(() => ({
        opacity: guaranteeCardOpacity.value,
        transform: [{ translateY: guaranteeCardTranslateY.value }],
    }));
    const securityStyle = useAnimatedStyle(() => ({ opacity: securityOpacity.value }));
    const heroStyle = useAnimatedStyle(() => ({ opacity: heroOpacity.value }));
    const buttonStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
            <StatusBar barStyle="light-content" />

            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
                <UniversalBackground
                    backgroundColor="#0C0C0C"
                    glowSize={350}
                    height={280}
                    showParticles={true}
                    particleCount={15}
                />
            </View>

            <View style={styles.header}>
                {isForced ? (
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleSwitchAccount}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <LogOut size={20} color="#8E8E93" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
                <Text style={styles.headerTitle}>Meu plano</Text>
                {!isForced ? (
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => router.back()}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={24} color="#8E8E93" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero */}
                <Animated.View style={[styles.heroSection, heroStyle]}>
                    <Text style={styles.heroTitle}>Conheça o Plano Pro</Text>
                    <Text style={styles.heroDescription}>
                        Recursos avançados para sua gestão financeira.
                    </Text>
                </Animated.View>

                {/* Main Card */}
                <Animated.View style={[styles.mainCard, mainCardStyle]}>
                    <View style={styles.planInfoRow}>
                        <View>
                            <Text style={styles.bigPlanName}>Pro</Text>
                            <Text style={styles.planSubtitle}>Recursos ilimitados</Text>
                        </View>

                        <View style={styles.priceContainer}>
                            <Text style={styles.priceAmount}>{priceString}</Text>
                            <Text style={styles.pricePeriod}>por mês</Text>
                        </View>
                    </View>
                </Animated.View>

                <Animated.View style={[styles.guaranteeCard, guaranteeCardStyle]}>
                    <View style={styles.guaranteeRow}>
                        <Shield size={16} color="#8E8E93" />
                        <Text style={styles.guaranteeText}>
                            7 dias de garantia incondicional
                        </Text>
                    </View>
                </Animated.View>

                {/* Botão de Compra */}
                {isIOS && (
                    <Animated.View style={[styles.purchaseSection, buttonStyle]}>
                        {isPro || alreadyPro ? (
                            <View style={styles.alreadyProBadge}>
                                <Check size={18} color="#4CAF50" />
                                <Text style={styles.alreadyProText}>
                                    Você já tem o Plano Pro ativo
                                </Text>
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[
                                        styles.purchaseButton,
                                        (iapLoading || !iapReady) && styles.purchaseButtonDisabled,
                                    ]}
                                    onPress={handlePurchase}
                                    activeOpacity={0.85}
                                    disabled={iapLoading || !iapReady}
                                >
                                    {iapLoading ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.purchaseButtonText}>Assinar Pro</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.restoreButton}
                                    onPress={handleRestore}
                                    activeOpacity={0.7}
                                    disabled={restoring}
                                >
                                    {restoring ? (
                                        <ActivityIndicator size="small" color="#8E8E93" />
                                    ) : (
                                        <View style={styles.restoreRow}>
                                            <RefreshCw size={13} color="#8E8E93" />
                                            <Text style={styles.restoreText}>
                                                Restaurar compras anteriores
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <Text style={styles.legalText}>
                                    A assinatura é renovada automaticamente pela App Store. Cancele a qualquer momento
                                    nas configurações do iPhone em Ajustes → Apple ID → Assinaturas.
                                </Text>
                            </>
                        )}
                    </Animated.View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 10,
    },
    heroSection: {
        marginBottom: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    heroDescription: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
        opacity: 0.8,
    },
    mainCard: {
        backgroundColor: '#151515',
        borderRadius: 24,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#252525',
    },
    planInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bigPlanName: {
        fontSize: 42,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -1,
    },
    planSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 4,
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    priceAmount: {
        fontSize: 22,
        fontWeight: '700',
        color: '#E0E0E0',
        letterSpacing: -0.5,
    },
    pricePeriod: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        marginTop: 2,
    },
    guaranteeCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginBottom: 24,
        alignSelf: 'center',
    },
    guaranteeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    guaranteeText: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '500',
    },
    purchaseSection: {
        marginTop: 8,
        marginBottom: 8,
    },
    purchaseButton: {
        backgroundColor: '#d97757',
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60,
    },
    purchaseButtonDisabled: {
        opacity: 0.5,
    },
    purchaseButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#000',
        letterSpacing: -0.3,
    },
    restoreButton: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    restoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    restoreText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    legalText: {
        fontSize: 11,
        color: '#555',
        textAlign: 'center',
        lineHeight: 16,
        paddingHorizontal: 8,
    },
    alreadyProBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    alreadyProText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4CAF50',
    },
});
