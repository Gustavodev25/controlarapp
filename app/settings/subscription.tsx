import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { databaseService } from '@/services/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import {
    AlertCircle,
    AlertTriangle,
    ChevronRight,
    CreditCard,
    RefreshCw,
    Rocket
} from 'lucide-react-native';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Types
interface PaymentHistoryItem {
    id: string;
    amount: number;
    status: 'paid' | 'pending' | 'failed';
    createdAt: any;
    paymentMethod?: {
        brand?: string;
        last4?: string;
    };
    invoiceUrl?: string;
}

interface SubscriptionData {
    plan: string;
    status: string;
    expiresAt?: any;
    startedAt?: any;
    billingCycle?: 'monthly' | 'yearly';
    price?: number;
    nextBillingDate?: string;
    cancelledAt?: any;
}

interface PaymentMethodData {
    type: string;
    brand?: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
}

// Helper Components
const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

const LoadingState = ({ dots }: { dots: string }) => (
    <View style={styles.loadingContainer}>
        <LottieView
            source={require('@/assets/carregando.json')}
            autoPlay
            loop
            style={{ width: 50, height: 50 }}
        />
        <Text style={styles.loadingText}>Carregando dados{dots}</Text>
    </View>
);

const EmptyHistoryState = () => (
    <View style={styles.emptyHistoryContainer}>
        <AlertCircle size={32} color="#666" />
        <Text style={styles.emptyHistoryText}>Nenhum pagamento registrado</Text>
        <Text style={styles.emptyHistorySubtext}>
            Seu histórico de pagamentos aparecerá aqui
        </Text>
    </View>
);

// Helpers
const formatDateSimple = (dateVal: any) => {
    try {
        if (!dateVal) return '';
        let d;
        if (typeof dateVal.toDate === 'function') {
            d = dateVal.toDate();
        } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
            d = new Date(dateVal);
        } else {
            d = new Date(dateVal);
        }

        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return '';
    }
};

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
};

const getCardBrandName = (brand?: string) => {
    if (!brand) return 'Cartão';
    const brands: Record<string, string> = {
        'visa': 'Visa',
        'mastercard': 'Mastercard',
        'amex': 'American Express',
        'elo': 'Elo',
        'hipercard': 'Hipercard',
        'diners': 'Diners Club',
        'credit_card': 'Cartão de Crédito',
    };
    return brands[brand.toLowerCase()] || brand;
};

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'active':
            return { label: 'Ativo', color: '#4CAF50' };
        case 'canceled':
        case 'cancelled':
            return { label: 'Cancelado', color: '#FF453A' };
        case 'past_due':
            return { label: 'Pagamento Pendente', color: '#FF9500' };
        case 'expired':
        case 'trial_expired':
            return { label: 'Vencido', color: '#FF453A' };
        case 'trial':
        case 'trialing':
            return { label: 'Período de Teste', color: '#007AFF' };
        case 'inactive':
            return { label: 'Inativo', color: '#FF453A' };
        case 'free':
        case 'starter':
            return { label: 'Gratuito', color: '#8E8E93' };
        default:
            return { label: 'Gratuito', color: '#8E8E93' };
    }
};

