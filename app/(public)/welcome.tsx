import { ThemedText } from '@/components/themed-text';
import { UniversalBackground } from '@/components/UniversalBackground';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    View,
    ViewToken
} from 'react-native';

const { width } = Dimensions.get('window');
const WELCOME_STEP_DELAY_MS = 650;
const MOCKUP_CARD_WIDTH = Math.min(width * 0.68, 280);
const MOCKUP_COLORS = {
    surface: '#1A1A1A',
    surfaceRaised: '#141414',
    border: '#2A2A2A',
    borderSoft: 'rgba(255, 255, 255, 0.06)',
    accent: '#D97757',
    accentSoft: 'rgba(217, 119, 87, 0.14)',
    text: '#FFFFFF',
    muted: '#909090',
    subtle: '#666666',
};

const SLIDES = [
    {
        id: '1',
        title: 'Visualize\nSuas Finanças',
        description: 'Transforme a forma como você controla seu dinheiro com gráficos intuitivos e detalhados.',
    },
    {
        id: '2',
        title: 'Administre seu\nPatrimônio',
        description: 'Separe seu dinheiro em caixinhas, acompanhe sua poupança e construa sua reserva com disciplina.',
    },
    {
        id: '3',
        title: 'Tudo em\num só lugar',
        description: 'Gerencie contas, cartões e investimentos em uma plataforma única e segura.',
    },
];

// ─── Floating animation wrapper ───────────────────────────────────────────────

const AnimatedFloating = ({ children }: { children: React.ReactNode }) => {
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 0, duration: 3500, useNativeDriver: true }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [floatAnim]);

    const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

    return (
        <Animated.View style={{ transform: [{ translateY }] }}>
            {children}
        </Animated.View>
    );
};

// ─── Lottie com intervalo entre repetições ────────────────────────────────────

const IntervalLottie = ({ source, size = 26, interval = 4000 }: { source: any; size?: number; interval?: number }) => {
    const lottieRef = useRef<LottieView>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            lottieRef.current?.play();
        }, 300);

        const id = setInterval(() => {
            lottieRef.current?.play();
        }, interval);

        return () => { clearTimeout(timer); clearInterval(id); };
    }, [interval]);

    return (
        <LottieView
            ref={lottieRef}
            source={source}
            loop={false}
            autoPlay={false}
            style={{ width: size, height: size }}
            resizeMode="contain"
        />
    );
};

// ─── Card wrapper with per-card stacking layers ───────────────────────────────

type StackLayer = { translateX: number; translateY: number; scaleX: number; opacity: number };

const MockupCardWrapper = ({
    children,
    rotate,
    layer1,
    layer2,
}: {
    children: React.ReactNode;
    rotate: string;
    layer1: StackLayer;
    layer2: StackLayer;
}) => (
    <AnimatedFloating>
        <View style={styles.mockupStage}>
            <View>
                <View style={[styles.mockupCardLayer, {
                    transform: [{ rotate }, { translateY: layer2.translateY }, { translateX: layer2.translateX }, { scaleX: layer2.scaleX }],
                    opacity: layer2.opacity,
                }]} />
                <View style={[styles.mockupCardLayer, {
                    transform: [{ rotate }, { translateY: layer1.translateY }, { translateX: layer1.translateX }, { scaleX: layer1.scaleX }],
                    opacity: layer1.opacity,
                }]} />
                <View style={[styles.mockupShadowWrapper, { transform: [{ rotate }] }]}>
                    <View style={styles.mockupCard}>
                        {children}
                    </View>
                </View>
            </View>
        </View>
    </AnimatedFloating>
);

// ─── Mockup cards ─────────────────────────────────────────────────────────────

