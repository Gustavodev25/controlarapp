import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import {
    checkProStatus,
    createSubscription,
    getProOffering,
    restorePurchases,
    setupStripePayment,
} from '@/services/iapService';
import { useRouter } from 'expo-router';
import { Check, RefreshCw, Shield, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Plan {
    id: 'starter' | 'pro';
    name: string;
    price: number;
    annualPrice: number;
    description: string;
    features: string[];
    buttonText: string;
    popular: boolean;
}

const proPlan: Plan = {
    id: 'pro',
    name: 'Pro',
    price: 35.90,
    annualPrice: 399.00,
    description: 'Todos os recursos avançados agora acessíveis.',
    features: [
        'Tudo do Gratuito',
        'Open Finance ilimitado',
        'Aurora IA ilimitada',
        'Consultor IA completo',
        'Módulo FIRE',
        'Relatórios avançados'
    ],
    buttonText: '',
    popular: true
};

export default function PlansScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, profile, refreshProfile } = useAuthContext();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------
    const [iapLoading, setIapLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [priceString, setPriceString] = useState('R$ 35,90');
    const [iapReady, setIapReady] = useState(false);
    const [alreadyPro, setAlreadyPro] = useState(false);

    const isIOS = Platform.OS === 'ios';
    const currentPlan = profile?.subscription?.plan ?? 'free';
    const currentStatus = profile?.subscription?.status ?? '';
    const isPro =
        (currentPlan === 'pro' || currentPlan === 'premium') &&
        (currentStatus === 'active' || currentStatus === 'trialing');

    // Verifica status ao abrir a tela
    useEffect(() => {
        if (!user?.uid) return;

        let cancelled = false;

        const setup = async () => {
            // Verifica se já tem Pro ativo
            const proActive = await checkProStatus(user.uid);
            if (cancelled) return;
            setAlreadyPro(proActive);

            // Carrega preço
            const { priceString: price } = await getProOffering();
            if (cancelled) return;
            setPriceString(price);
            setIapReady(true);
        };

        setup();
        return () => { cancelled = true; };
    }, [user?.uid]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handlePurchase = async () => {
        if (!user?.uid || !user?.email) {
            Alert.alert(
                'Autenticação necessária',
                'Faça login para assinar o plano Pro.',
                [{ text: 'OK' }]
            );
            return;
        }

        setIapLoading(true);
        try {
            // 1. Faz setup no backend (cria customer + setup intent)
            const setupResult = await setupStripePayment(
                user.uid,
                user.email,
                profile?.name
            );

            if (!setupResult.success || !setupResult.publishableKey) {
                Alert.alert(
                    'Erro',
                    setupResult.error || 'Não foi possível configurar o pagamento.',
                    [{ text: 'OK' }]
                );
                return;
            }

            // 2. Inicializa e apresenta o Stripe Payment Sheet (via useStripe hook)

            // Inicializa Payment Sheet
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: 'Controlar+',
                customerId: setupResult.customerId,
                customerEphemeralKeySecret: setupResult.ephemeralKey,
                setupIntentClientSecret: setupResult.setupIntentClientSecret,
                applePay: {
                    merchantCountryCode: 'BR',
                    paymentSummaryItems: [
                        {
                            label: 'Controlar+ Pro - Mensal',
                            amount: '35.90',
                            type: 'final',
                        },
                    ],
                },
                googlePay: {
                    merchantCountryCode: 'BR',
                    testEnv: false,
                },
                style: 'alwaysDark',
                returnURL: 'controlarapp://stripe-redirect',
            });

            if (initError) {
                console.error('[IAP] Erro ao inicializar Payment Sheet:', initError);
                Alert.alert(
                    'Erro no pagamento',
                    initError.message || 'Não foi possível abrir a tela de pagamento.',
                    [{ text: 'OK' }]
                );
                return;
            }

            // Apresenta Payment Sheet
            const { error: presentError } = await presentPaymentSheet();

            if (presentError) {
                if (presentError.code === 'Canceled') {
                    // Usuário cancelou
                    return;
                }
                Alert.alert(
                    'Erro no pagamento',
                    presentError.message || 'Não foi possível processar o pagamento.',
                    [{ text: 'OK' }]
                );
                return;
            }

            // 3. Payment Sheet confirmado — busca o payment method criado e cria a subscription
            // O setupIntent confirmado dá acesso ao payment method via backend
            // Precisamos buscar o setupIntent para obter o paymentMethodId
            const setupIntentId = setupResult.setupIntentClientSecret?.split('_secret_')[0];

            if (!setupIntentId) {
                Alert.alert('Erro', 'Falha ao obter dados do pagamento.', [{ text: 'OK' }]);
                return;
            }

            // Busca payment method ID via config endpoint (ou usa o que temos)
            // O backend pode recuperar do setupIntent
            const subscriptionResult = await createSubscription(
                user.uid,
                user.email,
                setupIntentId, // Backend resolverá o paymentMethodId do setupIntent
                profile?.name
            );

            if (subscriptionResult.alreadyActive) {
                await refreshProfile();
                Alert.alert(
                    'Plano já ativo! ✅',
                    'Você já possui uma assinatura Pro ativa.',
                    [{ text: 'OK', onPress: () => router.back() }]
                );
                return;
            }

            if (subscriptionResult.success) {
                await refreshProfile();
                Alert.alert(
                    'Bem-vindo ao Pro! 🎉',
                    'Sua assinatura foi ativada com sucesso. Aproveite todos os recursos ilimitados.',
                    [{ text: 'Continuar', onPress: () => router.back() }]
                );
            } else {
                Alert.alert(
                    'Falha na assinatura',
                    subscriptionResult.error ?? 'Não foi possível ativar a assinatura. Tente novamente.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error: any) {
            console.error('[IAP] Erro geral na compra:', error);
            Alert.alert(
                'Erro',
                'Ocorreu um erro inesperado. Tente novamente.',
                [{ text: 'OK' }]
            );
        } finally {
            setIapLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!user?.uid || !user?.email) return;

        setRestoring(true);
        try {
            const result = await restorePurchases(user.uid, user.email);

            if (result.hasPro) {
                await refreshProfile();
                Alert.alert(
                    'Compra restaurada!',
                    'Sua assinatura Pro foi restaurada com sucesso.',
                    [{ text: 'OK', onPress: () => router.back() }]
                );
            } else {
                Alert.alert(
                    'Nenhuma compra encontrada',
                    'Não encontramos uma assinatura Pro ativa vinculada a este email.',
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

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={24} color="#8E8E93" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero */}
                <Animated.View style={[styles.heroSection, heroStyle]}>
                    <Text style={styles.heroTitle}>Conheça o Plano{"\n"}Pro</Text>
                    <Text style={styles.heroDescription}>
                        Veja todos os recursos disponíveis no plano Pro.
                    </Text>
                </Animated.View>

                {/* Main Card */}
                <Animated.View style={[styles.mainCard, mainCardStyle]}>
                    <View style={styles.planInfoRow}>
                        <View>
                            <Text style={styles.bigPlanName}>{proPlan.name}</Text>
                            <Text style={styles.planSubtitle}>Recursos ilimitados</Text>
                        </View>

                        <View style={styles.priceContainer}>
                            <Text style={styles.priceAmount}>{priceString}</Text>
                            <Text style={styles.pricePeriod}>por mês</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Features Card */}
                <Animated.View style={[styles.attachedCard, featuresCardStyle]}>
                    <Text style={styles.featuresTitle}>O que está incluído:</Text>
                    <View style={styles.featuresContainer}>
                        {proPlan.features.map((feature, index) => (
                            <View key={index} style={styles.featureRow}>
                                <Check size={16} color="#d97757" />
                                <Text style={styles.featureText}>{feature}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Apple Pay badge */}
                    {isIOS && (
                        <View style={styles.applePayBadge}>
                            <Text style={styles.applePayText}> Pay disponível</Text>
                        </View>
                    )}

                    {!isIOS && (
                        <View style={styles.infoNote}>
                            <Text style={styles.infoNoteText}>
                                Gerencie sua assinatura pelo site controlarmais.com.br
                            </Text>
                        </View>
                    )}
                </Animated.View>

                {/* Guarantee Card */}
                <Animated.View style={[styles.guaranteeCard, guaranteeCardStyle]}>
                    <View style={styles.guaranteeRow}>
                        <Shield size={20} color="#4CAF50" />
                        <View style={styles.guaranteeContent}>
                            <Text style={styles.guaranteeTitle}>Garantia de satisfação</Text>
                            <Text style={styles.guaranteeText}>
                                Reembolso em até 7 dias úteis, sem perguntas.
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Botão de Compra */}
                {isIOS && (
                    <Animated.View style={[styles.purchaseSection, buttonStyle]}>
                        {isPro || alreadyPro ? (
                            /* Usuário já tem Pro */
                            <View style={styles.alreadyProBadge}>
                                <Check size={18} color="#4CAF50" />
                                <Text style={styles.alreadyProText}>
                                    Você já tem o Plano Pro ativo
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Botão principal de compra */}
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
                                        <>
                                            <Text style={styles.purchaseButtonText}>
                                                Assinar Pro
                                            </Text>
                                            <Text style={styles.purchaseButtonPrice}>
                                                {priceString}/mês • Apple Pay
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Restaurar compras */}
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

                                {/* Termos legais */}
                                <Text style={styles.legalText}>
                                    A assinatura é cobrada automaticamente via Stripe. Cancele a qualquer momento
                                    nas configurações do app ou pelo site.
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
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
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
    // Hero Section
    heroSection: {
        marginBottom: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 12,
        textAlign: 'center',
        lineHeight: 40,
    },
    heroDescription: {
        fontSize: 15,
        color: '#8E8E93',
        lineHeight: 22,
        textAlign: 'center',
    },
    // Main Card
    mainCard: {
        backgroundColor: '#151515',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        padding: 24,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: '#252525',
        marginBottom: 0,
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
    // Attached Card
    attachedCard: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 20,
        borderWidth: 1,
        borderColor: '#252525',
        borderTopWidth: 1,
        borderBottomWidth: 0,
        marginBottom: 0,
    },
    // Guarantee Card
    guaranteeCard: {
        backgroundColor: '#151515',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderWidth: 1,
        borderColor: '#252525',
        borderTopWidth: 1,
        marginBottom: 24,
    },
    guaranteeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    guaranteeContent: {
        flex: 1,
        flexDirection: 'column',
    },
    guaranteeTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    guaranteeText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    // Features
    featuresTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    featuresContainer: {
        marginBottom: 20,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    featureText: {
        fontSize: 14,
        color: '#CCC',
    },
    infoNote: {
        backgroundColor: 'rgba(142, 142, 147, 0.1)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    infoNoteText: {
        fontSize: 13,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 18,
    },
    // Apple Pay Badge
    applePayBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    applePayText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    // Purchase Section
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
    purchaseButtonPrice: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(0,0,0,0.6)',
        marginTop: 2,
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
    // Already Pro
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
    securitySection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
        marginBottom: 16,
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    securityText: {
        fontSize: 12,
        color: '#8E8E93',
    },
});