export default function SubscriptionSettingsScreen() {
    const router = useRouter();
    const { user, profile, refreshProfile } = useAuthContext();
    const insets = useSafeAreaInsets();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodData | null>(null);
    const [loadingDots, setLoadingDots] = useState('');

    // Animated loading dots
    useEffect(() => {
        if (!isLoading) return;
        const interval = setInterval(() => {
            setLoadingDots(prev => {
                if (prev === '...') return '';
                return prev + '.';
            });
        }, 500);
        return () => clearInterval(interval);
    }, [isLoading]);


    // Load subscription data from Firebase
    const loadSubscriptionData = useCallback(async () => {
        if (!user?.uid) return;

        try {
            // Get full subscription data
            const subResult = await databaseService.getFullSubscription(user.uid);


            if (subResult.success && subResult.data) {


                setSubscription(subResult.data.subscription);
                setPaymentMethod(subResult.data.paymentMethod);
            }

            // Get payment history
            const historyResult = await databaseService.getPaymentHistory(user.uid, 10);


            if (historyResult.success && historyResult.data) {
                setPaymentHistory(historyResult.data as PaymentHistoryItem[]);
            }
        } catch (error) {
            console.error('[Subscription] Error loading data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user?.uid]);

    // Initial load
    useEffect(() => {
        loadSubscriptionData();
    }, [loadSubscriptionData]);

    // Pull to refresh
    const onRefresh = async () => {
        setIsRefreshing(true);
        await refreshProfile();
        await loadSubscriptionData();
    };

    // Derived values - use profile data as fallback if subscription state is not yet loaded
    const currentSubscription = subscription || profile?.subscription;
    const currentPaymentMethod = paymentMethod || profile?.paymentMethod;

    const plan = String(currentSubscription?.plan || 'free').trim().toLowerCase();
    const status = String(currentSubscription?.status || 'free').trim().toLowerCase();
    const isPro = plan === 'pro' || plan === 'premium';
    const isTrial = status === 'trial' || status === 'trialing';
    const isCancelled = status === 'cancelled' || status === 'canceled';
    const isExpired = status === 'expired' || status === 'past_due' || status === 'trial_expired';
    const statusConfig = getStatusConfig(status);

    // Content Logic
    // - Sem plano = Starter
    // - Plano pro/premium com status trial = Trial
    // - Plano pro/premium com status active = Pro
    const planDisplay = !isPro ? 'Starter' : (isTrial ? 'Grátis' : 'Pro');
    const billingCycle = currentSubscription?.billingCycle || 'monthly';
    // Valor padrão do Pro é R$ 35,90
    const priceValue = currentSubscription?.price
        ? formatCurrency(currentSubscription.price)
        : (isPro ? 'R$ 35,90' : 'R$ 0,00');

    // Datas de renovação/vencimento removidas a pedido do usuário

    // Has valid payment method?
    const hasPaymentMethod = currentPaymentMethod && currentPaymentMethod.last4;

    // Fallback para paymentMethodDetails se não houver paymentMethod
    const paymentDetails = profile?.paymentMethodDetails;
    const displayPaymentMethod = hasPaymentMethod
        ? currentPaymentMethod
        : (paymentDetails?.last4 ? {
            brand: paymentDetails.brand,
            last4: paymentDetails.last4,
            expiryMonth: null,
            expiryYear: null,
            type: 'credit_card'
        } : null);

    const hasDisplayPaymentMethod = displayPaymentMethod && displayPaymentMethod.last4;

    // Expired plan helper for banner message
    const getExpiredInfo = () => {
        if (!isExpired || !isPro) return null;
        return { message: 'Seu plano está vencido. Regularize para continuar com acesso total.' };
    };
    const expiredInfo = getExpiredInfo();

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Background */}
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
                    onPress={() => router.back()}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Meu Plano</Text>
                <TouchableOpacity
                    onPress={onRefresh}
                    style={styles.refreshButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={isRefreshing}
                >
                    <RefreshCw
                        size={20}
                        color={isRefreshing ? '#666' : '#E0E0E0'}
                        style={isRefreshing ? { opacity: 0.5 } : undefined}
                    />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <LoadingState dots={loadingDots} />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor="#FFFFFF"
                            colors={['#FFFFFF']}
                        />
                    }
                >

                    {/* SECTION HEADER OUTSIDE */}
                    <SectionHeader title="PLANO ATUAL" />

                    {/* EXPIRED PLAN WARNING BANNER */}
                    {isExpired && isPro && expiredInfo && (
                        <View style={styles.expiredBanner}>
                            <View style={styles.expiredBannerContent}>
                                <AlertTriangle size={18} color="#FFF" />
                                <View style={styles.expiredBannerTextContainer}>
                                    <Text style={styles.expiredBannerTitle}>Plano Vencido</Text>
                                    <Text style={styles.expiredBannerMessage}>{expiredInfo.message}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* IMPROVED MINIMALIST CARD */}
                    <View style={[styles.minimalCard, isExpired && isPro && styles.minimalCardExpired]}>

                        {/* Top Row: Status & Renewal */}
                        <View style={styles.cardTopRow}>
                            <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
                                <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                                    {statusConfig.label}
                                </Text>
                            </View>
                            <Text style={styles.renewalText}>
                                {billingCycle === 'yearly' ? 'Anual' : 'Mensal'}
                            </Text>
                        </View>

                        {/* Main Content: Big Plan Name & Price/Expiry */}
                        <View style={styles.mainInfoContainer}>
                            <Text style={styles.bigPlanName} numberOfLines={1} adjustsFontSizeToFit>
                                {planDisplay}
                            </Text>
                            {isTrial ? (
                                // Trial - removida data de vencimento a pedido do usuário
                                <View style={styles.expiryContainer}>
                                    <Text style={styles.expiryLabel}>{billingCycle === 'yearly' ? 'Anual' : 'Mensal'}</Text>
                                </View>
                            ) : (
                                // Pro/Starter - mostra preço
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceValue}>{priceValue}</Text>
                                    <Text style={styles.period}>
                                        {billingCycle === 'yearly' ? 'Anual' : 'Mensal'}
                                    </Text>
                                </View>
                            )}
                        </View>

                    </View>

                    {/* ATTACHED CARD - Next Billing or Subscribe */}
                    <View style={styles.attachedCard}>
                        {isPro && !isTrial && !isCancelled && !isExpired ? (
                            // Pro ativo - mostra próxima cobrança
                            <View style={styles.nextBillingRow}>
                                <Text style={styles.nextBillingLabel}>Próxima cobrança</Text>
                                <View style={styles.nextBillingValueContainer}>
                                    <Text style={styles.nextBillingAmount}>{priceValue}</Text>
                                </View>
                            </View>
                        ) : isPro && (isCancelled || isExpired) ? (
                            // Plano cancelado ou expirado - mostra mensagem informativa
                            <View style={styles.upgradeRow}>
                                <View style={styles.upgradeTextContainer}>
                                    <Text style={styles.upgradeTitle}>
                                        {isCancelled ? 'Plano cancelado' : 'Plano vencido'}
                                    </Text>
                                    {Platform.OS !== 'ios' && (
                                        <Text style={styles.upgradeSubtitle}>
                                            Gerencie sua assinatura pelo site controlarmais.com.br
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ) : isTrial ? (
                            // Trial - mostra info
                            <View style={styles.upgradeRow}>
                                <View style={styles.upgradeTextContainer}>
                                    <Text style={styles.upgradeTitle}>Período de teste</Text>
                                    <Text style={styles.upgradeSubtitle}>Aproveite para conhecer todos os recursos.</Text>
                                </View>
                            </View>
                        ) : (
                            // Starter - mostra info sobre o plano
                            <View style={styles.upgradeRow}>
                                <View style={styles.upgradeTextContainer}>
                                    <Text style={styles.upgradeTitle}>Plano Starter</Text>
                                    <Text style={styles.upgradeSubtitle}>Você está usando o plano gratuito.</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* PAYMENT METHOD CARD */}
                    <SectionHeader title="PAGAMENTO" />
                    <View style={styles.paymentCard}>
                        {hasDisplayPaymentMethod ? (
                            <View style={styles.paymentRow}>
                                <View style={styles.paymentIconContainer}>
                                    <CreditCard size={24} color="#FFF" />
                                </View>
                                <View style={styles.cardInfo}>
                                    <Text style={styles.cardText}>
                                        {getCardBrandName(displayPaymentMethod?.brand)} •••• {displayPaymentMethod?.last4}
                                    </Text>
                                    {displayPaymentMethod?.expiryMonth && displayPaymentMethod?.expiryYear ? (
                                        <Text style={styles.cardSubtext}>
                                            Expira em {String(displayPaymentMethod.expiryMonth).padStart(2, '0')}/{displayPaymentMethod.expiryYear}
                                        </Text>
                                    ) : (
                                        // Tentar pegar do profile.paymentMethodDetails se disponível
                                        paymentDetails?.expiry && (
                                            <Text style={styles.cardSubtext}>
                                                Expira em {paymentDetails.expiry}
                                            </Text>
                                        )
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View style={styles.noPaymentMethod}>
                                <CreditCard size={24} color="#666" />
                                <Text style={styles.noPaymentText}>
                                    {isPro ? 'Nenhum método configurado' : 'Configure ao fazer upgrade'}
                                </Text>
                            </View>
                        )}
                    </View>


                    {/* COMING SOON SECTION */}
                    <SectionHeader title="NOVIDADES" />
                    <View style={styles.sectionCard}>
                        <View style={styles.comingSoonContainer}>
                            <Rocket size={24} color="#666" style={{ marginBottom: 16 }} />
                            <Text style={styles.comingSoonTitle}>Em breve</Text>
                            <Text style={styles.comingSoonText}>
                                Novas funcionalidades a caminho.
                            </Text>
                            <LinearGradient
                                colors={['transparent', '#151515']}
                                style={styles.fadeOverlay}
                            />
                        </View>
                    </View>



                    <View style={{ height: 100 }} />

                </ScrollView>
            )}

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
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    refreshButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    // Loading State
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    // Improved Minimalist Card Styles
    minimalCard: {
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
    attachedCard: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 20,
        borderWidth: 1,
        borderColor: '#252525',
        borderTopWidth: 1,
        marginBottom: 8,
    },
    upgradeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    upgradeTextContainer: {
        flex: 1,
        paddingRight: 16,
    },
    upgradeTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    upgradeSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
    },
    upgradeButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    upgradeButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#000000',
    },
    renewalText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    bigPlanName: {
        fontSize: 42,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -1,
        marginBottom: 0,
        includeFontPadding: false,
        flex: 1,
        marginRight: 10,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    priceValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#E0E0E0',
        letterSpacing: -0.5,
    },
    expiryContainer: {
        alignItems: 'flex-end',
    },
    expiryLabel: {
        fontSize: 11,
        color: '#8E8E93',
        fontWeight: '500',
        marginBottom: 2,
    },
    expiryDate: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E0E0E0',
    },
    period: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        marginLeft: 2,
    },
    // New Card Styles
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 100,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    mainInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nextBillingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    nextBillingLabel: {
        fontSize: 14,
        color: '#8E8E93',
        fontWeight: '500',
    },
    nextBillingValueContainer: {
        alignItems: 'flex-end',
    },
    nextBillingDate: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    nextBillingAmount: {
        fontSize: 12,
        color: '#666',
        fontWeight: '400',
        marginTop: 2,
    },
    // Section Headers
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginTop: 12,
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#151515',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#252525',
    },
    itemSeparatorInset: {
        height: 1,
        backgroundColor: '#2A2A2A',
        marginLeft: 64,
    },
    dangerButton: {
        marginTop: 32,
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 69, 58, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.15)',
    },
    dangerButtonText: {
        color: '#FF453A',
        fontSize: 15,
        fontWeight: '600',
    },
    // Payment Card
    paymentCard: {
        backgroundColor: '#151515',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#252525',
    },
    paymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    paymentIconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardInfo: {
        flex: 1,
    },
    cardText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
        marginBottom: 2,
    },
    cardSubtext: {
        fontSize: 13,
        color: '#8E8E93',
    },
    editButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#252525',
        borderRadius: 100,
    },
    editButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    noPaymentMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 8,
    },
    noPaymentText: {
        fontSize: 14,
        color: '#666',
    },
    // Invoice Items
    invoiceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#151515',
    },
    invoiceIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    invoiceContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    invoiceDate: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFF',
        marginBottom: 2,
    },
    invoiceStatus: {
        fontSize: 12,
        color: '#666',
    },
    invoiceAmount: {
        fontSize: 15,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    pdfBadge: {
        backgroundColor: '#252525',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    pdfText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#8E8E93',
    },
    // Empty History State
    emptyHistoryContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyHistoryText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#8E8E93',
        marginTop: 8,
    },
    emptyHistorySubtext: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
    },
    // Expired Plan Banner - Minimalist
    expiredBanner: {
        backgroundColor: '#151515',
        borderWidth: 1,
        borderColor: '#27272A',
        borderBottomWidth: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 20, // Restore balanced padding
        marginBottom: -1, // Overlap significantly to hide seam
        zIndex: 1, // Ensure it sits on top if needed
    },
    expiredBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 0,
    },
    expiredBannerTextContainer: {
        flex: 1,
    },
    expiredBannerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    expiredBannerMessage: {
        fontSize: 14,
        color: '#A1A1AA',
        lineHeight: 20,
    },
    expiredBannerButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 100,
        paddingVertical: 12,
        alignItems: 'center',
    },
    expiredBannerButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000000',
        letterSpacing: 0.2,
    },
    minimalCardExpired: {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderTopWidth: 0,
        borderColor: '#27272A',
        marginTop: -1, // Pull up to overlap with banner border
        paddingTop: 12, // Ensure content spacing is correct
        position: 'relative',
        zIndex: 0,
    },
    // Coming Soon
    comingSoonContainer: {
        paddingVertical: 32,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    comingSoonIconContainer: {
        // Not used in minimal version
    },
    comingSoonTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    comingSoonText: {
        fontSize: 13,
        color: '#555',
        textAlign: 'center',
    },
    // Fade Overlay
    fadeOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 48,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
});