// Fatura: empilhamento para a direita
const MockupFatura = () => (
    <MockupCardWrapper
        rotate="-2deg"
        layer1={{ translateX: 7,  translateY: 5,  scaleX: 0.97, opacity: 0.55 }}
        layer2={{ translateX: 13, translateY: 10, scaleX: 0.94, opacity: 0.30 }}
    >
        <View style={styles.mockupHeaderRow}>
            <View style={styles.mockupTitleRow}>
                <View style={styles.mockupIconBox}>
                    <IntervalLottie source={require('@/assets/fatura.json')} interval={5000} />
                </View>
                <View>
                    <ThemedText style={styles.mockupTitle}>Fatura atual</ThemedText>
                    <ThemedText style={styles.mockupCaption}>Abril</ThemedText>
                </View>
            </View>
            <View style={styles.mockupPill}>
                <ThemedText style={styles.mockupPillText}>70%</ThemedText>
            </View>
        </View>
        <ThemedText style={styles.mockupAmount}>R$ 2.850,40</ThemedText>
        <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '70%' }]} />
        </View>
        <View style={styles.mockupFooterRow}>
            <ThemedText style={styles.mockupTinyLabel}>Disponível</ThemedText>
            <ThemedText style={styles.mockupTinyValue}>R$ 1.200</ThemedText>
        </View>
    </MockupCardWrapper>
);

// Dados das caixinhas — igual ao app real
const CAIXINHAS_DATA = [
    { name: 'Viagem',  guardado: 'R$ 3.200', meta: 'R$ 5.000',  pct: 64, prazo: 'Dez 2024'  },
    { name: 'Reserva', guardado: 'R$ 8.500', meta: 'R$ 10.000', pct: 85, prazo: 'Sem prazo' },
];

// Cor da barra igual à lógica real do app: <30% vermelho, 30–70% laranja, >70% verde
const progressColor = (pct: number) =>
    pct >= 70 ? '#04D361' : pct >= 30 ? '#FFB800' : '#FF4C4C';

const MockupCaixinhaCard = ({ name, guardado, meta, pct, prazo }: typeof CAIXINHAS_DATA[0]) => (
    <View style={styles.caixinhaCard}>
        {/* Linha de cima: lottie + nome/prazo + seta */}
        <View style={styles.caixinhaCardHeader}>
            <View style={styles.caixinhaIconBox}>
                <IntervalLottie source={require('@/assets/caixinhasamarelo.json')} size={22} interval={6000} />
            </View>
            <View style={{ flex: 1 }}>
                <ThemedText style={styles.caixinhaCardName}>{name}</ThemedText>
                <ThemedText style={styles.caixinhaCardPrazo}>{prazo}</ThemedText>
            </View>
            <ChevronRight size={14} color="#505050" strokeWidth={2} />
        </View>

        {/* Valores: Guardado / Meta */}
        <View style={styles.caixinhaAmounts}>
            <View>
                <ThemedText style={styles.caixinhaMicroLabel}>Guardado</ThemedText>
                <ThemedText style={styles.caixinhaGuardado}>{guardado}</ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <ThemedText style={styles.caixinhaMicroLabel}>Meta</ThemedText>
                <ThemedText style={styles.caixinhaMeta}>{meta}</ThemedText>
            </View>
        </View>

        {/* Barra de progresso */}
        <View style={styles.caixinhaBarTrack}>
            <View style={[styles.caixinhaBarFill, { width: `${pct}%`, backgroundColor: progressColor(pct) }]} />
        </View>
        <ThemedText style={[styles.caixinhaPct, { color: progressColor(pct) }]}>{pct}% concluído</ThemedText>
    </View>
);

const MockupMeta = () => (
    <MockupCardWrapper
        rotate="3deg"
        layer1={{ translateX: -7,  translateY: 5,  scaleX: 0.97, opacity: 0.55 }}
        layer2={{ translateX: -13, translateY: 10, scaleX: 0.94, opacity: 0.30 }}
    >
        {/* Header do card igual ao app */}
        <View style={[styles.mockupHeaderRow, { marginBottom: 10 }]}>
            <View style={styles.mockupTitleRow}>
                <View style={styles.mockupIconBox}>
                    <IntervalLottie source={require('@/assets/caixinhasamarelo.json')} interval={5000} />
                </View>
                <View>
                    <ThemedText style={styles.mockupTitle}>Caixinhas</ThemedText>
                    <ThemedText style={styles.mockupCaption}>2 objetivos ativos</ThemedText>
                </View>
            </View>
            <ThemedText style={styles.mockupHeaderValue}>R$ 11.700</ThemedText>
        </View>

        {/* Cards de caixinha individuais */}
        <View style={{ gap: 8 }}>
            {CAIXINHAS_DATA.map((c) => (
                <MockupCaixinhaCard key={c.name} {...c} />
            ))}
        </View>
    </MockupCardWrapper>
);

