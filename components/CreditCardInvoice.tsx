import BankSelector from '@/components/BankSelector';
import { CreditCardFilterModal, FilterState } from '@/components/CreditCardFilterModal';
import { CreditCardSettingsModal } from '@/components/CreditCardSettingsModal';
import { DeleteConfirmCard } from '@/components/DeleteConfirmCard';
import { RefundModal } from '@/components/RefundModal';
import { SwipeTutorial } from '@/components/SwipeTutorial';
import { TransactionOptionsModal } from '@/components/TransactionOptionsModal';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { useStackCardStyle } from '@/components/ui/StackCarousel';
import { useCategories } from '@/hooks/use-categories';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { databaseService, db } from '@/services/firebase';
import { isNonInstallmentMerchant } from '@/services/installmentRules';
import {
    buildInvoices,
    CreditCardAccount,
    formatCurrency,
    formatDateFull,
    formatDateShort,
    InvoiceBuildResult,
    InvoiceItem,
    Transaction
} from '@/services/invoiceBuilder';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient'; // Added
import { doc, onSnapshot } from 'firebase/firestore';
import {
    ArrowRightLeft,
    Baby,
    BookOpen,
    Car,
    Cat,
    Check,
    Clapperboard,
    Coffee,
    DollarSign,
    Dumbbell,
    Fuel,
    Gamepad2,
    Gift,
    GraduationCap,
    Heart,
    Home,
    Landmark,
    Music,
    Plane,
    RotateCcw,
    Settings,
    Shirt,
    ShoppingBag,
    ShoppingCart,
    Smartphone,
    Stethoscope,
    Trash2,
    Utensils,
    Wifi,
    Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    InteractionManager,
    LayoutAnimation,
    Platform,
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    FadeIn,
    FadeOut,
    interpolate,
    LinearTransition,
    runOnJS,
    type SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TimedLottieIcon = React.memo(({ source, style }: { source: any; style: any }) => (
    <DelayedLoopLottie
        source={source}
        style={style}
        delay={1000}
        initialDelay={100}
        jitterRatio={0.2}
        renderMode="HARDWARE"
    />
));
TimedLottieIcon.displayName = 'TimedLottieIcon';

type InvoiceTab = 'all' | 'last' | 'current' | `future_${number}`;

interface CarouselItemData {
    key: string;
    type: 'history' | 'invoice';
    label: string;
    subLabel?: string;
    amount?: number;
    dateRange?: string;
    dueInfo?: string;
    status: 'all' | 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';
    futureTotal?: number;
    tabId: InvoiceTab;
    itemCount?: number;
}

// Constantes do Carousel
const CARD_WIDTH = SCREEN_WIDTH - 40;
const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 500;

const SPRING_CONFIG = {
    damping: 15,
    stiffness: 120,
    mass: 0.8,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
};

const INVOICE_COMPUTE_WINDOW_MONTHS = 24;
const MAX_INVOICE_COMPUTE_ITEMS = 2000;
const INVOICE_BUILD_DEBOUNCE_MS = 80;

// Vertical Stack Animation Hook
const useVerticalStackCardStyle = (
    index: number,
    animatedIndex: SharedValue<number>,
    translateY: SharedValue<number>,
    totalCards: number,
    cardHeight: number
) => {
    return useAnimatedStyle(() => {
        // Calculate "dynamic index" based on gesture to allow smooth interpolation during drag
        // We assume dragging 1 cardHeight corresponds to 1 index change
        // Dragging UP (-Y) -> Increasing Index (Next Card) ? No.
        // Usually:
        // [0] Top
        // [1] Bottom
        // Drag up -> [0] moves up/away, [1] comes up to center.
        // So Drag Up (-Y) should INCREASE effective index (moving from 0 to 1).
        // interpolatedIndex = animatedIndex - (translateY / cardHeight)
        // If translateY is negative (drag up), index increases. Correct.

        const gestureOffsetIndex = -(translateY.value / cardHeight);
        const effectiveIndex = animatedIndex.value + gestureOffsetIndex;

        const diff = index - effectiveIndex;

        // Visual Configuration
        // diff = 0: Active Center
        // diff = 1: Next (Behind/Below)
        // diff = -1: Previous (Above/Gone)

        const zIndex = totalCards - index; // Lower index = Higher Z (on top) for stack
        // Wait, if 1 is behind 0, 0 must have higher Z.
        // So simple totalCards - index works if 0 is top.

        // Opacity
        const opacity = interpolate(
            diff,
            [-2, -1, 0, 1, 2],
            [0, 0, 1, 1, 0.6],
            Extrapolation.CLAMP
        );

        // Scale
        const scale = interpolate(
            diff,
            [-1, 0, 1, 2],
            [1, 1, 0.92, 0.85],
            Extrapolation.CLAMP
        );

        // TranslateY
        // If diff=0 -> 0
        // If diff=1 -> moved down (positive Y)
        // If diff=-1 -> moved up (negative Y)
        const yOffset = interpolate(
            diff,
            [-2, -1, 0, 1, 2],
            [-cardHeight * 1.5, -cardHeight, 0, 25, 45], // Stacking offsets
            Extrapolation.CLAMP
        );

        return {
            zIndex,
            opacity,
            transform: [
                { translateY: yOffset },
                { scale },
                // Add a slight perspective rotation
                { perspective: 1000 },
                { rotateX: `${interpolate(diff, [-1, 0, 1], [10, 0, -5], Extrapolation.CLAMP)}deg` }
            ]
        };
    });
};

// Stack Card Component
const StackCard = React.memo(({
    item,
    index,
    animatedIndex,
    translateX,
    totalCards,
    onPressCard
}: {
    item: CarouselItemData;
    index: number;
    animatedIndex: SharedValue<number>;
    translateX: SharedValue<number>;
    totalCards: number;
    onPressCard: (index: number) => void;
}) => {
    // Estilo animado principal do cartão - usando o mesmo hook do Dashboard (Visão Geral)
    const animatedStyle = useStackCardStyle(
        index,
        animatedIndex,
        translateX,
        totalCards,
        CARD_WIDTH,
        12, // Spacing
        true // Force all cards (including History at index 0) to stack
    );

    // IMPORTANTE: Este hook DEVE ser chamado incondicionalmente para evitar o erro
    // "Rendered more hooks than during the previous render"
    const futureBadgeAnimatedStyle = useAnimatedStyle(() => {
        const diff = Math.abs(index - animatedIndex.value);
        // Animação de entrada: desliza de cima (-20px) para a posição original (0px)
        const translateY = interpolate(diff, [0, 1], [0, -20], Extrapolation.CLAMP);
        // Opacidade: some rapidamente ao sair do foco
        const opacity = interpolate(diff, [0, 0.5], [1, 0], Extrapolation.CLAMP);
        // Escala: cresce levemente ao entrar
        const scale = interpolate(diff, [0, 1], [1, 0.8], Extrapolation.CLAMP);

        return {
            opacity,
            transform: [{ translateY }, { scale }],
            zIndex: diff < 0.5 ? -1 : -10
        };
    });

    // Verificar se deve mostrar o badge de futuro
    const showFutureBadge = item.futureTotal !== undefined && item.futureTotal > 0;

    return (
        <Animated.View style={[styles.stackCardWrapper, animatedStyle, { position: 'absolute' }]}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPressCard(index)}
                style={styles.invoiceCard}
            >
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View style={styles.carouselHeader}>
                        <View style={[styles.carouselHeaderLeft, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                            <TimedLottieIcon
                                source={require('@/assets/papel.json')}
                                style={{ width: 20, height: 20 }}
                            />
                            <View>
                                <Text style={styles.carouselLabel}>{item.label}</Text>
                                {item.status !== 'all' && (
                                    <Text style={styles.carouselDueInline}>{item.dueInfo}</Text>
                                )}
                            </View>
                        </View>
                        {item.status !== 'all' && (
                            <View style={[styles.statusBadge, { backgroundColor: item.status === 'CLOSED' ? '#F75555' : item.status === 'PAID' ? '#04D361' : '#EAB308' }]}>
                                <Text style={[styles.statusBadgeText, { color: '#000' }]}>
                                    {item.status === 'CLOSED' ? 'FECHADA' : item.status === 'PAID' ? 'PAGA' : 'ABERTA'}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.carouselContent}>
                        <Text style={styles.carouselAmount}>
                            {formatCurrency(Math.abs(item.amount || 0))}
                        </Text>
                        <Text style={styles.carouselDate}>{item.dateRange}</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {showFutureBadge && (
                <Animated.View style={[styles.futureTotalBadge, futureBadgeAnimatedStyle]}>
                    <Text style={styles.futureTotalLabel}>Total Futuro:</Text>
                    <Text style={styles.futureTotalValue}>{formatCurrency(item.futureTotal || 0)}</Text>
                </Animated.View>
            )}
        </Animated.View>
    );
});
StackCard.displayName = 'InvoiceCarouselStackCard';

const InvoiceCarousel = React.memo(({
    invoiceData,
    selectedTab,
    onTabChange,
    historyTotal
}: {
    invoiceData: InvoiceBuildResult;
    selectedTab: InvoiceTab;
    onTabChange: (tab: InvoiceTab) => void;
    historyTotal: number;
}) => {
    const [currentIndex, setCurrentIndex] = useState(2); // Começa em "Fatura Atual"
    const animatedIndex = useSharedValue(2);
    const translateX = useSharedValue(0);
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('hasSeenInvoiceSwipeTutorial').then((value) => {
            if (!value) {
                setShowTutorial(true);
            }
        });
    }, []);

    const data = useMemo(() => {
        const items: CarouselItemData[] = [
            {
                key: 'history',
                type: 'history',
                label: 'Histórico',
                subLabel: 'Transações passadas',
                amount: historyTotal,
                dateRange: 'Todas as transações',
                status: 'all',
                tabId: 'all'
            },
            {
                key: 'last',
                type: 'invoice',
                label: 'Última Fatura',
                // Soma o valor absoluto de todos os items (exceto pagamentos)
                // Soma os valores reais (despesas aumentam, estornos diminuem)
                amount: Math.abs(invoiceData.closedInvoice.total || 0),
                dateRange: `${formatDateShort(invoiceData.periods.lastInvoiceStart)} –  ${formatDateShort(invoiceData.periods.lastClosingDate)}`,
                dueInfo: `Venceu ${formatDateFull(invoiceData.periods.lastDueDate)}`,
                status: invoiceData.closedInvoice.status,
                tabId: 'last',
                itemCount: invoiceData.closedInvoice.items.length
            },
            {
                key: 'current',
                type: 'invoice',
                label: 'Fatura Atual',
                // Soma o valor absoluto de todos os items (exceto pagamentos)
                // Soma os valores reais (despesas aumentam, estornos diminuem)
                amount: Math.abs(invoiceData.currentInvoice.total || 0),
                dateRange: `${formatDateShort(invoiceData.periods.currentInvoiceStart)} –  ${formatDateShort(invoiceData.periods.currentClosingDate)}`,
                dueInfo: `Vence ${formatDateFull(invoiceData.periods.currentDueDate)}`,
                status: 'OPEN',
                tabId: 'current',
                itemCount: invoiceData.currentInvoice.items.length
            }
        ];

        // Future invoices - Show ONLY the immediate next invoice
        if (invoiceData.futureInvoices.length > 0) {
            const inv = invoiceData.futureInvoices[0];
            items.push({
                key: 'future_0',
                type: 'invoice',
                label: 'Próxima Fatura',
                // Soma o valor absoluto de todos os items (exceto pagamentos)
                // Soma os valores reais (despesas aumentam, estornos diminuem)
                amount: Math.abs(inv.total || 0),
                dateRange: `${formatDateShort(new Date(inv.startDate))} –  ${formatDateShort(new Date(inv.closingDate))}`,
                dueInfo: `Vence ${formatDateFull(new Date(inv.dueDate))}`,
                status: 'OPEN',
                tabId: 'future_0' as InvoiceTab,
                futureTotal: invoiceData.allFutureTotal,
                itemCount: inv.items.length
            });
        }

        return items;
    }, [invoiceData, historyTotal]);

    const goToCard = useCallback((index: number, emit = true) => {
        if (index >= 0 && index < data.length && index !== currentIndex) {
            animatedIndex.value = withSpring(index, SPRING_CONFIG);
            setCurrentIndex(index);
            if (emit && data[index]) {
                onTabChange(data[index].tabId);
            }
        }
    }, [data, currentIndex, animatedIndex, onTabChange]);

    const goToNextCard = useCallback(() => {
        goToCard(currentIndex + 1);
    }, [currentIndex, goToCard]);

    const goToPrevCard = useCallback(() => {
        goToCard(currentIndex - 1);
    }, [currentIndex, goToCard]);

    // Sync with external selectedTab prop
    useEffect(() => {
        const targetIndex = data.findIndex(item => item.tabId === selectedTab);
        if (targetIndex !== -1 && targetIndex !== currentIndex) {
            goToCard(targetIndex, false);
        }
    }, [selectedTab, data, currentIndex, goToCard]);

    const dismissTutorial = useCallback(() => {
        setShowTutorial(false);
        AsyncStorage.setItem('hasSeenInvoiceSwipeTutorial', 'true');
    }, []);

    const handleCardPress = useCallback((index: number) => {
        dismissTutorial();
        goToCard(index);
    }, [dismissTutorial, goToCard]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            runOnJS(dismissTutorial)();
        })
        .onUpdate((event) => {
            const maxDrag = CARD_WIDTH * 0.5;
            translateX.value = Math.max(-maxDrag, Math.min(maxDrag, event.translationX));
        })
        .onEnd((event) => {
            const { translationX: tx, velocityX } = event;
            if (tx < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
                runOnJS(goToNextCard)();
            } else if (tx > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
                runOnJS(goToPrevCard)();
            }
            translateX.value = withSpring(0, SPRING_CONFIG);
        });

    return (
        <View style={styles.carouselContainer}>
            <View style={styles.stackContainer}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={styles.gestureContainer}>
                        {data.map((item, index) => (
                            <StackCard
                                key={item.key}
                                item={item}
                                index={index}
                                animatedIndex={animatedIndex}
                                translateX={translateX}
                                totalCards={data.length}
                                onPressCard={handleCardPress}
                            />
                        ))}
                        <SwipeTutorial
                            visible={showTutorial}
                            onDismiss={dismissTutorial}
                            style={{ borderRadius: 16, zIndex: 999 }}
                            size={48}
                        />
                    </Animated.View>
                </GestureDetector>

                <View style={styles.paginationOverlay}>
                    {data.map((item, index) => (
                        <TouchableOpacity
                            key={item.key}
                            onPress={() => goToCard(index)}
                            style={styles.dotTouchable}
                        >
                            <View style={[
                                styles.paginationDot,
                                index === currentIndex && styles.paginationDotActive
                            ]} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
    );
});
InvoiceCarousel.displayName = 'InvoiceCarousel';

interface CreditCardInvoiceProps {
    transactions: Transaction[];
    creditCards: CreditCardAccount[];
    userId: string;
    onRefresh?: () => Promise<void>;
    refreshing?: boolean;
    onLoadMoreHistory?: () => Promise<void> | void;
    hasMoreHistory?: boolean;
    loadingMoreHistory?: boolean;
    onNavigateToOpenFinance?: () => void;
}

// Removed local categoryTranslations and translateCategory in favor of useCategories hook
/*
const categoryTranslations: Record<string, string> = { ... };
const translateCategory = (category?: string) => { ... };
*/

// Função movida para fora do componente para evitar recriação, mas getCategoryConfig depende de cores...
// Movo ela de volta para dentro ou crio uma versão que aceita cores? 
// No momento, vou restaurar o getCategoryConfig mas simplificado ou importado?
// Melhor: Vou recriar as funções aqui, pois elas são puras, MAS o translateCategory agora é via hook.

// Re-implementing helper functions locally or importing if available.
// Since getCategoryConfig suggests colors, keep it here for now but renamed or scoped?
// User wants dynamic categories. The hook gives `getCategoryName`.
// The `getCategoryConfig` is for ICONS and COLORS, based on keywords. 
// It should largely remain but perhaps check the CUSTOM LABEL too? 
// For now, let's keep `getCategoryConfig` but defined BEFORE it's used.

// ... Wait, I deleted them in the previous step but the linter complained they are missing.
// I will restore `getCategoryConfig` and integrate `useCategories` hook inside the component.

const getCategoryConfig = (category?: string) => {
    const cat = category?.toLowerCase() || '';

    // Color Palette (Premium & Dark Mode Friendly)
    const colors = {
        transport: '#FF9F0A',     // Orange
        food: '#FF453A',          // Red
        shopping: '#30D158',      // Green
        health: '#64D2FF',        // Cyan
        bills: '#FFD60A',         // Yellow
        home: '#AC8E68',          // Gold/Brown (Warm)
        entertainment: '#FF375F', // Pink (High Energy)
        tech: '#0A84FF',          // Blue
        income: '#32D74B',        // Bright Green
        gray: '#8E8E93',          // Neutral
        finance: '#A2845E'        // Bronze
    };

    // Helper to get rgba with opacity
    const getBg = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        const r = result ? parseInt(result[1], 16) : 128;
        const g = result ? parseInt(result[2], 16) : 128;
        const b = result ? parseInt(result[3], 16) : 128;
        return `rgba(${r}, ${g}, ${b}, 0.15)`; // 15% opacity for background
    };

    let icon = ShoppingBag;
    let color = colors.gray;

    // Transport
    if (cat.includes('uber') || cat.includes('99') || cat.includes('transport') || cat.includes('taxi') || cat.includes('cab')) { icon = Car; color = colors.transport; }
    else if (cat.includes('fuel') || cat.includes('gas') || cat.includes('posto') || cat.includes('shell') || cat.includes('ipiranga')) { icon = Fuel; color = colors.transport; }
    else if (cat.includes('parking') || cat.includes('estacionamento') || cat.includes('park')) { icon = Car; color = colors.transport; }
    else if (cat.includes('auto') || cat.includes('repair') || cat.includes('mecanic') || cat.includes('manuten')) { icon = Settings; color = colors.transport; }

    // Travel
    else if (cat.includes('flight') || cat.includes('airline') || cat.includes('travel') || cat.includes('viagem') || cat.includes('latam') || cat.includes('azul')) { icon = Plane; color = colors.tech; }

    // Food
    else if (cat.includes('food') || cat.includes('burger') || cat.includes('ifood') || cat.includes('rappi') || cat.includes('comida') || cat.includes('delivery')) { icon = Utensils; color = colors.food; }
    else if (cat.includes('restaurant') || cat.includes('restaurante') || cat.includes('outback') || cat.includes('madero')) { icon = Utensils; color = colors.food; }
    else if (cat.includes('coffee') || cat.includes('cafe') || cat.includes('starbucks')) { icon = Coffee; color = colors.home; }
    else if (cat.includes('market') || cat.includes('grocer') || cat.includes('supermercado') || cat.includes('mercado') || cat.includes('carrefour') || cat.includes('extra')) { icon = ShoppingCart; color = colors.bills; }

    // Shopping
    else if (cat.includes('shop') || cat.includes('store') || cat.includes('amazon') || cat.includes('mercado livre') || cat.includes('compras')) { icon = ShoppingBag; color = colors.tech; }
    else if (cat.includes('cloth') || cat.includes('apparel') || cat.includes('fashion') || cat.includes('roupa') || cat.includes('vestu')) { icon = Shirt; color = colors.tech; }
    else if (cat.includes('eletron') || cat.includes('tech') || cat.includes('apple') || cat.includes('sams')) { icon = Smartphone; color = '#0A84FF'; }

    // Home / Utilities
    else if (cat.includes('home') || cat.includes('house') || cat.includes('casa') || cat.includes('rent') || cat.includes('aluguel')) { icon = Home; color = colors.home; }
    else if (cat.includes('internet') || cat.includes('wifi') || cat.includes('vivo') || cat.includes('claro') || cat.includes('tim')) { icon = Wifi; color = colors.home; }
    else if (cat.includes('light') || cat.includes('water') || cat.includes('luz') || cat.includes('agua') || cat.includes('energy') || cat.includes('energia')) { icon = Zap; color = colors.bills; }

    // Entertainment
    else if (cat.includes('game') || cat.includes('steam') || cat.includes('xbox') || cat.includes('playstation') || cat.includes('nintendo') || cat.includes('jogos')) { icon = Gamepad2; color = colors.entertainment; }
    else if (cat.includes('movie') || cat.includes('film') || cat.includes('cinema') || cat.includes('netflix') || cat.includes('disney') || cat.includes('hbo') || cat.includes('tv')) { icon = Clapperboard; color = colors.entertainment; }
    else if (cat.includes('music') || cat.includes('spotify') || cat.includes('apple music') || cat.includes('show')) { icon = Music; color = colors.entertainment; }

    // Health
    else if (cat.includes('health') || cat.includes('doctor') || cat.includes('med') || cat.includes('hosp') || cat.includes('clinica') || cat.includes('saude')) { icon = Heart; color = colors.health; }
    else if (cat.includes('pharmacy') || cat.includes('drug') || cat.includes('farma') || cat.includes('drogasil')) { icon = Stethoscope; color = colors.health; }
    else if (cat.includes('gym') || cat.includes('fit') || cat.includes('sport') || cat.includes('academia') || cat.includes('smart')) { icon = Dumbbell; color = '#30D158'; }

    // Family / Education
    else if (cat.includes('school') || cat.includes('college') || cat.includes('univ') || cat.includes('educa') || cat.includes('curso') || cat.includes('udemy')) { icon = GraduationCap; color = '#FF9F0A'; }
    else if (cat.includes('book') || cat.includes('livro') || cat.includes('read')) { icon = BookOpen; color = '#FF9F0A'; }
    else if (cat.includes('pet') || cat.includes('dog') || cat.includes('cat') || cat.includes('vet')) { icon = Cat; color = '#AC8E68'; }
    else if (cat.includes('baby') || cat.includes('kid') || cat.includes('child') || cat.includes('filh')) { icon = Baby; color = '#FFD60A'; }

    // Finance
    else if (cat.includes('transfer') || cat.includes('send') || cat.includes('pix')) { icon = ArrowRightLeft; color = colors.gray; }
    else if (cat.includes('bank') || cat.includes('banco') || cat.includes('fee') || cat.includes('taxa') || cat.includes('tax')) { icon = Landmark; color = colors.gray; }
    else if (cat.includes('salary') || cat.includes('income') || cat.includes('salario') || cat.includes('pagamento')) { icon = DollarSign; color = colors.income; }
    else if (cat.includes('gift') || cat.includes('present')) { icon = Gift; color = '#FF375F'; }

    return { icon, color, backgroundColor: getBg(color) };
};

// Cache do Intl.DateTimeFormat para performance
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const monthShortFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const monthLongFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

// Função movida para fora do componente para evitar recriação
const formatTransactionDate = (dateString: string): string => {
    try {
        const [y, m, d] = dateString.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return dateFormatter.format(date);
    } catch (e) { return dateString; }
};

const getMonthShortUpper = (date: Date) => monthShortFormatter.format(date).toUpperCase().replace('.', '');
const getMonthLongUpper = (date: Date) => monthLongFormatter.format(date).toUpperCase();
const formatCardDisplayName = (rawName?: string | null, maxLength = 20): string => {
    const baseName = (rawName || '').trim() || 'Cartão';
    const capitalized = `${baseName.charAt(0).toLocaleUpperCase('pt-BR')}${baseName.slice(1)}`;
    if (capitalized.length <= maxLength) return capitalized;
    return `${capitalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

// Memoizado para evitar re-renders desnecessários
const TransactionItem = React.memo(({
    item,
    index,
    total,
    onDelete,
    onRefund,
    onLongPress,
    getCategoryName,
    isConfirmingDelete,
    onCancelDelete,
    animateRow = true
}: {
    item: InvoiceItem;
    index: number;
    total: number;
    onDelete?: (item: InvoiceItem) => void;
    onRefund?: (item: InvoiceItem) => void;
    onLongPress?: (item: InvoiceItem) => void;
    getCategoryName: (key?: string) => string;
    isConfirmingDelete?: boolean;
    onCancelDelete?: () => void;
    animateRow?: boolean;
}) => {
    const [showActions, setShowActions] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Efeito para sincronizar pedido de exclusão externo
    useEffect(() => {
        if (isConfirmingDelete) {
            setShowDeleteConfirm(true);
        }
    }, [isConfirmingDelete]);

    const isExpense = item.type === 'expense';
    const isPayment = item.isPayment;
    const isProjected = item.isProjected;
    const isRefund = item.isRefund;
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const cardRef = React.useRef<View>(null);
    const hideInstallments = isNonInstallmentMerchant(item.description);

    // Pode fazer estorno apenas se: não é projetada, não é pagamento, não é estorno
    const canRefund = !isProjected && !isPayment && !isRefund;

    const amountColor = isPayment || isRefund ? '#04D361' : (isProjected ? '#60BC57' : '#FFFFFF');

    // Se estiver confirmando exclusão, mostra o card de confirmação
    if (showDeleteConfirm) {
        return (
            <View style={{ marginBottom: isLast ? 0 : 1, marginHorizontal: 20 }}>
                <DeleteConfirmCard
                    title="Excluir transação?"
                    onCancel={() => {
                        setShowDeleteConfirm(false);
                        if (onCancelDelete) onCancelDelete();
                    }}
                    onConfirm={() => {
                        onDelete?.(item);
                        setShowDeleteConfirm(false);
                        setShowActions(false);
                        if (onCancelDelete) onCancelDelete(); // Limpa estado pai também
                    }}
                    style={{
                        borderRadius: 16,
                        height: 72,
                        borderTopLeftRadius: isFirst ? 16 : 0,
                        borderTopRightRadius: isFirst ? 16 : 0,
                        borderBottomLeftRadius: isLast ? 16 : 0,
                        borderBottomRightRadius: isLast ? 16 : 0,
                        backgroundColor: '#151515',
                        borderWidth: 1,
                        borderColor: '#252525'
                    }}
                />
            </View>
        );
    }

    // Margens aplicadas aos cards individuais
    const borderStyle = {
        borderTopLeftRadius: isFirst ? 16 : 0,
        borderTopRightRadius: isFirst ? 16 : 0,
        borderBottomLeftRadius: isLast ? 16 : 0,
        borderBottomRightRadius: isLast ? 16 : 0,
        marginTop: index === 0 ? 0 : -1,
    };



    // We we overwrite the default styles with our better looking ones
    const { icon: CategoryIcon, color: categoryColor, backgroundColor: categoryBg } = getCategoryConfig(item.category || item.description);

    const handlePress = () => {
        if (showActions) {
            setShowActions(false);
            return;
        }
    };

    const handleLongPress = () => {
        if (onLongPress) {
            onLongPress(item);
        } else if (onDelete) {
            setShowActions(true);
        }
    };

    const handleDelete = () => {
        setShowDeleteConfirm(true); // Show local confirm card
    };

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={300} // Slightly faster than default
            disabled={false}
            style={{ width: '100%' }}
        >
            <Animated.View
                ref={cardRef}
                layout={animateRow ? LinearTransition.duration(300) : undefined}
                entering={animateRow ? FadeIn.duration(400) : undefined}
                exiting={animateRow ? FadeOut.duration(200) : undefined}
                style={[
                    styles.transactionCard,
                    borderStyle
                ]}
            >
                <View style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: categoryBg,
                    justifyContent: 'center', alignItems: 'center',
                    marginRight: 12,
                    borderWidth: 1,
                    borderColor: categoryColor + '20' // Subtle border
                }}>
                    <CategoryIcon size={20} color={categoryColor} strokeWidth={2.5} />
                </View>

                <View style={styles.detailsContainer}>
                    <View style={styles.descriptionRow}>
                        <Text style={styles.description} numberOfLines={1}>
                            {item.description}
                        </Text>
                        {isPayment && (
                            <View style={styles.paymentBadge}>
                                <Check size={10} color="#04D361" />
                                <Text style={styles.paymentBadgeText}>PAGO</Text>
                            </View>
                        )}
                        {isRefund && (
                            <View style={[styles.paymentBadge, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                                <RotateCcw size={10} color="#4ADE80" />
                                <Text style={[styles.paymentBadgeText, { color: '#4ADE80' }]}>ESTORNO</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.subDetails}>
                        <Text style={styles.category}>{getCategoryName(item.category)}</Text>
                    </View>
                </View>

                {showActions ? (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        style={[styles.actionsContainer, { overflow: 'hidden' }]}
                    >
                        <LinearGradient
                            colors={['transparent', '#151515']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0.5, y: 0 }}
                            style={{ position: 'absolute', top: 0, bottom: 0, left: -40, right: 0 }}
                        />
                        {canRefund && onRefund && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: 'transparent', borderWidth: 0, marginRight: 8 }]}
                                onPress={() => {
                                    setShowActions(false);
                                    onRefund(item);
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <RotateCcw size={20} color="#4ADE80" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: 'transparent', borderWidth: 0 }]}
                            onPress={handleDelete}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Trash2 size={20} color="#FF453A" />
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <View style={styles.amountContainer}>
                        <Text style={[
                            styles.amount,
                            {
                                color: amountColor,
                                textShadowColor: amountColor + '40',
                                textShadowOffset: { width: 0, height: 0 },
                                textShadowRadius: 8,
                            }
                        ]}>
                            {isPayment || isRefund ? '+ ' : '- '}{formatCurrency(item.amount)}
                        </Text>

                        {!hideInstallments && (item.totalInstallments && item.totalInstallments > 1) && (
                            <Text style={{ fontSize: 10, color: '#666', marginTop: 2, textAlign: 'right', fontWeight: '500' }}>
                                {item.installmentNumber}/{item.totalInstallments}
                            </Text>
                        )}

                        {!hideInstallments && isProjected && (!item.totalInstallments || item.totalInstallments <= 1) && (
                            <Text style={{ fontSize: 9, color: '#60BC57', marginTop: 2, textAlign: 'right', fontWeight: '600' }}>
                                PARCELADO
                            </Text>
                        )}
                    </View>
                )}
                {!isLast && <View style={styles.separator} />}
            </Animated.View>
        </TouchableOpacity>
    );
});
TransactionItem.displayName = 'CreditCardInvoiceTransactionItem';



const EmptyTransactionsState = () => {
    return (
        <View style={[styles.emptyContainer, { marginTop: 40, marginBottom: 40 }]}>
            <Text style={styles.emptyOverlayText}>Não encontramos transações com os filtros atuais.</Text>
        </View>
    );
};

interface NeedsConfigurationStateProps {
    onOpenSettings: () => void;
}

const NeedsConfigurationState = ({ onOpenSettings }: NeedsConfigurationStateProps) => {
    return (
        <View style={styles.configNeededContainer}>
            <View style={styles.configIconWrapper}>
                <DelayedLoopLottie
                    source={require('@/assets/fatura.json')}
                    style={{ width: 120, height: 120 }}
                    delay={3000}
                    initialDelay={100}
                    jitterRatio={0.2}
                    renderMode="HARDWARE"
                />
            </View>

            <Text style={styles.configNeededTitle}>Fatura não configurada</Text>

            <Text style={styles.configNeededText}>
                Para visualizar seus gastos organizados por mês, informe a data de fechamento do cartão.
            </Text>

            <TouchableOpacity
                style={styles.configNeededButton}
                onPress={onOpenSettings}
                activeOpacity={0.8}
            >
                <Text style={styles.configNeededButtonText}>Configurar agora</Text>
            </TouchableOpacity>
        </View>
    );
};

export function CreditCardInvoice({
    transactions,
    creditCards,
    userId,
    onRefresh,
    refreshing = false,
    onLoadMoreHistory,
    hasMoreHistory = false,
    loadingMoreHistory = false,
    onNavigateToOpenFinance
}: CreditCardInvoiceProps) {
    const { getCategoryName } = useCategories();
    const { lod } = usePerformanceBudget();
    const [selectedTab, setSelectedTab] = useState<InvoiceTab>('current');
    const [invoiceData, setInvoiceData] = useState<InvoiceBuildResult | null>(null);

    // Sync with Firestore
    useEffect(() => {
        if (!userId) return;

        const unsubscribe = onSnapshot(doc(db, 'users', userId), (docSnap) => {
            const data = docSnap.data();
            const prefs = data?.dashboardPreferences;
            if (prefs && prefs.invoiceViewMode) {
                const newMode = prefs.invoiceViewMode;
                let tabToSet: InvoiceTab | null = null;

                if (newMode === 'next') {
                    tabToSet = 'future_0';
                } else if (newMode === 'all' || newMode === 'last' || newMode === 'current') {
                    tabToSet = newMode as InvoiceTab;
                }

                if (tabToSet) {
                    setSelectedTab(prev => {
                        if (prev !== tabToSet) return tabToSet!;
                        return prev;
                    });
                }
            }
        });

        return () => unsubscribe();
    }, [userId]);

    const handleTabChange = useCallback((tab: InvoiceTab) => {
        setSelectedTab(tab);
        let modeToSave = tab;
        if (tab.startsWith('future_')) modeToSave = 'next' as any;

        if (userId) {
            databaseService.saveInvoiceViewMode(userId, modeToSave);
        }
    }, [userId]);
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [showInvoiceCards, setShowInvoiceCards] = useState(true);
    const [settingsVisible, setSettingsVisible] = useState(false);

    // Filter State
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        categories: [],
        startDate: '',
        endDate: '',
        year: ''
    });

    // Refund State
    const [refundModalVisible, setRefundModalVisible] = useState(false);
    const [refundTransaction, setRefundTransaction] = useState<InvoiceItem | null>(null);

    // Arrow Rotation for Collapse
    const arrowRotation = useSharedValue(showInvoiceCards ? 0 : 180);

    useEffect(() => {
        arrowRotation.value = withTiming(showInvoiceCards ? 0 : 180, { duration: 300 });
    }, [showInvoiceCards]);

    const arrowAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${arrowRotation.value}deg` }]
    }));

    // Transaction Options State
    const [transactionOptionsVisible, setTransactionOptionsVisible] = useState(false);
    const [selectedTransactionForOptions, setSelectedTransactionForOptions] = useState<InvoiceItem | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleOpenTransactionOptions = useCallback((item: InvoiceItem) => {
        setSelectedTransactionForOptions(item);
        setTransactionOptionsVisible(true);
    }, []);

    const normalizeIsoDate = useCallback((rawDate: string): string | null => {
        if (!rawDate) return null;
        const candidate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
        const parts = candidate.split('-');
        if (parts.length !== 3) return null;

        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

        const parsed = new Date(year, month - 1, day, 12, 0, 0);
        if (
            parsed.getFullYear() !== year ||
            parsed.getMonth() !== month - 1 ||
            parsed.getDate() !== day
        ) {
            return null;
        }

        const y = String(year).padStart(4, '0');
        const m = String(month).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, []);

    const parseCustomDateToIso = useCallback((rawDate: string): string | null => {
        if (!rawDate) return null;
        const parts = rawDate.split('/');
        if (parts.length !== 3) return null;

        const day = Number(parts[0]);
        const month = Number(parts[1]);
        const year = Number(parts[2]);
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

        const parsed = new Date(year, month - 1, day, 12, 0, 0);
        if (
            parsed.getFullYear() !== year ||
            parsed.getMonth() !== month - 1 ||
            parsed.getDate() !== day
        ) {
            return null;
        }

        const y = String(year).padStart(4, '0');
        const m = String(month).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, []);

    const shiftMonthKey = useCallback((monthKey: string, deltaMonths: number): string | null => {
        const parts = monthKey.split('-');
        if (parts.length !== 2) return null;

        const year = Number(parts[0]);
        const month = Number(parts[1]);
        if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

        const shifted = new Date(year, month - 1, 1, 12, 0, 0);
        shifted.setMonth(shifted.getMonth() + deltaMonths);

        const y = shifted.getFullYear();
        const m = String(shifted.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }, []);

    const getSelectedTabMonthKey = useCallback((): string | null => {
        if (!invoiceData) return null;

        if (selectedTab === 'last') return invoiceData.periods.lastMonthKey;
        if (selectedTab === 'current') return invoiceData.periods.currentMonthKey;
        if (selectedTab.startsWith('future_')) {
            const futureIndex = parseInt(selectedTab.split('_')[1], 10);
            if (!Number.isNaN(futureIndex) && futureIndex >= 0) {
                return invoiceData.futureInvoices[futureIndex]?.referenceMonth ?? null;
            }
        }

        return null;
    }, [invoiceData, selectedTab]);

    const handleMoveTransaction = useCallback(async (target: 'prev' | 'next' | 'current' | 'custom', customDate?: string) => {
        if (!selectedTransactionForOptions) return;
        if (selectedTransactionForOptions.isProjected) {
            console.warn('[CreditCardInvoice] Cannot move projected transaction:', selectedTransactionForOptions.id);
            return;
        }

        const normalizedCurrentDate = normalizeIsoDate(selectedTransactionForOptions.date);
        if (!normalizedCurrentDate) {
            console.error('[CreditCardInvoice] Invalid transaction date for move:', selectedTransactionForOptions.date);
            return;
        }

        try {
            const updateData: {
                date?: string;
                invoiceMonthKey?: string;
                invoiceMonthKeyManual?: boolean;
                manualInvoiceMonth?: string;
            } = {};

            if (target === 'custom') {
                const customIsoDate = customDate ? parseCustomDateToIso(customDate) : null;
                if (!customIsoDate) {
                    console.error('[CreditCardInvoice] Invalid custom date for move:', customDate);
                    return;
                }

                updateData.date = customIsoDate;
                updateData.invoiceMonthKey = customIsoDate.slice(0, 7);
                updateData.invoiceMonthKeyManual = false;
                // Compatibilidade: remover manualInvoiceMonth quando não é manual
                updateData.manualInvoiceMonth = undefined;
            } else if (target === 'next' || target === 'prev') {
                const selectedTabMonthKey = getSelectedTabMonthKey();
                const baseMonthKey = selectedTabMonthKey || normalizedCurrentDate.slice(0, 7);
                const shiftedMonthKey = shiftMonthKey(baseMonthKey, target === 'next' ? 1 : -1);

                if (!shiftedMonthKey) {
                    console.error('[CreditCardInvoice] Invalid month key for move:', baseMonthKey);
                    return;
                }

                // Keep purchase date unchanged and override only invoice assignment.
                updateData.invoiceMonthKey = shiftedMonthKey;
                updateData.invoiceMonthKeyManual = true;
                // Compatibilidade: salvar também no formato do web
                updateData.manualInvoiceMonth = shiftedMonthKey;
            } else {
                // "current" clears manual override and falls back to date-based classification.
                updateData.invoiceMonthKey = normalizedCurrentDate.slice(0, 7);
                updateData.invoiceMonthKeyManual = false;
                // Compatibilidade: remover manualInvoiceMonth quando não é manual
                updateData.manualInvoiceMonth = undefined;
            }

            const result = await databaseService.updateCreditCardTransaction(
                userId,
                selectedTransactionForOptions.id,
                updateData
            );
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to update credit card transaction');
            }

            if (onRefresh) await onRefresh();
        } catch (error) {
            console.error('Error moving transaction:', error);
        }
    }, [
        selectedTransactionForOptions,
        normalizeIsoDate,
        parseCustomDateToIso,
        getSelectedTabMonthKey,
        shiftMonthKey,
        userId,
        onRefresh
    ]);

    const handleApplyFilters = (newFilters: FilterState) => {
        // Trigger LayoutAnimation for smooth transition
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilters(newFilters);
    };

    const clearFilters = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilters({
            search: '',
            categories: [],
            startDate: '',
            endDate: '',
            year: ''
        });
    };

    const activeFilterCount = [
        filters.search,
        filters.categories.length > 0,
        filters.startDate,
        filters.endDate,
        filters.year
    ].filter(Boolean).length;


    const handleDeleteTransaction = useCallback(async (item: InvoiceItem) => {
        try {
            // A confirmação visual já foi feita pelo DeleteConfirmCard dentro do item
            await databaseService.deleteOpenFinanceCreditCardTransaction(userId, item.id);

            // Simula uma espera e refresh para feedback visual
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Erro ao excluir transação:', error);
        }
    }, [onRefresh, userId]);

    // Handler para abrir modal de estorno
    const handleOpenRefundModal = useCallback((item: InvoiceItem) => {
        setRefundTransaction(item);
        setRefundModalVisible(true);
    }, []);

    // Handler para confirmar estorno - cria nova transação de crédito
    const handleConfirmRefund = useCallback(async (
        transaction: { id: string; description: string; amount: number; date: string; category?: string; cardId?: string; accountId?: string },
        customAmount?: number
    ) => {
        const refundAmount = customAmount ?? transaction.amount;
        const now = new Date();
        const refundDate = transaction.date; // Usar mesma data para ficar na mesma fatura

        // Criar nova transação de estorno
        const refundTransactionData = {
            description: `Estorno - ${transaction.description}`,
            amount: refundAmount, // Valor positivo
            type: 'income' as const,
            date: refundDate,
            category: 'Refund',
            cardId: transaction.cardId || transaction.accountId || selectedCardId,
            isRefund: true,
            originalTransactionId: transaction.id,
            // Campos adicionais para consistência
            installmentNumber: 1,
            totalInstallments: 1,
            status: 'completed',
            source: 'manual-refund',
            createdAt: now.toISOString()
        };

        // Salvar no Firebase
        const result = await databaseService.saveOpenFinanceCreditCardTransaction(
            userId,
            {
                id: `refund-${transaction.id}-${Date.now()}`,
                ...refundTransactionData,
                amount: refundAmount, // Manter positivo para estorno
            },
            { id: selectedCardId }
        );

        if (!result.success) {
            throw new Error(result.error || 'Erro ao salvar estorno');
        }

        // Refresh para atualizar a lista
        if (onRefresh) {
            await onRefresh();
        }
    }, [userId, selectedCardId, onRefresh]);

    useEffect(() => {
        if (creditCards.length > 0 && !selectedCardId) setSelectedCardId(creditCards[0].id);
    }, [creditCards]);

    const selectedCard = useMemo(() => creditCards.find(c => c.id === selectedCardId) || null, [creditCards, selectedCardId]);
    const transactionsByCard = useMemo(() => {
        const map = new Map<string, Transaction[]>();
        transactions.forEach((tx) => {
            const txCardId = tx.cardId || tx.accountId || '';
            if (!txCardId) {
                return;
            }
            const existing = map.get(txCardId);
            if (existing) {
                existing.push(tx);
            } else {
                map.set(txCardId, [tx]);
            }
        });
        return map;
    }, [transactions]);

    // PRÉ0-FILTRAR transações pelo cartão selecionado ANTES de passar para buildInvoices
    // Isso garante que cada cartão receba APENAS suas próprias transações
    const filteredTransactions = useMemo(() => {
        if (!selectedCardId || selectedCardId === 'all') {
            return transactions;
        }
        return transactionsByCard.get(selectedCardId) || [];
    }, [selectedCardId, transactions, transactionsByCard]);

    const invoiceComputationTransactions = useMemo(() => {
        if (filteredTransactions.length === 0) {
            return filteredTransactions;
        }

        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - INVOICE_COMPUTE_WINDOW_MONTHS);
        const cutoffIso = cutoff.toISOString().split('T')[0];

        const recent: Transaction[] = [];
        for (const tx of filteredTransactions) {
            if (!tx.date) {
                continue;
            }
            if (tx.date < cutoffIso) {
                break;
            }
            recent.push(tx);
            if (recent.length >= MAX_INVOICE_COMPUTE_ITEMS) {
                break;
            }
        }

        if (recent.length > 0) {
            return recent;
        }

        return filteredTransactions.slice(0, Math.min(filteredTransactions.length, MAX_INVOICE_COMPUTE_ITEMS));
    }, [filteredTransactions]);

    const buildRunIdRef = useRef(0);

    useEffect(() => {
        if (!selectedCardId) {
            setInvoiceData(null);
        }
    }, [selectedCardId]);

    useEffect(() => {
        const runId = ++buildRunIdRef.current;
        if (!selectedCard) {
            setInvoiceData(null);
            return;
        }

        let task: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
        const timer = setTimeout(() => {
            task = InteractionManager.runAfterInteractions(() => {
                const nextData = buildInvoices(selectedCard, invoiceComputationTransactions, selectedCardId);
                if (runId === buildRunIdRef.current) {
                    setInvoiceData(nextData);
                }
            });
        }, INVOICE_BUILD_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            if (task && typeof task.cancel === 'function') {
                task.cancel();
            }
        };
    }, [invoiceComputationTransactions, selectedCard, selectedCardId]);

    const allHistoryItems = useMemo(
        () => filteredTransactions.map((t) => ({
            id: t.id,
            description: t.description,
            amount: Math.abs(t.amount),
            date: t.date,
            category: t.category,
            type: t.type,
            installmentNumber: t.installmentNumber,
            totalInstallments: t.totalInstallments,
            isPayment: false,
            isRefund: t.isRefund || t.category === 'Refund',
            originalTransactionId: t.originalTransactionId
        })),
        [filteredTransactions]
    );

    const historyTotal = useMemo(() => {
        if (!selectedCardId) return 0;
        return filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    }, [filteredTransactions, selectedCardId]);

    // currentItems computado primeiro para que currentItemsLength esteja disponível
    const currentItems = useMemo((): InvoiceItem[] => {
        let items: InvoiceItem[] = [];

        if (invoiceData) {
            switch (selectedTab) {
                case 'all':
                    items = allHistoryItems;
                    break;
                case 'last':
                    items = invoiceData.closedInvoice.items;
                    break;
                case 'current':
                    items = invoiceData.currentInvoice.items;
                    break;
                default:
                    if (selectedTab.startsWith('future_')) {
                        const futureIndex = parseInt(selectedTab.split('_')[1]);
                        items = invoiceData.futureInvoices[futureIndex]?.items || [];
                    }
            }
        }

        // Apply Filters
        if (items.length > 0 && activeFilterCount > 0) {
            // Helper convert DD/MM/YYYY -> YYYY-MM-DD
            const parseFilterDate = (d: string) => {
                const parts = d.split('/');
                if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                return '';
            };

            const searchLower = filters.search.toLowerCase();
            const startIso = parseFilterDate(filters.startDate);
            const endIso = parseFilterDate(filters.endDate);

            items = items.filter(item => {
                let matches = true;

                // Search
                if (filters.search) {
                    matches = matches && (
                        (!!item.description && item.description.toLowerCase().includes(searchLower)) ||
                        (!!item.amount && item.amount.toString().includes(filters.search))
                    );
                }

                // Category
                if (filters.categories.length > 0) {
                    matches = matches && !!item.category && filters.categories.includes(item.category);
                }

                // Start Date
                if (startIso) {
                    matches = matches && item.date >= startIso;
                }

                // End Date
                if (endIso) {
                    matches = matches && item.date <= endIso;
                }

                // Year
                if (filters.year) {
                    matches = matches && item.date.startsWith(filters.year);
                }

                return matches;
            });
        }

        return items;
    }, [allHistoryItems, invoiceData, selectedTab, filters, activeFilterCount]);

    // Group transactions by date
    const groupedItems = useMemo(() => {
        if (currentItems.length === 0) return [];
        // currentItems is already built in reverse chronological order.
        const sorted = currentItems;
        const sortedIds = new Set(sorted.map(item => item.id));

        // Reordenar para manter estornos "grudados" na transação original (logo abaixo)
        const reordered: InvoiceItem[] = [];

        // Mapa de estornos por ID original para acesso rápido
        const refundsByOriginalId = new Map<string, InvoiceItem[]>();
        sorted.forEach(item => {
            if (item.isRefund && item.originalTransactionId) {
                const list = refundsByOriginalId.get(item.originalTransactionId) || [];
                list.push(item);
                refundsByOriginalId.set(item.originalTransactionId, list);
            }
        });

        sorted.forEach(item => {
            // Se for estorno com pai na lista, pular (será adicionado com o pai)
            if (item.isRefund && item.originalTransactionId && sortedIds.has(item.originalTransactionId)) {
                return;
            }

            reordered.push(item);

            // Verificar se este item tem estornos associados
            const myRefunds = refundsByOriginalId.get(item.id);
            if (myRefunds) {
                myRefunds.forEach(refund => reordered.push(refund));
            }
        });

        const groups: { title: string; items: InvoiceItem[] }[] = [];
        let currentGroup: { title: string; items: InvoiceItem[] } | null = null;

        const getYMD = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const now = new Date();
        const todayYMD = getYMD(now);
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        const yesterdayYMD = getYMD(yest);
        const getHeader = (dateIso: string) => {
            const date = new Date(`${dateIso}T12:00:00`);
            const day = date.getDate();
            if (dateIso === todayYMD) return `HOJE, ${day} ${getMonthShortUpper(date)}`;
            if (dateIso === yesterdayYMD) return `ONTEM, ${day} ${getMonthShortUpper(date)}`;
            return `${day} ${getMonthLongUpper(date)}`;
        };

        reordered.forEach(item => {
            const header = getHeader(item.date);

            if (!currentGroup || currentGroup.title !== header) {
                currentGroup = { title: header, items: [] };
                groups.push(currentGroup);
            }
            currentGroup.items.push(item);
        });
        return groups;
    }, [currentItems]);

    // Calcular anos disponíveis
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        // Add current year as default
        years.add(new Date().getFullYear().toString());

        filteredTransactions.forEach(t => {
            if (t.date) {
                const y = t.date.split('-')[0];
                if (y && y.length === 4) years.add(y);
            }
        });

        return Array.from(years).sort().reverse();
    }, [filteredTransactions]);

    // Calcular categorias disponíveis das transações
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();

        filteredTransactions.forEach(t => {
            if (t.category) {
                cats.add(t.category);
            }
        });

        // Ordenar alfabeticamente pelo nome traduzido (Português)
        return Array.from(cats).sort((a, b) => {
            const nameA = getCategoryName(a);
            const nameB = getCategoryName(b);
            return nameA.localeCompare(nameB, 'pt-BR');
        });
    }, [filteredTransactions, getCategoryName]);

    const currentItemsLength = currentItems.length;
    const animateRows = lod <= 1 && currentItemsLength <= 80;
    const handleCancelDelete = useCallback(() => setConfirmDeleteId(null), []);
    const groupedSections = useMemo(
        () => groupedItems.map(group => ({ title: group.title, data: group.items })),
        [groupedItems]
    );

    const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
        <View style={styles.groupContainer}>
            <Text style={styles.groupHeader}>{section.title}</Text>
        </View>
    ), []);

    const renderTransactionRow = useCallback(({
        item,
        index,
        section
    }: {
        item: InvoiceItem;
        index: number;
        section: { title: string; data: InvoiceItem[] };
    }) => (
        <TransactionItem
            item={item}
            index={index}
            total={section.data.length}
            onDelete={handleDeleteTransaction}
            onRefund={handleConfirmRefund}
            onLongPress={handleOpenTransactionOptions}
            getCategoryName={getCategoryName}
            isConfirmingDelete={confirmDeleteId === item.id}
            onCancelDelete={handleCancelDelete}
            animateRow={animateRows}
        />
    ), [
        animateRows,
        confirmDeleteId,
        getCategoryName,
        handleCancelDelete,
        handleConfirmRefund,
        handleDeleteTransaction,
        handleOpenTransactionOptions
    ]);

    const keyExtractor = useCallback((item: InvoiceItem) => item.id, []);

    const handleLoadMoreHistory = useCallback(() => {
        if (selectedTab !== 'all' || !onLoadMoreHistory || !hasMoreHistory || loadingMoreHistory) {
            return;
        }
        onLoadMoreHistory();
    }, [hasMoreHistory, loadingMoreHistory, onLoadMoreHistory, selectedTab]);

    const toggleInvoiceCards = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowInvoiceCards(!showInvoiceCards);
    };

    // Verificar se o cartão tem configuração manual do fechamento
    // O usuário PRECISA configurar manualmente a data de fechamento para ver as faturas
    const hasManualConfig = selectedCard?.closingDateSettings?.lastClosingDate;
    const needsConfiguration = selectedCard && !hasManualConfig;

    if (creditCards.length === 0) return (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <DelayedLoopLottie
                    source={require('@/assets/cartabranco.json')}
                    style={{ width: 80, height: 80 }}
                    delay={3000}
                    initialDelay={100}
                    jitterRatio={0.2}
                    renderMode="HARDWARE"
                />
            </View>
            <Text style={styles.emptyTitle}>Nenhum cartão conectado</Text>
            <Text style={styles.emptyText}>Conecte seu cartão de crédito via Open Finance para visualizar suas faturas.</Text>
            
            <TouchableOpacity
                style={styles.connectButton}
                onPress={onNavigateToOpenFinance}
                activeOpacity={0.8}
            >
                <Text style={styles.connectButtonText}>Conectar Conta</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.screen}>
            {selectedCard && <CreditCardSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} userId={userId} account={selectedCard} onSave={() => onRefresh?.()} />}

            <TransactionOptionsModal
                visible={transactionOptionsVisible}
                onClose={() => {
                    setTransactionOptionsVisible(false);
                    setSelectedTransactionForOptions(null);
                }}
                transaction={selectedTransactionForOptions}
                onMoveInvoice={handleMoveTransaction}
                onDelete={(item) => {
                    setTransactionOptionsVisible(false);
                    setConfirmDeleteId(item.id);
                }}
                onRefund={(item) => {
                    setTransactionOptionsVisible(false);
                    handleOpenRefundModal(item);
                }}
            />

            <RefundModal
                visible={refundModalVisible}
                onClose={() => {
                    setRefundModalVisible(false);
                    setRefundTransaction(null);
                }}
                transaction={refundTransaction ? {
                    id: refundTransaction.id,
                    description: refundTransaction.description,
                    amount: refundTransaction.amount,
                    date: refundTransaction.date,
                    category: refundTransaction.category,
                    type: refundTransaction.type,
                    cardId: selectedCardId
                } : null}
                onConfirm={handleConfirmRefund}
            />

            <CreditCardFilterModal
                visible={filterModalVisible}
                onClose={() => setFilterModalVisible(false)}
                onApply={handleApplyFilters}
                initialFilters={filters}
                categories={availableCategories}
                getCategoryName={getCategoryName}
                years={availableYears}
            />

            <SectionList
                style={styles.container}
                sections={!needsConfiguration ? groupedSections : []}
                extraData={confirmDeleteId} // Ensure updates when delete confirmation state changes
                renderItem={renderTransactionRow}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                onEndReached={handleLoadMoreHistory}
                onEndReachedThreshold={0.5}
                refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D97757" colors={['#D97757']} /> : undefined}
                initialNumToRender={lod >= 2 ? 4 : 5}
                maxToRenderPerBatch={lod >= 2 ? 4 : 6}
                updateCellsBatchingPeriod={lod >= 2 ? 80 : 50}
                windowSize={lod >= 2 ? 4 : 5}
                removeClippedSubviews={lod >= 1}
                ListFooterComponent={
                    selectedTab === 'all' && loadingMoreHistory ? (
                        <View style={{ paddingVertical: 18 }}>
                            <ActivityIndicator size="small" color="#D97757" />
                        </View>
                    ) : null
                }
                ListHeaderComponent={
                    <>
                        <View style={styles.headerRow}>
                            <Text style={styles.screenHeader}>Fatura do cartão</Text>
                            <BankSelector
                                currentCardId={selectedCard?.id || null}
                                cards={creditCards}
                                style={{ flexShrink: 1, marginLeft: 16 }}
                                onSelectCard={(id) => {
                                    if (id) setSelectedCardId(id);
                                    else if (creditCards.length > 0) setSelectedCardId(creditCards[0].id);
                                }}
                            />

                        </View>

                        {selectedCard && (
                            <View style={styles.cardHeader}>
                                <View style={[styles.cardHeaderLeft, { flexDirection: 'column', alignItems: 'flex-start', marginLeft: 0 }]}>
                                    <View style={{ paddingLeft: 0, marginTop: 0 }}>
                                        {invoiceData && (() => {
                                            // Calcular dia de fechamento - prioridade: periodEnd > currentBill.closeDate > balanceCloseDate > config manual
                                            let closingDay = invoiceData.periods.closingDay;
                                            let dueDay = invoiceData.periods.dueDay;
                                            let hasPluggyData = false;

                                            // Helper para parsear datas que podem vir em formato ISO ou YYYY-MM-DD
                                            const parseDateSafe = (dateStr: string): Date | null => {
                                                if (!dateStr) return null;
                                                // Se já tem 'T', é ISO completo, parse direto
                                                if (dateStr.includes('T')) {
                                                    const d = new Date(dateStr);
                                                    return isNaN(d.getTime()) ? null : d;
                                                }
                                                // Senão, adiciona horário para evitar problemas de timezone
                                                const d = new Date(dateStr + 'T12:00:00');
                                                return isNaN(d.getTime()) ? null : d;
                                            };

                                            // Prioridade 1: periodEnd do currentBill
                                            if (selectedCard.currentBill?.periodEnd) {
                                                const periodEndDate = parseDateSafe(selectedCard.currentBill.periodEnd);
                                                if (periodEndDate) {
                                                    closingDay = periodEndDate.getDate();
                                                    hasPluggyData = true;
                                                }
                                            } else if (selectedCard.currentBill?.closeDate) {
                                                const closeDate = parseDateSafe(selectedCard.currentBill.closeDate);
                                                if (closeDate) {
                                                    closingDay = closeDate.getDate();
                                                    hasPluggyData = true;
                                                }
                                            } else if (selectedCard.balanceCloseDate) {
                                                const balanceClose = parseDateSafe(selectedCard.balanceCloseDate);
                                                if (balanceClose) {
                                                    closingDay = balanceClose.getDate();
                                                    hasPluggyData = true;
                                                }
                                            }


                                            if (selectedCard.currentBill?.dueDate) {
                                                const dueDateParsed = parseDateSafe(selectedCard.currentBill.dueDate);
                                                if (dueDateParsed) {
                                                    dueDay = dueDateParsed.getDate();
                                                    hasPluggyData = true;
                                                }
                                            } else if (selectedCard.balanceDueDate) {
                                                const balanceDue = parseDateSafe(selectedCard.balanceDueDate);
                                                if (balanceDue) {
                                                    dueDay = balanceDue.getDate();
                                                    hasPluggyData = true;
                                                }
                                            }

                                            return (
                                                <Text style={styles.cardSubtitle}>
                                                    Fecha {closingDay} " Vence {dueDay}
                                                    {hasPluggyData && <Text style={{ color: '#04D361', fontSize: 10 }}></Text>}
                                                </Text>
                                            );
                                        })()}
                                    </View>
                                </View>
                                <View style={styles.cardHeaderRight}>
                                    <TouchableOpacity
                                        style={[styles.settingsButton, activeFilterCount > 0 && { borderColor: '#D97757', backgroundColor: 'rgba(217, 119, 87, 0.1)' }]}
                                        onPress={() => setFilterModalVisible(true)}
                                    >
                                        <TimedLottieIcon source={require('@/assets/previsao.json')} style={{ width: 20, height: 20 }} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.settingsButton} onPress={() => setSettingsVisible(true)}>
                                        <TimedLottieIcon source={require('@/assets/engrenagem.json')} style={{ width: 20, height: 20 }} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.toggleButton} onPress={toggleInvoiceCards}>
                                        <Animated.View style={arrowAnimatedStyle}>
                                            <TimedLottieIcon source={require('@/assets/cima.json')} style={{ width: 20, height: 20 }} />
                                        </Animated.View>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {showInvoiceCards && invoiceData && !needsConfiguration && (
                            <InvoiceCarousel invoiceData={invoiceData} selectedTab={selectedTab} onTabChange={handleTabChange} historyTotal={historyTotal} />
                        )}

                        {!needsConfiguration && (
                            <View style={styles.listHeader}>
                                <Text style={styles.listHeaderTitle}>
                                    {selectedTab === 'all' ? 'Histórico' : selectedTab === 'last' ? 'Última Fatura' : selectedTab === 'current' ? 'Fatura Atual' : selectedTab === 'future_0' ? 'Próxima Fatura' : `Fatura Futura ${parseInt(selectedTab.split('_')[1]) + 1}`}
                                </Text>
                                <Text style={styles.listHeaderCount}>{currentItemsLength} lançamentos</Text>
                            </View>
                        )}
                    </>
                }
                ListEmptyComponent={
                    needsConfiguration
                        ? <NeedsConfigurationState onOpenSettings={() => setSettingsVisible(true)} />
                        : <EmptyTransactionsState />
                }
            />


        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    container: { flex: 1 },
    // Segmented Control Styles
    // Segmented Control Styles
    segmentWrapper: {
        paddingHorizontal: 20,
        marginBottom: 16,
        marginTop: 4,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#141414',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2B2B2B',
        height: 44,
        alignItems: 'center',
        overflow: 'hidden',
    },
    segmentItem: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        zIndex: 1, // Text on top
    },
    activeIndicator: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: '#1F1F1F',
        zIndex: 0,
    },
    segmentDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#2B2B2B',
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#666',
        textAlign: 'center',
    },
    segmentTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 20 },
    screenHeader: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        // removed padding/margins that are now handled by headerRow
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 10,
    },
    headerRightAction: {
        // Container for right side actions in header
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100, // Ensure stack is swipeable
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 },
    cardConnectorLogo: { flexShrink: 0 },
    cardInfoBlock: { flexShrink: 1 },
    cardName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    cardSubtitle: { color: '#666', fontSize: 12, marginTop: 2 },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    settingsButton: { padding: 8, borderRadius: 10, backgroundColor: '#151515', borderWidth: 1, borderColor: '#252525' },
    toggleButton: { padding: 8, borderRadius: 10, backgroundColor: '#151515', borderWidth: 1, borderColor: '#252525' },
    configPrompt: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#151515', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#D97757', marginHorizontal: 20 },
    configPromptText: { flex: 1 },
    configPromptTitle: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    configPromptSubtitle: { color: '#888', fontSize: 12, marginTop: 2 },
    configButton: { backgroundColor: '#D97757', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    configButtonText: { color: '#111', fontSize: 13, fontWeight: '700' },

    // Carousel Container
    carouselContainer: {
        marginBottom: 4,
        alignItems: 'center'
    },

    // Stack Container
    stackContainer: {
        flex: 1,
        height: 110,
        justifyContent: 'center',
        alignItems: 'center'
    },
    gestureContainer: {
        width: CARD_WIDTH,
        height: 90,
        justifyContent: 'center',
        alignItems: 'center'
    },
    stackCardWrapper: {
        width: CARD_WIDTH,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // Pagination Dots - Overlay dentro do card
    paginationOverlay: {
        position: 'absolute',
        bottom: 18,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        zIndex: 100
    },
    dotTouchable: {
        padding: 3
    },
    paginationDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(255, 255, 255, 0.3)'
    },
    paginationDotActive: {
        backgroundColor: '#D97757',
        width: 14
    },

    // Invoice Card
    invoiceCard: {
        width: '100%',
        backgroundColor: '#151515',
        borderRadius: 16,
        paddingTop: 10,
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderWidth: 1,
        borderColor: '#252525',
        height: 90,
        justifyContent: 'space-between',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
        overflow: 'hidden',
    },

    // Card Content (mantido do carousel)
    carouselHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    carouselHeaderLeft: { flex: 1 },
    carouselLabel: { color: '#888', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    carouselDueInline: { color: '#555', fontSize: 10, marginTop: 2 },
    carouselContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 },
    carouselHistoryContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    carouselAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    carouselAmount: { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 0 },
    carouselItemCount: { color: '#888', fontSize: 12, fontWeight: '500' },
    carouselDateRow: { marginTop: 2 },
    carouselDate: { color: '#666', fontSize: 11, marginBottom: 4 },
    carouselSubLabel: { color: '#666', fontSize: 16, textAlign: 'center' },
    carouselDue: { color: '#888', fontSize: 12, marginTop: 4 },
    futureTotalBadge: {
        position: 'absolute',
        bottom: -28, // Ajustado para ficar logo abaixo
        backgroundColor: '#2A1C19', // Laranja escuro
        paddingHorizontal: 16,
        paddingTop: 12, // Compensar a parte que fica escondida atrás do card
        paddingBottom: 6,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        borderWidth: 1,
        borderTopWidth: 0, // Sem borda superior para parecer grudado
        borderColor: 'rgba(217, 119, 87, 0.3)', // Borda laranja sutil
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        zIndex: -1, // Atrás do card
        elevation: -1
    },
    futureTotalLabel: { color: '#888', fontSize: 11, fontWeight: '500' },
    futureTotalValue: { color: '#D97757', fontSize: 12, fontWeight: '700' },

    // Lists
    // Lists
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 16, paddingHorizontal: 20 },
    listHeaderTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    listHeaderCount: { color: '#666', fontSize: 13, marginTop: 2 },
    listHeaderTotal: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    listContent: { paddingBottom: 140 },
    transactionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151515', padding: 10, borderWidth: 1, borderColor: '#252525', marginHorizontal: 20 },
    separator: { position: 'absolute', bottom: 0, left: 14, right: 14, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
    detailsContainer: { flex: 1, gap: 2 },
    descriptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    description: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1 },
    paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(4, 211, 97, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    paymentBadgeText: { color: '#04D361', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    subDetails: { flexDirection: 'row', alignItems: 'center' },
    category: { fontSize: 12, color: '#666', marginTop: 1 },
    amountContainer: { alignItems: 'flex-end', justifyContent: 'center' },
    amount: { fontSize: 14, fontWeight: '700' },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 4,
        height: '100%',
        justifyContent: 'flex-end',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    expandOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', zIndex: 50, elevation: 50 },
    expandBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    expandBackdropPress: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    expandCard: {
        backgroundColor: '#151515',
        borderWidth: 1,
        borderColor: '#2B2B2B',
        padding: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10
    },
    expandHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    expandIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1
    },
    expandTitleGroup: { flex: 1, gap: 4 },
    expandTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    expandSubtitle: { color: '#8E8E93', fontSize: 13 },
    expandCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2B2B2B',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1C1C1C'
    },
    expandDetails: { marginTop: 18, gap: 12 },
    expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    expandLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
    expandValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    expandAmountContainer: { marginTop: 18, alignItems: 'flex-end' },
    expandAmount: { fontSize: 22, fontWeight: '700' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 20 },
    emptyIconContainer: { justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
    emptyText: { fontSize: 14, color: '#909090', textAlign: 'center', maxWidth: 280, lineHeight: 20, marginBottom: 24 },
    connectButton: { 
        backgroundColor: '#D97757', 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 20, 
        marginTop: 8 
    },
    connectButtonText: { 
        color: '#FFFFFF', 
        fontSize: 14, 
        fontWeight: '600' 
    },
    emptyListState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyListTitle: { fontSize: 16, fontWeight: '600', color: '#666', marginTop: 12 },
    emptyListText: { fontSize: 13, color: '#555', marginTop: 4 },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    statusBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

    // New Empty State Styles
    emptyContainer: {
        marginTop: 20,
        alignItems: 'center',
        paddingHorizontal: 0,
    },
    skeletonContainer: {
        width: '100%',
        opacity: 0.6,
        position: 'relative',
    },
    skeletonGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '100%',
        zIndex: 1,
    },
    emptyContentOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    emptyIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(217, 119, 87, 0.2)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    emptyOverlayTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 4,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    emptyOverlayText: {
        fontSize: 13,
        color: '#BBB',
        textAlign: 'center',
        maxWidth: 240,
    },
    // Groups
    groupContainer: {
        marginTop: 24,
        marginBottom: 10,
        marginHorizontal: 20,
    },
    groupHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    groupCard: {
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },

    // Stack Selector Styles
    walletStackContainer: {
        alignItems: 'center',
        marginVertical: 10,
        marginBottom: 26,
    },
    walletStackTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    walletStackTouch: {
        width: 160,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletStackWrapper: {
        position: 'relative',
        width: 160,
        height: 100,
        alignItems: 'center',
    },
    stackCardStyle: {
        width: 160,
        height: 100,
        position: 'absolute',
        top: 0,
        borderRadius: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    stackCardContent: {
        flex: 1,
        padding: 12,
        justifyContent: 'space-between',
        zIndex: 2,
    },
    stackCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardChip: {
        width: 24,
        height: 16,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    cardNfcIcon: {
        width: 16,
        height: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        transform: [{ rotate: '90deg' }]
    },
    nfcLine: {
        height: 2,
        width: 12,
        borderRadius: 1,
        borderWidth: 1,
        backgroundColor: 'transparent'
    },
    stackCardLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        textAlign: 'left',
        marginBottom: 4,
    },
    cardGloss: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 50,
        backgroundColor: 'rgba(255,255,255,0.06)',
        transform: [{ skewY: '-15deg' }, { translateY: -20 }]
    },
    cardDotsRow: {
        flexDirection: 'row',
        gap: 3,
        opacity: 0.7
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
    },
    // NeedsConfigurationState styles
    configNeededContainer: {
        paddingHorizontal: 32,
        paddingTop: 80,
        paddingBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    configIconWrapper: {
        marginBottom: 0, // Lottie já tem um padding natural geralmente, ou ajustamos aqui
        alignItems: 'center',
        justifyContent: 'center',
    },
    configNeededTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    configNeededText: {
        fontSize: 15,
        color: '#888',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    configNeededButton: {
        backgroundColor: '#D97757',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 100, // Pill shape
        elevation: 0,
        shadowColor: 'transparent',
    },
    configNeededButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    // Card Selector Styles
    cardSelectorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4, // kept minimum padding for touch targets or layout
        paddingHorizontal: 0, // removed horizontal padding since no background
        // backgroundColor: '#1A1A1A', // Removed
        // borderRadius: 20, // Removed
        // borderWidth: 1, // Removed
        // borderColor: '#2A2A2A', // Removed
    },
    cardSelectorArrow: {
        padding: 4,
    },
    cardSelectorText: {
        fontSize: 14,
        color: '#FFF',
        fontWeight: '600',
        minWidth: 80,
        textAlign: 'center',
        maxWidth: 140,
    },
});
