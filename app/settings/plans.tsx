import { UniversalBackground } from '@/components/UniversalBackground';
import { APP_LEGAL, PRO_SUBSCRIPTION_DISCLOSURE } from '@/constants/legal';
import { useAuthContext } from '@/contexts/AuthContext';
import {
    finishTransaction,
    getProOffering,
    initializePurchases,
    openSubscriptionManagement,
    PRO_PRODUCT_ID,
    PRO_PRICE_STRING,
    purchaseErrorListener,
    purchaseProSubscription,
    purchaseUpdatedListener,
    restorePurchases,
    syncAppleSubscriptionStatus,
    validatePurchaseWithBackend,
    type PurchaseError,
    type SubscriptionPurchase,
} from '@/services/iapService';
import { safeBack } from '@/utils/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { Check, LogOut, RefreshCw, Shield, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const isUserCancelledError = (error: any) => {
    const code = String(error?.code || '').toLowerCase();
    return code === 'e_user_cancelled' || code === 'user-cancelled';
};

const isAppleProviderValue = (value?: string | null) => {
    return ['apple', 'app_store', 'storekit'].includes(String(value || '').trim().toLowerCase());
};

export default function PlansScreen() {
    const router = useRouter();
    const { forced, setupPayment } = useLocalSearchParams();
    const isForced = forced === 'true';
    const isPaymentSetupIntent = setupPayment === 'true';
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
    const refreshProfileRef = useRef(refreshProfile);
    const purchaseHandledRef = useRef(false);
    const purchaseFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isIOS = Platform.OS === 'ios';
    const currentPlan = String(profile?.subscription?.plan ?? 'free').trim().toLowerCase();
    const currentStatus = String(profile?.subscription?.status ?? '').trim().toLowerCase();
    const currentProvider = String(
        (profile?.subscription as any)?.provider ||
        (profile?.subscription as any)?.paymentProvider ||
        (profile?.subscription as any)?.iapSource ||
        ''
    ).trim().toLowerCase();
    const isPro =
        (currentPlan === 'pro' || currentPlan === 'premium') &&
        (currentStatus === 'active' || currentStatus === 'trial' || currentStatus === 'trialing');
    const isManualPro =
        isPro &&
        (currentProvider === 'manual' || currentProvider === 'admin' || (profile?.subscription as any)?.manualGrant === true);
    const shouldSetupPayment = isIOS && (isPaymentSetupIntent || isManualPro);
    const hasActivePro = !shouldSetupPayment && (alreadyPro || (!iapReady && isPro));
    const profileProRef = useRef(isPro);

    useEffect(() => {
        refreshProfileRef.current = refreshProfile;
    }, [refreshProfile]);

    useEffect(() => {
        profileProRef.current = isPro;
    }, [isPro]);

    const clearPurchaseFallbackTimer = useCallback(() => {
        if (purchaseFallbackTimerRef.current) {
            clearTimeout(purchaseFallbackTimerRef.current);
            purchaseFallbackTimerRef.current = null;
        }
    }, []);

    useEffect(() => clearPurchaseFallbackTimer, [clearPurchaseFallbackTimer]);

    // Verifica status e inicializa StoreKit sempre que a tela entra em foco
    useFocusEffect(useCallback(() => {
        if (!user?.uid) return undefined;
        let cancelled = false;

        const setup = async () => {
            setIapReady(false);

            await initializePurchases(user.uid);
            const [statusResult, offeringResult] = await Promise.all([
                syncAppleSubscriptionStatus(user.uid),
                getProOffering(),
            ]);

            if (cancelled) return;

            setAlreadyPro(statusResult.success ? statusResult.hasPro : profileProRef.current);
            setPriceString(offeringResult.priceString);
            setIapReady(true);

            if (statusResult.success) {
                await refreshProfileRef.current();
            }
        };

        setup();
        return () => { cancelled = true; };
    }, [user?.uid]));

    // Listeners nativos do StoreKit
    useEffect(() => {
        if (!isIOS) return;

        const purchaseSub = purchaseUpdatedListener(async (purchase: SubscriptionPurchase) => {
            if (purchase.productId !== PRO_PRODUCT_ID) return;
            if (!user?.uid) return;
            if (purchaseHandledRef.current) return;

            setIapLoading(true);
            try {
                const result = await validatePurchaseWithBackend(user.uid, purchase);

                if (result.success) {
                    purchaseHandledRef.current = true;
                    clearPurchaseFallbackTimer();
                    await finishTransaction({ purchase, isConsumable: false });
                    const statusResult = await syncAppleSubscriptionStatus(user.uid);
                    setAlreadyPro(statusResult.hasPro || result.success);
                    await refreshProfileRef.current();
                    Alert.alert(
                        'Bem-vindo ao Pro!',
                        'Sua assinatura foi ativada com sucesso. Aproveite todos os recursos ilimitados.',
                        [{ text: 'Continuar', onPress: () => isForced ? router.replace('/(tabs)/dashboard') : safeBack(router) }]
                    );
                } else {
                    Alert.alert(
                        'Falha na ativação',
                        result.error ?? 'Não foi possível ativar a assinatura. Tente novamente.',
                        [{ text: 'OK' }]
                    );
                }
            } catch (error: any) {
                Alert.alert(
                    'Falha na ativacao',
                    error?.message ?? 'Nao foi possivel ativar a assinatura. Tente novamente.',
                    [{ text: 'OK' }]
                );
            } finally {
                setIapLoading(false);
            }
        });

        const errorSub = purchaseErrorListener((error: PurchaseError) => {
            if (isUserCancelledError(error)) {
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
    }, [user?.uid, isForced, isIOS, router, clearPurchaseFallbackTimer]);

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
        purchaseHandledRef.current = false;
        clearPurchaseFallbackTimer();
        try {
            await purchaseProSubscription();
            // O resultado normalmente chega pelo listener. Este fallback cobre casos
            // em que o StoreKit ja ativou a compra, mas o evento nao voltou para a tela.
            purchaseFallbackTimerRef.current = setTimeout(async () => {
                if (purchaseHandledRef.current || !user?.uid) return;

                const statusResult = await syncAppleSubscriptionStatus(user.uid);
                if (statusResult.hasPro && isAppleProviderValue(statusResult.provider)) {
                    purchaseHandledRef.current = true;
                    setAlreadyPro(true);
                    await refreshProfileRef.current();
                    setIapLoading(false);
                    Alert.alert(
                        'Bem-vindo ao Pro!',
                        'Sua assinatura foi ativada com sucesso. Aproveite todos os recursos ilimitados.',
                        [{ text: 'Continuar', onPress: () => isForced ? router.replace('/(tabs)/dashboard') : safeBack(router) }]
                    );
                    return;
                }

                setIapLoading(false);
            }, 4500);
        } catch (e: any) {
            if (isUserCancelledError(e)) {
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
            const statusResult = await syncAppleSubscriptionStatus(user.uid, { refreshServerStatus: true });
            const hasAppleRestored =
                result.hasPro ||
                (statusResult.hasPro && isAppleProviderValue(statusResult.provider));
            setAlreadyPro(hasAppleRestored || (!shouldSetupPayment && statusResult.hasPro));

            if (hasAppleRestored) {
                await refreshProfile();
                Alert.alert(
                    'Compra restaurada!',
                    'Sua assinatura Pro foi restaurada com sucesso.',
                    [{ text: 'OK', onPress: () => isForced ? router.replace('/(tabs)/dashboard') : safeBack(router) }]
                );
            } else {
                Alert.alert(
                    'Nenhuma compra encontrada',
                    'Nao encontramos uma assinatura Pro ativa nesta conta ou no Apple ID deste dispositivo.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error: any) {
            Alert.alert(
                'Erro ao restaurar',
                error?.message || 'Nao foi possivel restaurar as compras agora.',
                [{ text: 'OK' }]
            );
        } finally {
            setRestoring(false);
        }
    };

    const handleManageSubscription = async () => {
        try {
            await openSubscriptionManagement();
            if (user?.uid) {
                const statusResult = await syncAppleSubscriptionStatus(user.uid);
                setAlreadyPro(statusResult.hasPro);
                if (statusResult.success) await refreshProfile();
            }
        } catch (error: any) {
            Alert.alert(
                'Assinaturas da App Store',
                error?.message || 'Nao foi possivel abrir o gerenciamento de assinaturas.',
                [{ text: 'OK' }]
            );
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
                    particleCount={12}
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
                        onPress={() => safeBack(router)}
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

                <Animated.View style={[styles.disclosureCard, featuresCardStyle]}>
                    <View style={styles.disclosureRow}>
                        <Text style={styles.disclosureLabel}>Assinatura</Text>
                        <Text style={styles.disclosureValue}>{PRO_SUBSCRIPTION_DISCLOSURE.title}</Text>
                    </View>
                    <View style={styles.disclosureDivider} />
                    <View style={styles.disclosureRow}>
                        <Text style={styles.disclosureLabel}>Duracao</Text>
                        <Text style={styles.disclosureValue}>{PRO_SUBSCRIPTION_DISCLOSURE.duration}</Text>
                    </View>
                    <View style={styles.disclosureDivider} />
                    <View style={styles.disclosureRow}>
                        <Text style={styles.disclosureLabel}>Preco</Text>
                        <Text style={styles.disclosureValue}>{priceString} por mes</Text>
                    </View>
                    <View style={styles.disclosureDivider} />
                    <View style={styles.disclosureRow}>
                        <Text style={styles.disclosureLabel}>Renovacao</Text>
                        <Text style={styles.disclosureValue}>{PRO_SUBSCRIPTION_DISCLOSURE.renewal}</Text>
                    </View>
                </Animated.View>

                <Animated.View style={[styles.guaranteeCard, guaranteeCardStyle]}>
                    <View style={styles.guaranteeRow}>
                        <Shield size={16} color="#8E8E93" />
                        <Text style={styles.guaranteeText}>
                            Compra segura e gerenciada pela App Store
                        </Text>
                    </View>
                </Animated.View>

                {/* Botão de Compra */}
                {isIOS && (
                    <Animated.View style={[styles.purchaseSection, buttonStyle]}>
                        {hasActivePro ? (
                            <View>
                                <View style={styles.alreadyProBadge}>
                                    <Check size={18} color="#4CAF50" />
                                    <Text style={styles.alreadyProText}>
                                        Você já tem o Plano Pro ativo
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.restoreButton}
                                    onPress={handleManageSubscription}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.restoreText}>Gerenciar assinatura na App Store</Text>
                                </TouchableOpacity>
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
                                        <Text style={styles.purchaseButtonText}>
                                            {shouldSetupPayment ? 'Configurar pagamento' : 'Assinar Pro'}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                {shouldSetupPayment ? (
                                    <Text style={styles.setupPaymentText}>
                                        Seu Pro já está liberado. Configure a cobrança pela App Store para manter o acesso na próxima renovação.
                                    </Text>
                                ) : null}

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
                                    Plano Pro mensal. A assinatura e renovada automaticamente pela App Store, salvo
                                    cancelamento ate 24 horas antes do fim do periodo atual. Cancele a qualquer momento
                                    em Ajustes, Apple ID, Assinaturas.
                                </Text>
                            </>
                        )}

                    </Animated.View>
                )}

                <View style={styles.legalLinksContainer}>
                    <Text style={styles.legalIntro}>
                        Consulte os documentos legais da assinatura.
                    </Text>
                    <View style={styles.legalLinksRow}>
                        <TouchableOpacity
                            onPress={() => router.push('/settings/legal/privacy' as Href)}
                            accessibilityRole="link"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.legalLinkText}>{APP_LEGAL.privacyTitle}</Text>
                        </TouchableOpacity>
                        <Text style={styles.legalSeparator}>|</Text>
                        <TouchableOpacity
                            onPress={() => router.push('/settings/legal/terms' as Href)}
                            accessibilityRole="link"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.legalLinkText}>{APP_LEGAL.termsTitle}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

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
        letterSpacing: 0,
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
        letterSpacing: 0,
    },
    pricePeriod: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        marginTop: 2,
    },
    disclosureCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.035)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 16,
    },
    disclosureRow: {
        minHeight: 42,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
    },
    disclosureLabel: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0,
    },
    disclosureValue: {
        flex: 1,
        color: '#F5F5F7',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'right',
        lineHeight: 18,
    },
    disclosureDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
        letterSpacing: 0,
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
    setupPaymentText: {
        fontSize: 12,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 17,
        paddingHorizontal: 10,
        paddingTop: 12,
    },
    legalText: {
        fontSize: 11,
        color: '#555',
        textAlign: 'center',
        lineHeight: 16,
        paddingHorizontal: 8,
    },
    legalLinksContainer: {
        alignItems: 'center',
        marginTop: 10,
        paddingHorizontal: 8,
    },
    legalIntro: {
        color: '#6E6E73',
        fontSize: 11,
        lineHeight: 16,
        textAlign: 'center',
        marginBottom: 8,
    },
    legalLinksRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    legalLinkText: {
        color: '#d97757',
        fontSize: 12,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    legalSeparator: {
        color: '#4A4A4A',
        fontSize: 12,
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