// Contas: empilhamento diagonal suave para baixo-esquerda
const MockupContas = () => (
    <MockupCardWrapper
        rotate="-1deg"
        layer1={{ translateX: -7,  translateY: 5,  scaleX: 0.97, opacity: 0.55 }}
        layer2={{ translateX: -13, translateY: 10, scaleX: 0.94, opacity: 0.30 }}
    >
        <View style={styles.mockupHeaderRow}>
            <View style={styles.mockupTitleRow}>
                <View style={styles.mockupIconBox}>
                    <IntervalLottie source={require('@/assets/banco.json')} interval={5000} />
                </View>
                <View>
                    <ThemedText style={styles.mockupTitle}>Contas</ThemedText>
                    <ThemedText style={styles.mockupCaption}>Open Finance</ThemedText>
                </View>
            </View>
            <ThemedText style={styles.mockupHeaderValue}>R$ 5.570</ThemedText>
        </View>

        <View style={styles.accountList}>
            <View style={styles.accountMiniRow}>
                <View style={styles.bankLottieBox}>
                    <IntervalLottie source={require('@/assets/banco.json')} size={18} interval={6000} />
                </View>
                <View style={styles.accountTextGroup}>
                    <ThemedText style={styles.accountName}>Itaú</ThemedText>
                    <ThemedText style={styles.accountType}>Corrente</ThemedText>
                </View>
                <ThemedText style={styles.accountValue}>R$ 4.320</ThemedText>
            </View>
            <View style={styles.accountMiniRow}>
                <View style={styles.bankLottieBox}>
                    <IntervalLottie source={require('@/assets/banco.json')} size={18} interval={6000} />
                </View>
                <View style={styles.accountTextGroup}>
                    <ThemedText style={styles.accountName}>Nubank</ThemedText>
                    <ThemedText style={styles.accountType}>Crédito</ThemedText>
                </View>
                <ThemedText style={styles.accountValue}>R$ 1.250</ThemedText>
            </View>
        </View>
    </MockupCardWrapper>
);

// ─── Slide ────────────────────────────────────────────────────────────────────

const AnimatedSlide = React.memo(function AnimatedSlide({ item, index, scrollX }: { item: typeof SLIDES[0], index: number, scrollX: Animated.Value }) {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
    const translateY = scrollX.interpolate({ inputRange, outputRange: [40, 0, 40], extrapolate: 'clamp' });
    const mockupScale = scrollX.interpolate({ inputRange, outputRange: [0.85, 1, 0.85], extrapolate: 'clamp' });
    const mockupTranslateY = scrollX.interpolate({ inputRange, outputRange: [60, -80, 60], extrapolate: 'clamp' });

    return (
        <View style={styles.slideContainer}>
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                <Animated.View style={{ opacity, transform: [{ scale: mockupScale }, { translateY: mockupTranslateY }], width: '100%', alignItems: 'center' }}>
                    {item.id === '1' && <MockupFatura />}
                    {item.id === '2' && <MockupMeta />}
                    {item.id === '3' && <MockupContas />}
                </Animated.View>
            </View>

            <Animated.View style={[styles.slideContent, { opacity, transform: [{ translateY }] }]}>
                <View style={styles.textContainer}>
                    <ThemedText style={styles.title}>{item.title}</ThemedText>
                    <ThemedText style={styles.description}>{item.description}</ThemedText>
                </View>
            </Animated.View>
        </View>
    );
});

// ─── Pagination dots ──────────────────────────────────────────────────────────

const PaginationDot = React.memo(function PaginationDot({ index, scrollX }: { index: number, scrollX: Animated.Value }) {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [6, 24, 6], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
    const backgroundColor = scrollX.interpolate({ inputRange, outputRange: ['#4b5563', '#D97757', '#4b5563'], extrapolate: 'clamp' });

    return <Animated.View style={[styles.dot, { width: dotWidth, opacity, backgroundColor }]} />;
});

// ─── Footer: voltar · dots · avançar ─────────────────────────────────────────

