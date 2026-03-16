import { UniversalBackground } from '@/components/UniversalBackground';
import { useRouter } from 'expo-router';
import { Check, Shield, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
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

    // Animações staggered (escalonadas) para cada card
    const mainCardOpacity = useSharedValue(0);
    const mainCardTranslateY = useSharedValue(30);
    const featuresCardOpacity = useSharedValue(0);
    const featuresCardTranslateY = useSharedValue(30);
    const guaranteeCardOpacity = useSharedValue(0);
    const guaranteeCardTranslateY = useSharedValue(30);
    const securityOpacity = useSharedValue(0);
    const heroOpacity = useSharedValue(0);

    useEffect(() => {
        // Card 1 - Main Card (delay 100ms)
        mainCardOpacity.value = withDelay(100, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
        mainCardTranslateY.value = withDelay(100, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));

        // Card 2 - Features Card (delay 200ms)
        featuresCardOpacity.value = withDelay(200, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
        featuresCardTranslateY.value = withDelay(200, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));

        // Card 3 - Guarantee Card (delay 300ms)
        guaranteeCardOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
        guaranteeCardTranslateY.value = withDelay(300, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));

        // Security section (delay 400ms)
        securityOpacity.value = withDelay(450, withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }));

        // Hero text (aparece primeiro)
        heroOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
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

    const securityStyle = useAnimatedStyle(() => ({
        opacity: securityOpacity.value,
    }));

    const heroStyle = useAnimatedStyle(() => ({
        opacity: heroOpacity.value,
    }));



    return (
        <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
            <StatusBar barStyle="light-content" />

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
                {/* Hero Section */}
                <Animated.View style={[styles.heroSection, heroStyle]}>
                    <Text style={styles.heroTitle}>Conheça o Plano{"\n"}Pro</Text>
                    <Text style={styles.heroDescription}>
                        Veja todos os recursos disponíveis no plano Pro.
                    </Text>
                </Animated.View>

                {/* Main Card - Plan Info */}
                <Animated.View style={[styles.mainCard, mainCardStyle]}>
                    {/* Plan Name */}
                    <View style={styles.planInfoRow}>
                        <View>
                            <Text style={styles.bigPlanName}>{proPlan.name}</Text>
                            <Text style={styles.planSubtitle}>Recursos ilimitados</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Attached Card - Features */}
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

                    {Platform.OS !== 'ios' && (
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
    // Main Card - igual minimalCard de subscription.tsx
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
    // Plan Info
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
    // Attached Card - igual attachedCard de subscription.tsx
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
    // Security Section
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
    paymentMethods: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    paymentIcon: {
        opacity: 0.7,
    },
    paymentText: {
        fontSize: 12,
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
});