const Footer = React.memo(function Footer({
    scrollX,
    currentIndex,
    isAdvancing,
    onNext,
    onBack,
}: {
    scrollX: Animated.Value;
    currentIndex: number;
    isAdvancing: boolean;
    onNext: () => void;
    onBack: () => void;
}) {
    const isFirst = currentIndex === 0;
    const isLast  = currentIndex === SLIDES.length - 1;

    return (
        <View style={styles.footer}>
            {/* Botão voltar */}
            <Pressable
                onPress={onBack}
                disabled={isFirst}
                style={[styles.navBtn, { opacity: isFirst ? 0 : 1 }]}
                hitSlop={12}
            >
                <ChevronLeft size={22} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </Pressable>

            {/* Dots centralizados */}
            <View style={styles.dotsRow}>
                {SLIDES.map((_, i) => (
                    <PaginationDot key={i} index={i} scrollX={scrollX} />
                ))}
            </View>

            {/* Botão avançar / começar */}
            <Pressable
                onPress={onNext}
                disabled={isAdvancing}
                style={[styles.navBtn, isLast && styles.navBtnAccent]}
                hitSlop={12}
            >
                {isLast
                    ? <ThemedText style={styles.navBtnLabel}>Começar</ThemedText>
                    : <ChevronRight size={22} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                }
            </Pressable>
        </View>
    );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const slidesRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const viewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems?.length > 0 && viewableItems[0].index !== null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }, []);

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    useEffect(() => {
        return () => { if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current); };
    }, []);

    const scrollToNext = useCallback(() => {
        if (isAdvancing) return;
        setIsAdvancing(true);
        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);

        advanceTimeoutRef.current = setTimeout(() => {
            const nextIndex = currentIndex + 1;
            if (nextIndex < SLIDES.length) {
                slidesRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                setIsAdvancing(false);
            } else {
                router.push('/(public)/login');
            }
            advanceTimeoutRef.current = null;
        }, WELCOME_STEP_DELAY_MS);
    }, [currentIndex, isAdvancing, router]);

    const scrollToPrev = useCallback(() => {
        if (currentIndex === 0) return;
        const prevIndex = currentIndex - 1;
        slidesRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    }, [currentIndex]);

    const renderItem = useCallback(({ item, index }: { item: typeof SLIDES[0], index: number }) => (
        <AnimatedSlide item={item} index={index} scrollX={scrollX} />
    ), [scrollX]);

    const keyExtractor = useCallback((item: typeof SLIDES[0]) => item.id, []);

    return (
        <UniversalBackground backgroundColor="#0C0C0C" glowSize={600} showParticles={false}>
            <View style={styles.header}>
                <Image source={require('@/assets/images/icon.png')} style={styles.headerLogo} resizeMode="contain" />
            </View>

            <Animated.FlatList
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                scrollEnabled={!isAdvancing}
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                bounces={false}
                keyExtractor={keyExtractor}
                scrollEventThrottle={32}
                onViewableItemsChanged={viewableItemsChanged}
                viewabilityConfig={viewConfig}
                ref={slidesRef}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                removeClippedSubviews={false}
                initialNumToRender={SLIDES.length}
                windowSize={5}
            />

            <Footer
                scrollX={scrollX}
                currentIndex={currentIndex}
                isAdvancing={isAdvancing}
                onNext={scrollToNext}
                onBack={scrollToPrev}
            />
        </UniversalBackground>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    slideContainer: {
        width,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        paddingBottom: 60,
    },
    slideContent: {
        width: '100%',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        paddingHorizontal: 40,
        zIndex: 10,
    },
    mockupStage: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 38,
    },
    mockupShadowWrapper: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.48,
        shadowRadius: 28,
        elevation: 12,
        borderRadius: 24,
    },
    mockupCardLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
    },
    mockupCard: {
        width: MOCKUP_CARD_WIDTH,
        minHeight: 142,
        backgroundColor: MOCKUP_COLORS.surface,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: MOCKUP_COLORS.border,
        overflow: 'hidden',
    },
    mockupHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 13,
        gap: 12,
    },
    mockupTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        flex: 1,
        minWidth: 0,
    },
    mockupIconBox: {
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mockupIconBoxAccent: {
        backgroundColor: MOCKUP_COLORS.accentSoft,
        borderColor: 'rgba(217, 119, 87, 0.26)',
    },
    mockupTitle: {
        fontSize: 13,
        lineHeight: 16,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.text,
    },
    mockupCaption: {
        fontSize: 10,
        lineHeight: 13,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.subtle,
        marginTop: 1,
    },
    mockupPill: {
        paddingHorizontal: 8,
        height: 24,
        borderRadius: 8,
        backgroundColor: MOCKUP_COLORS.surfaceRaised,
        borderWidth: 1,
        borderColor: MOCKUP_COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mockupPillText: {
        fontSize: 10,
        lineHeight: 12,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.accent,
    },
    mockupAmount: {
        fontSize: 24,
        lineHeight: 29,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.text,
        letterSpacing: -0.2,
        marginBottom: 14,
    },
    progressTrack: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: MOCKUP_COLORS.accent,
        borderRadius: 3,
    },
    mockupFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    mockupTinyLabel: {
        fontSize: 10,
        lineHeight: 12,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.subtle,
    },
    mockupTinyValue: {
        fontSize: 10,
        lineHeight: 12,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.muted,
    },
    mockupHeaderValue: {
        fontSize: 13,
        lineHeight: 16,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.text,
    },
    // Card individual de caixinha (replica o visual do app)
    caixinhaCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 10,
        gap: 6,
    },
    caixinhaCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    caixinhaIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    caixinhaCardName: {
        fontSize: 12,
        fontFamily: 'AROneSans_400Regular',
        color: '#FFFFFF',
        lineHeight: 15,
    },
    caixinhaCardPrazo: {
        fontSize: 9,
        color: '#909090',
        lineHeight: 12,
    },
    caixinhaAmounts: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 2,
    },
    caixinhaMicroLabel: {
        fontSize: 9,
        color: '#909090',
        lineHeight: 12,
    },
    caixinhaGuardado: {
        fontSize: 14,
        fontFamily: 'AROneSans_400Regular',
        color: '#FFFFFF',
        lineHeight: 18,
    },
    caixinhaMeta: {
        fontSize: 11,
        fontFamily: 'AROneSans_400Regular',
        color: '#909090',
        lineHeight: 14,
    },
    caixinhaBarTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    caixinhaBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    caixinhaPct: {
        fontSize: 9,
        fontFamily: 'AROneSans_400Regular',
        lineHeight: 12,
    },
    accountList: {
        gap: 8,
    },
    accountMiniRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: MOCKUP_COLORS.surfaceRaised,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#262626',
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    bankLottieBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 9,
    },
    bankMark: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 9,
    },
    bankMarkItau: {
        backgroundColor: '#F5F5F5',
    },
    bankMarkNubank: {
        backgroundColor: '#820AD1',
    },
    bankMarkText: {
        fontSize: 10,
        lineHeight: 12,
        fontFamily: 'AROneSans_400Regular',
        color: '#FFFFFF',
    },
    accountTextGroup: {
        flex: 1,
        minWidth: 0,
    },
    accountName: {
        fontSize: 12,
        lineHeight: 15,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.text,
    },
    accountType: {
        fontSize: 9,
        lineHeight: 11,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.subtle,
        marginTop: 1,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    accountValue: {
        fontSize: 12,
        lineHeight: 15,
        fontFamily: 'AROneSans_400Regular',
        color: MOCKUP_COLORS.text,
    },
    textContainer: {
        alignItems: 'flex-start',
        width: '100%',
        marginTop: 12,
    },
    title: {
        fontSize: 36,
        fontWeight: '400',
        marginBottom: 12,
        textAlign: 'left',
        color: '#F0F0F0',
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    description: {
        textAlign: 'left',
        fontSize: 15,
        lineHeight: 22,
        color: 'rgba(255, 255, 255, 0.5)',
        maxWidth: '85%',
        fontWeight: '400',
        letterSpacing: -0.2,
    },
    // Footer navigation
    footer: {
        width: '100%',
        paddingHorizontal: 32,
        marginBottom: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
    },
    dot: {
        height: 6,
        borderRadius: 3,
        marginHorizontal: 4,
    },
    navBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navBtnAccent: {
        backgroundColor: '#D97757',
        borderColor: '#D97757',
        paddingHorizontal: 16,
        width: 'auto',
        borderRadius: 22,
    },
    navBtnLabel: {
        fontSize: 14,
        fontFamily: 'AROneSans_400Regular',
        color: '#FFF',
    },
    header: {
        position: 'absolute',
        top: 60,
        left: 40,
        zIndex: 100,
    },
    headerLogo: {
        width: 40,
        height: 40,
        borderRadius: 10,
    },
});
