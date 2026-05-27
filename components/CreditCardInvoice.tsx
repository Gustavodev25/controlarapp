import BankSelector from '@/components/BankSelector';
import { CategorySelectorModal } from '@/components/CategorySelectorModal';
import { ClosingDateItem, ClosingDateModal } from '@/components/ClosingDateModal';
import { FilterState } from '@/components/CreditCardFilterModal';

import { RefundModal } from '@/components/RefundModal';
import { SwipeTutorial } from '@/components/SwipeTutorial';
import { TransactionOptionsModal } from '@/components/TransactionOptionsModal';
import { AnimatedInlineBanner } from '@/components/ui/AnimatedInlineBanner';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { useStackCardStyle } from '@/components/ui/StackCarousel';
import { DEFAULT_CATEGORIES } from '@/constants/defaultCategories';
import { useCategories } from '@/hooks/use-categories';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { databaseService, db } from '@/services/firebase';
import { isNonInstallmentMerchant } from '@/services/installmentRules';
import {
    buildInvoicesPluggyFirst,
    CreditCardAccount,
    formatCurrency,
    formatDateFull,
    formatDateShort,
    InvoiceBuildResult,
    InvoiceItem,
    normalizePluggyDate,
    Transaction
} from '@/services/invoiceBuilder';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient'; // Added
import { doc, onSnapshot } from 'firebase/firestore';
import {
    Check,
    RotateCcw,
    Search,
    Trash2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    InteractionManager,
    LayoutAnimation,
    Platform,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
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
    withSpring
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

interface NeedsConfigurationStateProps {
    onOpenSettings: () => void;
}

const NeedsConfigurationState = ({ onOpenSettings }: NeedsConfigurationStateProps) => {
    return (
        <View style={styles.configNeededContainer}>
            <View style={styles.configIconWrapper}>
                <TimedLottieIcon
                    source={require('@/assets/fatura.json')}
                    style={{ width: 120, height: 120 }}
                />
            </View>

            <Text style={styles.configNeededTitle}>Fatura não configurada</Text>

            <Text style={styles.configNeededText}>
                Para visualizar seus gastos organizados por mês, informe a data de fechamento do cartão.
            </Text>

            <IOSTouchable
                style={styles.configNeededButton}
                onPress={onOpenSettings}
                activeOpacity={1}
            >
                <Text style={styles.configNeededButtonText}>Configurar agora</Text>
            </IOSTouchable>
        </View>
    );
};

type InvoiceTab = 'all' | 'last' | 'current';

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
const CURRENT_INVOICE_CARD_INDEX = 2;

const SPRING_CONFIG = {
    damping: 20,
    stiffness: 230,
    mass: 0.78,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
};

const IOS_CORE_LAYOUT = LinearTransition
    .springify()
    .damping(21)
    .stiffness(245)
    .mass(0.72)
    .overshootClamping(0);

const IOS_FADE_IN = FadeIn.duration(220);
const IOS_FADE_OUT = FadeOut.duration(140);

const MORPH_PRESS_SPRING = {
    damping: 16,
    stiffness: 250,
    mass: 0.42,
} as const;

const MORPH_SHAPE_SPRING = {
    damping: 13,
    stiffness: 190,
    mass: 0.48,
} as const;

const MORPH_RELEASE_PRESS_SPRING = {
    damping: 15,
    stiffness: 215,
    mass: 0.45,
} as const;

const MORPH_RELEASE_SHAPE_SPRING = {
    damping: 11,
    stiffness: 145,
    mass: 0.52,
} as const;

const triggerIOSCoreMorph = () => {
    LayoutAnimation.configureNext({
        duration: 420,
        create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
        update: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.76,
        },
        delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
    });
};

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const IOSTouchable = ({
    children,
    style,
    disabled,
    activeOpacity = 1,
    onPressIn,
    onPressOut,
    ...props
}: any) => {
    const press = useSharedValue(0);
    const morph = useSharedValue(0);

    const pressStyle = useAnimatedStyle(() => {
        const pressed = press.value;
        const morphed = morph.value;

        return {
            transform: [
                { translateY: pressed * 1.4 },
                { scaleX: 1 + morphed * 0.012 - pressed * 0.012 },
                { scaleY: 1 + morphed * 0.016 + pressed * 0.008 },
            ],
        };
    });

    return (
        <AnimatedTouchableOpacity
            {...props}
            disabled={disabled}
            activeOpacity={activeOpacity}
            onPressIn={(event: any) => {
                press.value = withSpring(1, MORPH_PRESS_SPRING);
                morph.value = withSpring(1, MORPH_SHAPE_SPRING);
                onPressIn?.(event);
            }}
            onPressOut={(event: any) => {
                press.value = withSpring(0, MORPH_RELEASE_PRESS_SPRING);
                morph.value = withSpring(0, MORPH_RELEASE_SHAPE_SPRING);
                onPressOut?.(event);
            }}
            onTouchCancel={(event: any) => {
                press.value = withSpring(0, MORPH_RELEASE_PRESS_SPRING);
                morph.value = withSpring(0, MORPH_RELEASE_SHAPE_SPRING);
                props.onTouchCancel?.(event);
            }}
            style={[style, pressStyle]}
        >
            {children}
        </AnimatedTouchableOpacity>
    );
};

const INVOICE_COMPUTE_WINDOW_MONTHS = 24;
const MAX_INVOICE_COMPUTE_ITEMS = 2000;
const INVOICE_BUILD_DEBOUNCE_MS = 80;

const toIsoDateValue = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseIsoDateValue = (rawDate?: string | null): Date | null => {
    const normalized = normalizePluggyDate(rawDate || null);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12, 0, 0);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeIsoDateValue = (rawDate?: string | null): string | null => {
    const parsed = parseIsoDateValue(rawDate);
    return parsed ? toIsoDateValue(parsed) : null;
};

const coerceInvoiceDate = (value?: Date | string | null, fallback?: Date): Date => {
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = parseIsoDateValue(value);
        if (parsed) return parsed;
    }

    return fallback && !isNaN(fallback.getTime()) ? fallback : new Date(NaN);
};

const formatInvoiceRange = (
    start?: Date | string | null,
    close?: Date | string | null,
    fallbackStart?: Date,
    fallbackClose?: Date
): string => {
    const startDate = coerceInvoiceDate(start, fallbackStart);
    const closeDate = coerceInvoiceDate(close, fallbackClose);
    return `${formatDateShort(startDate)} - ${formatDateShort(closeDate)}`;
};

const shiftIsoDateByMonths = (isoDate: string, deltaMonths: number, preferredDay?: number): string | null => {
    const parsed = parseIsoDateValue(isoDate);
    if (!parsed) return null;

    const target = new Date(parsed.getFullYear(), parsed.getMonth() + deltaMonths, 1, 12, 0, 0);
    const targetDay = preferredDay ?? parsed.getDate();
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(targetDay, lastDay));

    return toIsoDateValue(target);
};

const formatShortMonthPt = (isoDate: string): string => {
    const parsed = parseIsoDateValue(isoDate);
    if (!parsed) return '';
    const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
        .format(parsed)
        .replace('.', '');
    const capitalized = shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1);
    return `${capitalized}.`;
};

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
    // Estilo animado principal do cart├úo - usando o mesmo hook do Dashboard (Vis├úo Geral)
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
        // Anima├º├úo de entrada: desliza de cima (-20px) para a posi├º├úo original (0px)
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
            <IOSTouchable
                activeOpacity={1}
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
                            <View style={[styles.statusBadge, { backgroundColor: item.status === 'OVERDUE' ? '#F97316' : item.status === 'CLOSED' ? '#F75555' : item.status === 'PAID' ? '#04D361' : '#EAB308' }]}>
                                <Text style={[styles.statusBadgeText, { color: '#000' }]}>
                                    {item.status === 'OVERDUE' ? 'ATRASADA' : item.status === 'CLOSED' ? 'FECHADA' : item.status === 'PAID' ? 'PAGA' : 'ABERTA'}
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
            </IOSTouchable>

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
    historyTotal,
    selectedCard
}: {
    invoiceData: InvoiceBuildResult;
    selectedTab: InvoiceTab;
    onTabChange: (tab: InvoiceTab) => void;
    historyTotal: number;
    selectedCard: CreditCardAccount | null;
}) => {
    const [currentIndex, setCurrentIndex] = useState(CURRENT_INVOICE_CARD_INDEX); // Começa em "Fatura Atual"
    const animatedIndex = useSharedValue(CURRENT_INVOICE_CARD_INDEX);
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
        const isManual = !!selectedCard?.closingDateSettings?.applyToAll || Object.keys(selectedCard?.closingDateSettings?.monthOverrides || {}).length > 0;

        const getFallbackDueInfo = () => {
            let closingDay = String(invoiceData.periods?.closingDay || '-');
            let dueDay = String(invoiceData.periods?.dueDay || '-');

            // Tenta pegar do Pluggy primeiro (fatura atual)
            if (selectedCard?.currentBill?.closeDate) {
                const closeDateParsed = parseIsoDateValue(selectedCard.currentBill.closeDate);
                if (closeDateParsed) {
                    closingDay = String(closeDateParsed.getDate());
                }
            } else if (selectedCard?.balanceCloseDate) {
                const balanceClose = parseIsoDateValue(selectedCard.balanceCloseDate);
                if (balanceClose) {
                    closingDay = String(balanceClose.getDate());
                }
            }

            if (selectedCard?.currentBill?.dueDate) {
                const dueDateParsed = parseIsoDateValue(selectedCard.currentBill.dueDate);
                if (dueDateParsed) {
                    dueDay = String(dueDateParsed.getDate());
                }
            } else if (selectedCard?.balanceDueDate) {
                const balanceDue = parseIsoDateValue(selectedCard.balanceDueDate);
                if (balanceDue) {
                    dueDay = String(balanceDue.getDate());
                }
            }

            // FALLBACK PARA CONFIGURAÇÃO MANUAL (Se ativado)
            if (selectedCard?.closingDateSettings?.lastClosingDate) {
                const manualDate = parseIsoDateValue(selectedCard.closingDateSettings.lastClosingDate);
                if (manualDate) {
                    closingDay = String(manualDate.getDate());
                    // Estimar vencimento (fechamento + 10 dias)
                    const estimatedDue = new Date(manualDate);
                    estimatedDue.setDate(estimatedDue.getDate() + 10);
                    dueDay = String(estimatedDue.getDate());
                }
            }

            return `Fecha ${closingDay} - Vence ${dueDay}`;
        };

        const formatDueInfo = (closingDate: Date, dueDate: Date) => {
            if (isManual) {
                const manualParsed = parseIsoDateValue(selectedCard?.closingDateSettings?.lastClosingDate);
                if (manualParsed) {
                    return `Fechamento manual ${formatDateShort(manualParsed)}`;
                }
                return `Fechamento manual ${formatDateShort(closingDate)}`;
            }

            // Fallback para exibir certinho como antes se a engine não calculou um date válido
            if (isNaN(closingDate.getTime()) || isNaN(dueDate.getTime())) {
                return getFallbackDueInfo();
            }

            return `Fecha ${closingDate.getDate()} - Vence ${dueDate.getDate()}`;
        };

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
                dateRange: formatInvoiceRange(
                    invoiceData.closedInvoice.startDate,
                    invoiceData.closedInvoice.closingDate,
                    invoiceData.periods.lastInvoiceStart,
                    invoiceData.periods.lastClosingDate
                ),
                dueInfo: formatDueInfo(
                    coerceInvoiceDate(invoiceData.closedInvoice.closingDate, invoiceData.periods.lastClosingDate),
                    coerceInvoiceDate(invoiceData.closedInvoice.dueDate, invoiceData.periods.lastDueDate)
                ),
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
                dateRange: formatInvoiceRange(
                    invoiceData.currentInvoice.startDate,
                    invoiceData.currentInvoice.closingDate,
                    invoiceData.periods.currentInvoiceStart,
                    invoiceData.periods.currentClosingDate
                ),
                dueInfo: formatDueInfo(
                    coerceInvoiceDate(invoiceData.currentInvoice.closingDate, invoiceData.periods.currentClosingDate),
                    coerceInvoiceDate(invoiceData.currentInvoice.dueDate, invoiceData.periods.currentDueDate)
                ),
                status: invoiceData.currentInvoice.status,
                tabId: 'current',
                itemCount: invoiceData.currentInvoice.items.length
            }
        ];

        return items;
    }, [invoiceData, historyTotal, selectedCard]);

    const goToCard = useCallback((index: number, emit = true) => {
        if (index >= 0 && index < data.length && index !== currentIndex) {
            triggerIOSCoreMorph();
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
        <Animated.View entering={IOS_FADE_IN} layout={IOS_CORE_LAYOUT} style={styles.carouselContainer}>
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
                        <IOSTouchable
                            key={item.key}
                            onPress={() => goToCard(index)}
                            style={styles.dotTouchable}
                            activeOpacity={1}
                        >
                            <View style={[
                                styles.paginationDot,
                                index === currentIndex && styles.paginationDotActive
                            ]} />
                        </IOSTouchable>
                    ))}
                </View>
            </View>
        </Animated.View>
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

// Fun├º├úo movida para fora do componente para evitar recria├º├úo, mas getCategoryConfig depende de cores...
// Movo ela de volta para dentro ou crio uma vers├úo que aceita cores? 
// No momento, vou restaurar o getCategoryConfig mas simplificado ou importado?
// Melhor: Vou recriar as fun├º├Áes aqui, pois elas s├úo puras, MAS o translateCategory agora ├® via hook.

// Re-implementing helper functions locally or importing if available.
// Since getCategoryConfig suggests colors, keep it here for now but renamed or scoped?
// User wants dynamic categories. The hook gives `getCategoryName`.
// The `getCategoryConfig` is for ICONS and COLORS, based on keywords. 
// It should largely remain but perhaps check the CUSTOM LABEL too? 
// For now, let's keep `getCategoryConfig` but defined BEFORE it's used.

// ... Wait, I deleted them in the previous step but the linter complained they are missing.
// I will restore `getCategoryConfig` and integrate `useCategories` hook inside the component.

// Cache do Intl.DateTimeFormat para performance
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const monthShortFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const monthLongFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

// Fun├º├úo movida para fora do componente para evitar recria├º├úo
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

// Memoizado para evitar re-renders desnecess├írios
const TransactionItem = React.memo(({
    item,
    index,
    total,
    onDelete,
    onRefund,
    onLongPress,
    getCategoryName,
    animateRow = true,
    isMoving = false,
    refundedAmount,
    refundSourceItem
}: {
    item: InvoiceItem;
    index: number;
    total: number;
    onDelete?: (item: InvoiceItem) => void;
    onRefund?: (item: InvoiceItem) => void;
    onLongPress?: (item: InvoiceItem) => void;
    getCategoryName: (key?: string) => string;
    animateRow?: boolean;
    isMoving?: boolean;
    refundedAmount?: number;
    refundSourceItem?: InvoiceItem;
}) => {
    const [showActions, setShowActions] = useState(false);

    const isExpense = item.type === 'expense';
    const isPayment = item.isPayment;
    const isProjected = item.isProjected;
    const isRefund = item.isRefund;
    const hasRefundTag = !isRefund && (refundedAmount ?? 0) > 0;
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const cardRef = React.useRef<View>(null);
    const hideInstallments = isNonInstallmentMerchant(item.description);

    // Pode fazer estorno apenas se: n├úo ├® projetada, n├úo ├® pagamento, n├úo ├® estorno
    const canRefund = !isProjected && !isPayment && !isRefund;

    const amountColor = isPayment || isRefund ? '#04D361' : (isProjected ? '#60BC57' : '#FFFFFF');

    const borderStyle = {
        borderTopLeftRadius: hasRefundTag ? 0 : (isFirst ? 12 : 0),
        borderTopRightRadius: hasRefundTag ? 0 : (isFirst ? 12 : 0),
        borderBottomLeftRadius: isLast ? 12 : 0,
        borderBottomRightRadius: isLast ? 12 : 0,
    };

    const handlePress = () => {
        if (isMoving) return;
        triggerIOSCoreMorph();
        if (showActions) {
            setShowActions(false);
            return;
        }
        if (onLongPress) {
            onLongPress(item);
        } else if (onDelete) {
            setShowActions(true);
        }
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(item);
            setShowActions(false);
        }
    };

    const handleRefundCardPress = () => {
        if (isMoving) return;
        if (refundSourceItem && onLongPress) {
            onLongPress(refundSourceItem);
            return;
        }
        if (onLongPress) {
            onLongPress(item);
        }
    };

    return (
        <View style={styles.transactionCardWrapper}>
            {hasRefundTag && (
                <IOSTouchable
                    activeOpacity={1}
                    style={styles.refundTopCardPressable}
                    onPress={handleRefundCardPress}
                    disabled={isMoving}
                >
                    <View style={styles.refundTopCard}>
                        <TimedLottieIcon
                            source={require('@/assets/assinaturabranco.json')}
                            style={styles.refundTopCardIcon}
                        />
                        <Text numberOfLines={1} style={styles.refundTopCardText}>
                            {`Transação reembolsada no valor de ${formatCurrency(refundedAmount ?? 0)}`}
                        </Text>
                    </View>
                </IOSTouchable>
            )}
            <IOSTouchable
                activeOpacity={1}
                onPress={handlePress}
                disabled={isMoving}
                style={{ width: '100%' }}
            >
                <Animated.View
                    ref={cardRef}
                    layout={animateRow ? IOS_CORE_LAYOUT : undefined}
                    entering={animateRow ? IOS_FADE_IN : undefined}
                    exiting={animateRow ? IOS_FADE_OUT : undefined}
                    style={[
                        styles.transactionCard,
                        borderStyle
                    ]}
                >
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
                                colors={['transparent', '#101010']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0.5, y: 0 }}
                                style={{ position: 'absolute', top: 0, bottom: 0, left: -40, right: 0 }}
                            />
                            {canRefund && onRefund && (
                                <IOSTouchable
                                    style={[styles.actionButton, { backgroundColor: 'transparent', borderWidth: 0, marginRight: 8 }]}
                                    onPress={() => {
                                        setShowActions(false);
                                        onRefund(item);
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    activeOpacity={1}
                                >
                                    <RotateCcw size={20} color="#4ADE80" />
                                </IOSTouchable>
                            )}
                            <IOSTouchable
                                style={[styles.actionButton, { backgroundColor: 'transparent', borderWidth: 0 }]}
                                onPress={handleDelete}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                activeOpacity={1}
                            >
                                <Trash2 size={20} color="#FF453A" />
                            </IOSTouchable>
                        </Animated.View>
                    ) : (
                        <View style={styles.amountContainer}>
                            <Text style={[
                                styles.amount,
                                { color: amountColor }
                            ]}>
                                {isPayment || isRefund ? '+ ' : '- '}{formatCurrency(item.amount)}
                            </Text>

                            {!hideInstallments && (item.totalInstallments && item.totalInstallments > 1) && (
                                <View style={styles.installmentPill}>
                                    <Text style={styles.installmentPillText}>
                                        {item.installmentNumber}/{item.totalInstallments}
                                    </Text>
                                </View>
                            )}

                            {!hideInstallments && isProjected && (!item.totalInstallments || item.totalInstallments <= 1) && (
                                <View style={styles.installmentPill}>
                                    <Text style={styles.installmentPillText}>PARCELADO</Text>
                                </View>
                            )}
                        </View>
                    )}
                    {isMoving && (
                        <View style={styles.transactionMovingOverlay} pointerEvents="none">
                            <BlurView
                                intensity={35}
                                tint="dark"
                                experimentalBlurMethod="dimezisBlurView"
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.transactionMovingContent}>
                                <ActivityIndicator size="small" color="#F5F5F7" />
                            </View>
                        </View>
                    )}
                    {!isLast && <View style={styles.separator} />}
                </Animated.View>
            </IOSTouchable>
        </View>
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


export function CreditCardInvoice({
    transactions,
    creditCards,
    userId,
    onRefresh,
    refreshing = false,
    onLoadMoreHistory,
    hasMoreHistory = false,
    loadingMoreHistory = false
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

                if (newMode === 'all' || newMode === 'last' || newMode === 'current') {
                    tabToSet = newMode as InvoiceTab;
                } else if (newMode === 'next' || newMode === 'overdue' || (typeof newMode === 'string' && /^future_\d+$/.test(newMode))) {
                    tabToSet = 'current';
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

        if (userId) {
            databaseService.saveInvoiceViewMode(userId, tab);
        }
    }, [userId]);
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [showInvoiceCards, setShowInvoiceCards] = useState(true);


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

    // Transaction Options State
    const [transactionOptionsVisible, setTransactionOptionsVisible] = useState(false);
    const [selectedTransactionForOptions, setSelectedTransactionForOptions] = useState<InvoiceItem | null>(null);
    const [transactionSearchModalVisible, setTransactionSearchModalVisible] = useState(false);
    const [invoiceActionsModalVisible, setInvoiceActionsModalVisible] = useState(false);
    const [transactionSearchQuery, setTransactionSearchQuery] = useState('');
    const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<InvoiceItem | null>(null);

    // Closing Date Modal State
    const [closingDateModalVisible, setClosingDateModalVisible] = useState(false);

    // Category Selector Modal State
    const [categorySelectorVisible, setCategorySelectorVisible] = useState(false);
    const [categoryChangeTarget, setCategoryChangeTarget] = useState<InvoiceItem | null>(null);
    const [pendingTransactionAction, setPendingTransactionAction] = useState<{ id: string; label: string } | null>(null);
    const [localTransactionOverrides, setLocalTransactionOverrides] = useState<Record<string, Partial<Transaction>>>({});
    const [localRemovedTransactionIds, setLocalRemovedTransactionIds] = useState<Record<string, true>>({});

    const handleOpenTransactionOptions = useCallback((item: InvoiceItem) => {
        setSelectedTransactionForOptions(item);
        setTransactionOptionsVisible(true);
    }, []);

    useEffect(() => {
        if (transactionSearchModalVisible) return;
        setTransactionSearchQuery('');
    }, [transactionSearchModalVisible]);

    // Handler para abrir o seletor de categoria
    const handleOpenCategorySelector = useCallback((item: InvoiceItem) => {
        setTransactionOptionsVisible(false);
        setCategoryChangeTarget(item);
        setCategorySelectorVisible(true);
    }, []);

    // Handler para salvar a nova categoria
    const handleCategoryChange = useCallback(async (categoryKey: string) => {
        if (!categoryChangeTarget) return;
        const target = categoryChangeTarget;
        const actionStartedAt = Date.now();
        setCategorySelectorVisible(false);
        setCategoryChangeTarget(null);
        setPendingTransactionAction({ id: target.id, label: 'Editando categoria...' });
        try {
            const result = await databaseService.updateCreditCardTransaction(
                userId,
                target.id,
                { category: categoryKey }
            );
            if (!result?.success) {
                throw new Error(result?.error || 'Erro ao alterar categoria');
            }

            setLocalTransactionOverrides((prev) => ({
                ...prev,
                [target.id]: {
                    ...(prev[target.id] || {}),
                    category: categoryKey
                }
            }));
        } catch (error) {
            console.error('Erro ao alterar categoria:', error);
        } finally {
            const elapsed = Date.now() - actionStartedAt;
            if (elapsed < 350) {
                await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
            }
            setPendingTransactionAction((current) => (
                current?.id === target.id ? null : current
            ));
        }
    }, [categoryChangeTarget, userId]);


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

        return null;
    }, [invoiceData, selectedTab]);

    // Move options para o TransactionOptionsModal
    const transactionMoveOptions = useMemo(() => {
        if (!selectedTransactionForOptions || !invoiceData) return [];
        const tabMonthKey = getSelectedTabMonthKey();
        if (!tabMonthKey) return [];

        const prevMonth = shiftMonthKey(tabMonthKey, -1);
        const nextMonth = shiftMonthKey(tabMonthKey, 1);

        const formatMonthLabel = (mk: string | null): string => {
            if (!mk) return '';
            const [y, m] = mk.split('-');
            const d = new Date(Number(y), Number(m) - 1, 1);
            let monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d);
            monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            return `${monthName} de ${y}`;
        };

        const options: { target: 'prev' | 'next'; label: string; date?: string; icon?: 'prev' | 'next' }[] = [];
        if (prevMonth && selectedTab === 'current') {
            options.push({ target: 'prev', label: `Fatura Anterior (${formatMonthLabel(prevMonth)})`, icon: 'prev' });
        }
        if (nextMonth && selectedTab === 'last') {
            options.push({ target: 'next', label: `Próxima Fatura (${formatMonthLabel(nextMonth)})`, icon: 'next' });
        }
        return options;
    }, [selectedTransactionForOptions, invoiceData, getSelectedTabMonthKey, shiftMonthKey, selectedTab]);

    const handleMoveTransaction = useCallback(async (target: 'prev' | 'next' | 'current' | 'custom', customDate?: string) => {
        if (!selectedTransactionForOptions) return;
        const transactionToMove = selectedTransactionForOptions;
        if (transactionToMove.isProjected && !((transactionToMove.totalInstallments ?? 0) > 1)) {
            console.warn('[CreditCardInvoice] Cannot move projected non-installment transaction:', transactionToMove.id);
            return;
        }

        const normalizedCurrentDate = normalizeIsoDate(transactionToMove.date);
        if (!normalizedCurrentDate) {
            console.error('[CreditCardInvoice] Invalid transaction date for move:', transactionToMove.date);
            return;
        }

        const moveStartedAt = Date.now();
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
                updateData.invoiceMonthKeyManual = true;
                updateData.manualInvoiceMonth = customIsoDate.slice(0, 7);
            } else if (target === 'next' || target === 'prev') {
                const selectedTabMonthKey = getSelectedTabMonthKey();
                const baseMonthKey = selectedTabMonthKey || normalizedCurrentDate.slice(0, 7);
                const shiftedMonthKey = shiftMonthKey(baseMonthKey, target === 'next' ? 1 : -1);

                if (!shiftedMonthKey) {
                    console.error('[CreditCardInvoice] Invalid month key for move:', baseMonthKey);
                    return;
                }

                const [yStr, mStr, dStr] = normalizedCurrentDate.split('-');
                let year = parseInt(yStr, 10);
                let month = parseInt(mStr, 10) + (target === 'next' ? 1 : -1);

                if (month > 12) { month = 1; year++; }
                if (month < 1) { month = 12; year--; }

                // Tratar fim do mês
                const daysInNewMonth = new Date(year, month, 0).getDate();
                const newDay = Math.min(parseInt(dStr, 10), daysInNewMonth);

                const newDateStr = `${year}-${String(month).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;

                updateData.date = newDateStr;
                updateData.invoiceMonthKey = newDateStr.slice(0, 7);
                updateData.invoiceMonthKeyManual = true;
                updateData.manualInvoiceMonth = newDateStr.slice(0, 7);
            } else {
                // "current" clears manual override and falls back to date-based classification.
                updateData.invoiceMonthKey = normalizedCurrentDate.slice(0, 7);
                updateData.invoiceMonthKeyManual = false;
                updateData.manualInvoiceMonth = null as any;
            }

            const cleanUpdateData: Record<string, any> = { ...updateData };
            // Certifique-se de que nada é literalmente 'undefined'
            Object.keys(cleanUpdateData).forEach((key) => {
                if ((cleanUpdateData as any)[key] === undefined) {
                    (cleanUpdateData as any)[key] = null;
                }
            });

            // Limpa billId do Pluggy para que a override manual tenha prioridade total
            // Sincronizado com a web (CreditCards.ts updateTransactionInvoice)
            if (target !== 'current') {
                cleanUpdateData['creditCardMetadata.billId'] = null;
            }

            setTransactionOptionsVisible(false);
            setSelectedTransactionForOptions(null);
            setPendingTransactionAction({ id: transactionToMove.id, label: 'Movendo...' });

            const result = await databaseService.updateCreditCardTransaction(
                userId,
                transactionToMove.id,
                cleanUpdateData
            );
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to update credit card transaction');
            }

            const patch: Partial<Transaction> = {};
            if (typeof cleanUpdateData.date === 'string') {
                patch.date = cleanUpdateData.date;
            }
            if (typeof cleanUpdateData.invoiceMonthKey === 'string') {
                patch.invoiceMonthKey = cleanUpdateData.invoiceMonthKey;
            } else if ('invoiceMonthKey' in cleanUpdateData && cleanUpdateData.invoiceMonthKey == null) {
                patch.invoiceMonthKey = undefined;
            }
            if (typeof cleanUpdateData.invoiceMonthKeyManual === 'boolean') {
                patch.invoiceMonthKeyManual = cleanUpdateData.invoiceMonthKeyManual;
            }
            if (typeof cleanUpdateData.manualInvoiceMonth === 'string') {
                patch.manualInvoiceMonth = cleanUpdateData.manualInvoiceMonth;
            } else if ('manualInvoiceMonth' in cleanUpdateData && cleanUpdateData.manualInvoiceMonth == null) {
                patch.manualInvoiceMonth = undefined;
            }

            // Limpa billId local para refletir a mudança imediatamente
            const txMeta = (transactionToMove as any).creditCardMetadata;
            if (target !== 'current' && txMeta) {
                (patch as any).creditCardMetadata = {
                    ...txMeta,
                    billId: null
                };
            }

            setLocalTransactionOverrides((prev) => ({
                ...prev,
                [transactionToMove.id]: {
                    ...(prev[transactionToMove.id] || {}),
                    ...patch
                }
            }));
        } catch (error) {
            console.error('Error moving transaction:', error);
        } finally {
            const elapsed = Date.now() - moveStartedAt;
            if (elapsed < 350) {
                await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
            }
            setPendingTransactionAction((current) => (
                current?.id === transactionToMove.id ? null : current
            ));
        }
    }, [
        selectedTransactionForOptions,
        normalizeIsoDate,
        parseCustomDateToIso,
        getSelectedTabMonthKey,
        shiftMonthKey,
        userId
    ]);

    const handleApplyFilters = (newFilters: FilterState) => {
        // Trigger LayoutAnimation for smooth transition
        triggerIOSCoreMorph();
        setFilters(newFilters);
    };

    const clearFilters = () => {
        triggerIOSCoreMorph();
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

    const requestDeleteTransaction = useCallback((item: InvoiceItem) => {
        setTransactionOptionsVisible(false);
        setSelectedTransactionForOptions(null);
        setTransactionToDelete(item);
        setDeleteConfirmationVisible(true);
    }, []);

    const handleDeleteTransaction = useCallback(async (item: InvoiceItem) => {
        const actionStartedAt = Date.now();
        let deleteSucceeded = false;
        setPendingTransactionAction({ id: item.id, label: 'Excluindo...' });
        try {
            // A confirmação visual já foi feita pelo modal de confirmação
            await databaseService.deleteOpenFinanceCreditCardTransaction(userId, item.id);
            deleteSucceeded = true;
        } catch (error) {
            console.error('Erro ao excluir transa├º├úo:', error);
        } finally {
            const elapsed = Date.now() - actionStartedAt;
            if (elapsed < 350) {
                await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
            }
            if (deleteSucceeded) {
                setLocalRemovedTransactionIds((prev) => ({
                    ...prev,
                    [item.id]: true
                }));
                setLocalTransactionOverrides((prev) => {
                    if (!(item.id in prev)) return prev;
                    const { [item.id]: _removed, ...rest } = prev;
                    return rest;
                });
            }
            setPendingTransactionAction((current) => (
                current?.id === item.id ? null : current
            ));
        }
    }, [userId]);

    const handleConfirmDeleteTransaction = useCallback(async () => {
        if (!transactionToDelete) return;
        const target = transactionToDelete;
        setDeleteConfirmationVisible(false);
        setTransactionToDelete(null);
        await handleDeleteTransaction(target);
    }, [handleDeleteTransaction, transactionToDelete]);

    // Handler para abrir modal de estorno
    const handleOpenRefundModal = useCallback((item: InvoiceItem) => {
        setTransactionOptionsVisible(false);
        setRefundTransaction(item);
        setRefundModalVisible(true);
    }, []);

    // Handler para confirmar estorno - cria nova transa├º├úo de cr├®dito
    const handleConfirmRefund = useCallback(async (
        transaction: { id: string; description: string; amount: number; date: string; category?: string; cardId?: string; accountId?: string },
        customAmount?: number
    ) => {
        const actionStartedAt = Date.now();
        const refundAmount = customAmount ?? transaction.amount;
        const now = new Date();
        const refundDate = transaction.date;

        setPendingTransactionAction({ id: transaction.id, label: 'Criando estorno...' });
        setRefundModalVisible(false);
        setRefundTransaction(null);

        try {
            // Criar nova transação de estorno
            const refundTransactionData = {
                description: `Estorno - ${transaction.description}`,
                amount: refundAmount,
                type: 'income' as const,
                date: refundDate,
                category: 'Refund',
                cardId: transaction.cardId || transaction.accountId || selectedCardId,
                isRefund: true,
                originalTransactionId: transaction.id,
                installmentNumber: 1,
                totalInstallments: 1,
                status: 'completed',
                source: 'manual-refund',
                createdAt: now.toISOString()
            };

            // Sanitizar ID para evitar barras que quebram o Firestore
            const sanitizedId = String(transaction.id).replace(/[\/\s\.]/g, '_');
            const refundId = `refund-${sanitizedId}-${Date.now()}`;

            // Salvar no Firebase
            const result = await databaseService.saveOpenFinanceCreditCardTransaction(
                userId,
                {
                    id: refundId,
                    ...refundTransactionData,
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
        } catch (error: any) {
            console.error('[Refund] Error confirming refund:', error);
            // Mostrar alerta apenas no ambiente real se houver erro crítico
            alert('Não foi possível realizar o estorno: ' + (error.message || 'Erro desconhecido'));
        } finally {
            const elapsed = Date.now() - actionStartedAt;
            if (elapsed < 350) {
                await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
            }
            setPendingTransactionAction((current) => (
                current?.id === transaction.id ? null : current
            ));
        }
    }, [userId, selectedCardId, onRefresh]);

    useEffect(() => {
        if (creditCards.length > 0 && !selectedCardId) setSelectedCardId(creditCards[0].id);
    }, [creditCards]);

    useEffect(() => {
        setLocalTransactionOverrides((prev) => {
            const prevEntries = Object.entries(prev);
            if (prevEntries.length === 0) return prev;

            const transactionIds = new Set(transactions.map((tx) => tx.id));
            let changed = false;
            const next: Record<string, Partial<Transaction>> = {};

            prevEntries.forEach(([id, patch]) => {
                if (transactionIds.has(id)) {
                    next[id] = patch;
                    return;
                }
                changed = true;
            });

            return changed ? next : prev;
        });

        setLocalRemovedTransactionIds((prev) => {
            const removedIds = Object.keys(prev);
            if (removedIds.length === 0) return prev;

            const transactionIds = new Set(transactions.map((tx) => tx.id));
            let changed = false;
            const next: Record<string, true> = {};

            removedIds.forEach((id) => {
                if (transactionIds.has(id)) {
                    next[id] = true;
                    return;
                }
                changed = true;
            });

            return changed ? next : prev;
        });
    }, [transactions]);

    const effectiveTransactions = useMemo(() => {
        const hasOverrides = Object.keys(localTransactionOverrides).length > 0;
        const hasRemoved = Object.keys(localRemovedTransactionIds).length > 0;
        if (!hasOverrides && !hasRemoved) return transactions;

        const visibleTransactions = hasRemoved
            ? transactions.filter((tx) => !localRemovedTransactionIds[tx.id])
            : transactions;

        if (!hasOverrides) return visibleTransactions;

        return visibleTransactions.map((tx) => {
            const override = localTransactionOverrides[tx.id];
            if (!override) return tx;
            return { ...tx, ...override };
        });
    }, [transactions, localTransactionOverrides, localRemovedTransactionIds]);

    const selectedCard = useMemo(() => creditCards.find(c => c.id === selectedCardId) || null, [creditCards, selectedCardId]);
    const transactionsByCard = useMemo(() => {
        const map = new Map<string, Transaction[]>();
        effectiveTransactions.forEach((tx) => {
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
    }, [effectiveTransactions]);

    // PR├ë0-FILTRAR transa├º├Áes pelo cart├úo selecionado ANTES de passar para buildInvoices
    // Isso garante que cada cart├úo receba APENAS suas pr├│prias transa├º├Áes
    const filteredTransactions = useMemo(() => {
        if (!selectedCardId || selectedCardId === 'all') {
            return effectiveTransactions;
        }
        return transactionsByCard.get(selectedCardId) || [];
    }, [selectedCardId, effectiveTransactions, transactionsByCard]);

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

    // Só exigir configuração manual se NÃO houver qualquer dado automático do Pluggy.
    const hasManualConfig = Boolean(selectedCard?.closingDateSettings?.lastClosingDate);
    const hasAutomaticBillingData = Boolean(
        normalizePluggyDate(selectedCard?.currentBill?.periodEnd || null) ||
        normalizePluggyDate(selectedCard?.currentBill?.closeDate || null) ||
        normalizePluggyDate(selectedCard?.currentBill?.dueDate || null) ||
        normalizePluggyDate(selectedCard?.balanceCloseDate || null) ||
        normalizePluggyDate(selectedCard?.balanceDueDate || null)
    );
    const needsConfiguration = Boolean(selectedCard && !hasManualConfig && !hasAutomaticBillingData);

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
                const nextData = buildInvoicesPluggyFirst(selectedCard, invoiceComputationTransactions, selectedCardId);
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

    const closingDateModalItems = useMemo<ClosingDateItem[]>(() => {
        if (!invoiceData) return [];

        const periods = invoiceData.periods;
        const getClosingDate = (rawDate: string | undefined, fallbackDate: Date): string | null =>
            normalizeIsoDateValue(rawDate) || toIsoDateValue(fallbackDate) || null;

        const candidates: Array<{ id: string; label: string; currentDate: string | null }> = [
            {
                id: 'overdue',
                label: 'Fatura atrasada',
                currentDate: getClosingDate(invoiceData.beforeLastInvoice.closingDate, periods.beforeLastClosingDate)
            },
            {
                id: 'last',
                label: 'Fatura anterior',
                currentDate: getClosingDate(invoiceData.closedInvoice.closingDate, periods.lastClosingDate)
            },
            {
                id: 'current',
                label: 'Fatura atual',
                currentDate: getClosingDate(invoiceData.currentInvoice.closingDate, periods.currentClosingDate)
            },
            {
                id: 'next',
                label: 'Próxima fatura',
                currentDate: getClosingDate(invoiceData.futureInvoices[0]?.closingDate, periods.nextClosingDate)
            },
            {
                id: 'following',
                label: 'Fatura seguinte',
                currentDate: getClosingDate(invoiceData.futureInvoices[1]?.closingDate, periods.followingClosingDate)
            }
        ];

        const items: ClosingDateItem[] = [];

        candidates.forEach(({ id, label, currentDate }) => {
            if (!currentDate) return;
            const monthKey = currentDate.slice(0, 7);

            const monthLabel = formatShortMonthPt(currentDate);
            items.push({
                id,
                monthKey,
                label: `${label} (${monthLabel})`,
                subLabel: `Fechamento (${monthLabel})`,
                currentDate
            });
        });

        return items;
    }, [invoiceData]);

    const originalCloseDate = useMemo(() => {
        if (!selectedCard) return null;
        const rawDate =
            selectedCard.currentBill?.periodEnd ||
            selectedCard.currentBill?.closeDate ||
            selectedCard.balanceCloseDate ||
            null;
        const parsed = parseIsoDateValue(rawDate);
        return parsed ? formatDateFull(parsed) : null;
    }, [selectedCard]);

    const originalDueDate = useMemo(() => {
        if (!selectedCard) return null;
        const rawDate =
            selectedCard.currentBill?.dueDate ||
            selectedCard.balanceDueDate ||
            null;
        const parsed = parseIsoDateValue(rawDate);
        return parsed ? formatDateFull(parsed) : null;
    }, [selectedCard]);

    const handleSaveClosingDates = useCallback(async (updates: { id: string; exactDate: string }[]) => {
        if (!selectedCard) return;

        const existingSettings = selectedCard.closingDateSettings || {};
        const mergedOverrides: Record<string, { closingDay?: number; exactDate?: string }> = {
            ...(existingSettings.monthOverrides || {})
        };

        updates.forEach((update) => {
            const normalizedDate = normalizeIsoDateValue(update.exactDate);
            if (!normalizedDate) return;
            const closingDay = Number(normalizedDate.split('-')[2]);

            mergedOverrides[update.id] = {
                ...(mergedOverrides[update.id] || {}),
                exactDate: normalizedDate,
                closingDay
            };
        });

        const nextSettings = {
            ...existingSettings,
            closingDay: existingSettings.closingDay ?? invoiceData?.periods.closingDay,
            applyToAll: existingSettings.applyToAll ?? false,
            lastClosingDate: existingSettings.lastClosingDate ?? normalizeIsoDateValue(invoiceData?.closedInvoice?.closingDate),
            monthOverrides: mergedOverrides,
            updatedAt: new Date().toISOString()
        };

        const result = await databaseService.updateAccount(userId, selectedCard.id, {
            closingDateSettings: nextSettings
        });

        if (!result?.success) {
            throw new Error(result?.error || 'Nao foi possivel salvar os fechamentos');
        }

        if (onRefresh) {
            await onRefresh();
        }
    }, [invoiceData, onRefresh, selectedCard, userId]);

    // currentItems computado primeiro para alimentar agrupamento e tags de estorno
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

    const transactionSearchResults = useMemo(() => {
        const query = transactionSearchQuery.trim().toLowerCase();
        const baseItems = currentItems;
        if (!query) {
            return baseItems;
        }

        return baseItems.filter((item) => {
            const description = (item.description || '').toLowerCase();
            const category = getCategoryName(item.category).toLowerCase();
            const amount = String(Math.abs(item.amount || 0));
            const date = item.date || '';
            return (
                description.includes(query) ||
                category.includes(query) ||
                amount.includes(query) ||
                date.includes(query)
            );
        });
    }, [currentItems, getCategoryName, transactionSearchQuery]);

    const handleOpenTransactionOptionsFromSearch = useCallback((item: InvoiceItem) => {
        setTransactionSearchModalVisible(false);
        setTransactionSearchQuery('');
        setSelectedTransactionForOptions(item);
        setTransactionOptionsVisible(true);
    }, []);

    const refundAmountByOriginalId = useMemo(() => {
        const map = new Map<string, number>();
        currentItems.forEach((item) => {
            if (!item.isRefund || !item.originalTransactionId) return;
            const currentTotal = map.get(item.originalTransactionId) || 0;
            map.set(item.originalTransactionId, currentTotal + Math.abs(item.amount || 0));
        });
        return map;
    }, [currentItems]);

    const refundSourceByOriginalId = useMemo(() => {
        const map = new Map<string, InvoiceItem>();
        currentItems.forEach((item) => {
            if (!item.isRefund || !item.originalTransactionId) return;
            if (!map.has(item.originalTransactionId)) {
                map.set(item.originalTransactionId, item);
            }
        });
        return map;
    }, [currentItems]);

    // Group transactions by date
    const groupedItems = useMemo(() => {
        if (currentItems.length === 0) return [];
        // currentItems is already built in reverse chronological order.
        const sorted = currentItems;
        const sortedIds = new Set(sorted.map(item => item.id));
        // Esconde o card de estorno quando a transação original está na lista.
        const visibleItems = sorted.filter((item) => {
            if (!(item.isRefund && item.originalTransactionId)) return true;
            return !sortedIds.has(item.originalTransactionId);
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
            const normalized = normalizePluggyDate(dateIso) || dateIso;
            const date = new Date(`${normalized}T12:00:00`);
            if (isNaN(date.getTime())) return normalized || 'Data inválida';
            const day = date.getDate();
            if (normalized === todayYMD) return `HOJE, ${day} ${getMonthShortUpper(date)}`;
            if (normalized === yesterdayYMD) return `ONTEM, ${day} ${getMonthShortUpper(date)}`;
            return `${day} ${getMonthLongUpper(date)}`;
        };

        visibleItems.forEach(item => {
            const header = getHeader(item.date);

            if (!currentGroup || currentGroup.title !== header) {
                currentGroup = { title: header, items: [] };
                groups.push(currentGroup);
            }
            currentGroup.items.push(item);
        });
        return groups;
    }, [currentItems]);

    // Calcular anos dispon├¡veis
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

    // Calcular categorias dispon├¡veis das transa├º├Áes
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();

        filteredTransactions.forEach(t => {
            if (t.category) {
                cats.add(t.category);
            }
        });

        // Ordenar alfabeticamente pelo nome traduzido (Portugu├¬s)
        return Array.from(cats).sort((a, b) => {
            const nameA = getCategoryName(a);
            const nameB = getCategoryName(b);
            return nameA.localeCompare(nameB, 'pt-BR');
        });
    }, [filteredTransactions, getCategoryName]);

    const visibleItemsLength = useMemo(
        () => groupedItems.reduce((total, group) => total + group.items.length, 0),
        [groupedItems]
    );
    const animateRows = lod <= 1 && visibleItemsLength <= 80;
    const groupedSections = useMemo(
        () => groupedItems.map(group => ({ title: group.title, data: group.items })),
        [groupedItems]
    );

    const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
        <Animated.View entering={IOS_FADE_IN} layout={IOS_CORE_LAYOUT} style={styles.groupContainer}>
            <Text style={styles.groupHeader}>{section.title}</Text>
        </Animated.View>
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
            onDelete={requestDeleteTransaction}
            onRefund={handleConfirmRefund}
            onLongPress={handleOpenTransactionOptions}
            getCategoryName={getCategoryName}
            animateRow={animateRows}
            isMoving={pendingTransactionAction?.id === item.id}
            refundedAmount={refundAmountByOriginalId.get(item.id)}
            refundSourceItem={refundSourceByOriginalId.get(item.id)}
        />
    ), [
        animateRows,
        getCategoryName,
        handleConfirmRefund,
        handleOpenTransactionOptions,
        pendingTransactionAction,
        requestDeleteTransaction,
        refundAmountByOriginalId,
        refundSourceByOriginalId
    ]);

    const keyExtractor = useCallback((item: InvoiceItem) => item.id, []);

    const handleLoadMoreHistory = useCallback(() => {
        if (selectedTab !== 'all' || !onLoadMoreHistory || !hasMoreHistory || loadingMoreHistory) {
            return;
        }
        onLoadMoreHistory();
    }, [hasMoreHistory, loadingMoreHistory, onLoadMoreHistory, selectedTab]);

    const toggleInvoiceCards = useCallback(() => {
        triggerIOSCoreMorph();
        setShowInvoiceCards((prev) => !prev);
    }, []);

    const closeInvoiceActionsAndRun = useCallback((action: () => void) => {
        setInvoiceActionsModalVisible(false);
        action();
    }, []);

    if (creditCards.length === 0) return (
        <View style={styles.screen}>
            <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Image
                        source={require('@/assets/images/icon.png')}
                        style={styles.headerIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.screenHeader}>Fatura do cartão</Text>
                </View>
            </View>
            <View style={styles.emptyState}>
                <DelayedLoopLottie
                    source={require('@/assets/cartabranco.json')}
                    style={styles.emptyLottie}
                    delay={3000}
                    initialDelay={100}
                    jitterRatio={0.2}
                    renderMode="HARDWARE"
                />
                <Text style={styles.emptyTitle}>Nenhum cartão</Text>
                <Text style={styles.emptyText}>Conecte um cartão para visualizar suas faturas.</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.screen}>


            <TransactionOptionsModal
                visible={transactionOptionsVisible}
                onClose={() => {
                    setTransactionOptionsVisible(false);
                    setSelectedTransactionForOptions(null);
                }}
                transaction={selectedTransactionForOptions}
                onMoveInvoice={handleMoveTransaction}
                onDelete={(item) => {
                    requestDeleteTransaction(item);
                }}
                onRefund={(item) => {
                    setTransactionOptionsVisible(false);
                    handleOpenRefundModal(item);
                }}
                onChangeCategory={handleOpenCategorySelector}
                moveOptions={transactionMoveOptions}
                loading={false}
            />

            <AnimatedInlineBanner
                show={deleteConfirmationVisible}
                step="error"
                error="Excluir transação?"
                statusText="Excluir transação?"
                title="Excluir transação?"
                onCancel={() => {
                    setDeleteConfirmationVisible(false);
                    setTransactionToDelete(null);
                }}
                onConfirm={handleConfirmDeleteTransaction}
                confirmText="Excluir"
                cancelText="Não"
                centerActions
            />

            <ClosingDateModal
                visible={closingDateModalVisible}
                onClose={() => setClosingDateModalVisible(false)}
                onSave={handleSaveClosingDates}
                items={closingDateModalItems}
                hasBankData={Boolean(normalizePluggyDate(selectedCard?.currentBill?.periodEnd || null) || normalizePluggyDate(selectedCard?.currentBill?.closeDate || null))}
                bankName={selectedCard?.name || undefined}
                onRefreshBank={onRefresh}
                originalCloseDate={originalCloseDate}
                originalDueDate={originalDueDate}
            />

            <CategorySelectorModal
                visible={categorySelectorVisible}
                onClose={() => {
                    setCategorySelectorVisible(false);
                    setCategoryChangeTarget(null);
                }}
                onSelect={handleCategoryChange}
                categories={DEFAULT_CATEGORIES}
                loading={false}
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

            {/* Search Transaction Modal */}
            <ModalPadrao
                visible={transactionSearchModalVisible}
                onClose={() => {
                    setTransactionSearchModalVisible(false);
                    setTransactionSearchQuery('');
                }}
                title="Buscar transação"
                titleAlign="start"
                maxHeightRatio={0.78}
            >
                <View style={searchStyles.container}>
                    <View style={searchStyles.searchContainer}>
                        <Search size={16} color="#8E8E93" style={{ marginRight: 8 }} />
                        <TextInput
                            style={searchStyles.searchInput}
                            placeholder="Buscar por nome, categoria, valor..."
                            placeholderTextColor="#8E8E93"
                            value={transactionSearchQuery}
                            onChangeText={setTransactionSearchQuery}
                            autoFocus
                        />
                    </View>

                    <Text style={searchStyles.sectionTitle}>RESULTADOS</Text>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={searchStyles.resultsContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {transactionSearchResults.length === 0 ? (
                            <View style={searchStyles.resultsGroup}>
                                <View style={searchStyles.emptyContainer}>
                                    <Text style={searchStyles.emptyText}>
                                        {transactionSearchQuery.trim() ? 'Nenhuma transação encontrada' : 'Digite para buscar'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View style={searchStyles.resultsGroup}>
                                {transactionSearchResults.map((item, index) => {
                                    const isPaymentItem = item.isPayment;
                                    const isRefundItem = item.isRefund;
                                    return (
                                        <View key={item.id}>
                                            <IOSTouchable
                                                style={searchStyles.resultCard}
                                                activeOpacity={1}
                                                onPress={() => handleOpenTransactionOptionsFromSearch(item)}
                                            >
                                                <View style={searchStyles.resultDetails}>
                                                    <Text style={searchStyles.resultDescription} numberOfLines={1}>{item.description}</Text>
                                                    <View style={searchStyles.resultMetaRow}>
                                                        <Text style={searchStyles.resultCategory} numberOfLines={1}>{getCategoryName(item.category)}</Text>
                                                        {item.date && <Text style={searchStyles.resultDate}>{formatTransactionDate(item.date)}</Text>}
                                                    </View>
                                                </View>
                                                <View style={searchStyles.resultAmountContainer}>
                                                    <Text style={[
                                                        searchStyles.resultAmount,
                                                        { color: isPaymentItem || isRefundItem ? '#4ADE80' : '#FF6B6B' }
                                                    ]}>
                                                        {isPaymentItem || isRefundItem ? '+ ' : '- '}{formatCurrency(item.amount)}
                                                    </Text>
                                                    {item.totalInstallments && item.totalInstallments > 1 && (
                                                        <Text style={searchStyles.resultInstallment}>
                                                            {item.installmentNumber}/{item.totalInstallments}
                                                        </Text>
                                                    )}
                                                </View>
                                            </IOSTouchable>
                                            {index < transactionSearchResults.length - 1 && (
                                                <View style={searchStyles.resultSeparator} />
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </ModalPadrao>

            <ModalPadrao
                visible={invoiceActionsModalVisible}
                onClose={() => setInvoiceActionsModalVisible(false)}
                title="Ações da fatura"
                titleAlign="start"
                maxHeightRatio={0.42}
            >
                <View style={styles.invoiceActionsContainer}>
                    <Text style={styles.invoiceActionsSectionTitle}>FATURA</Text>
                    <View style={styles.invoiceActionsGroupCard}>
                        <IOSTouchable
                            style={styles.invoiceActionItem}
                            activeOpacity={1}
                            onPress={() => closeInvoiceActionsAndRun(() => setClosingDateModalVisible(true))}
                        >
                            <View style={styles.invoiceActionTextBlock}>
                                <Text style={styles.invoiceActionTitle}>Configurar fatura</Text>
                                <Text style={styles.invoiceActionSubtitle}>Fechamento, vencimento e ajustes</Text>
                            </View>
                        </IOSTouchable>

                        <View style={styles.invoiceActionSeparator} />

                        <IOSTouchable
                            style={styles.invoiceActionItem}
                            activeOpacity={1}
                            onPress={() => closeInvoiceActionsAndRun(() => setTransactionSearchModalVisible(true))}
                        >
                            <View style={styles.invoiceActionTextBlock}>
                                <Text style={styles.invoiceActionTitle}>Buscar transação</Text>
                                <Text style={styles.invoiceActionSubtitle}>Encontrar lançamentos nesta fatura</Text>
                            </View>
                        </IOSTouchable>

                        <View style={styles.invoiceActionSeparator} />

                        <IOSTouchable
                            style={styles.invoiceActionItem}
                            activeOpacity={1}
                            onPress={() => closeInvoiceActionsAndRun(toggleInvoiceCards)}
                        >
                            <View style={styles.invoiceActionTextBlock}>
                                <Text style={styles.invoiceActionTitle}>
                                    {showInvoiceCards ? 'Ocultar cartões da fatura' : 'Mostrar cartões da fatura'}
                                </Text>
                                <Text style={styles.invoiceActionSubtitle}>Alternar a visualização do carrossel</Text>
                            </View>
                        </IOSTouchable>
                    </View>
                </View>
            </ModalPadrao>

            <View style={styles.headerRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Image
                        source={require('@/assets/images/icon.png')}
                        style={styles.headerIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.screenHeader}>Fatura do cartão</Text>
                </View>
            </View>

            <SectionList
                style={styles.container}
                sections={groupedSections}
                extraData={`${pendingTransactionAction?.id ?? ''}:${pendingTransactionAction?.label ?? ''}:${deleteConfirmationVisible ? '1' : '0'}`} // Ensure updates for row actions
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
                            <ActivityIndicator size="small" color="#F5F5F7" />
                        </View>
                    ) : null
                }
                ListHeaderComponent={
                    <>
                        {selectedCard && (
                            <Animated.View entering={IOS_FADE_IN} layout={IOS_CORE_LAYOUT} style={styles.cardHeader}>
                                <View style={styles.cardHeaderLeft}>
                                    <BankSelector
                                        currentCardId={selectedCard?.id || null}
                                        cards={creditCards}
                                        style={{ flexShrink: 1, marginLeft: 0 }}
                                        onSelectCard={(id) => {
                                            if (id) setSelectedCardId(id);
                                            else if (creditCards.length > 0) setSelectedCardId(creditCards[0].id);
                                        }}
                                    />
                                </View>
                                <View style={styles.cardHeaderRight}>
                                    <IOSTouchable
                                        style={styles.settingsButton}
                                        onPress={() => {
                                            triggerIOSCoreMorph();
                                            setInvoiceActionsModalVisible(true);
                                        }}
                                        activeOpacity={1}
                                    >
                                        <TimedLottieIcon source={require('@/assets/engrenagem.json')} style={{ width: 20, height: 20 }} />
                                    </IOSTouchable>
                                </View>
                            </Animated.View>
                        )}

                        {showInvoiceCards && invoiceData && (
                            <InvoiceCarousel invoiceData={invoiceData} selectedTab={selectedTab} onTabChange={handleTabChange} historyTotal={historyTotal} selectedCard={selectedCard} />
                        )}

                        <Animated.View entering={IOS_FADE_IN} layout={IOS_CORE_LAYOUT} style={styles.listHeader}>
                            <Text style={styles.listHeaderTitle}>
                                {selectedTab === 'all' ? 'Histórico' : selectedTab === 'last' ? 'Última Fatura' : 'Fatura Atual'}
                            </Text>
                            <Text style={styles.listHeaderCount}>{visibleItemsLength} lançamentos</Text>
                        </Animated.View>
                    </>
                }
                ListEmptyComponent={
                    needsConfiguration ? (
                        <NeedsConfigurationState onOpenSettings={() => setClosingDateModalVisible(true)} />
                    ) : (
                        <EmptyTransactionsState />
                    )
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
        backgroundColor: '#101010',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#252525',
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
        backgroundColor: 'rgba(217,119,87,0.30)',
        zIndex: 0,
    },
    segmentDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#252525',
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '400',
        color: '#666',
        textAlign: 'center',
    },
    segmentTextActive: {
        color: '#D97757',
        fontWeight: '400',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 20 },
    screenHeader: {
        fontSize: 18,
        fontFamily: 'AROneSans_400Regular',
        color: '#FFFFFF',
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 0,
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
    cardName: { color: '#909090', fontSize: 15, fontFamily: 'AROneSans_400Regular' },
    cardSubtitle: { color: '#666', fontSize: 12, marginTop: 2 },
    cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    settingsButton: { padding: 9, borderRadius: 16, backgroundColor: '#101010', borderWidth: 1, borderColor: '#252525' },
    toggleButton: { padding: 9, borderRadius: 16, backgroundColor: '#101010', borderWidth: 1, borderColor: '#252525' },
    invoiceActionsContainer: {
        paddingTop: 12,
        paddingBottom: 0,
    },
    invoiceActionsSectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    invoiceActionsGroupCard: {
        backgroundColor: '#101010',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#252525',
        overflow: 'hidden',
    },
    invoiceActionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 56,
    },
    invoiceActionTextBlock: { flex: 1 },
    invoiceActionTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '400',
    },
    invoiceActionSubtitle: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 1,
    },
    invoiceActionSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#252525',
        marginLeft: 16,
    },
    configPrompt: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#101010', borderRadius: 22, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#252525', marginHorizontal: 20 },
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
        backgroundColor: '#101010',
        borderRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderWidth: 1,
        borderColor: '#252525',
        height: 92,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.24,
        shadowRadius: 24,
        elevation: 10,
        overflow: 'hidden',
    },

    // Card Content (mantido do carousel)
    carouselHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    carouselHeaderLeft: { flex: 1 },
    carouselLabel: { color: '#F5F5F7', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.45 },
    carouselDueInline: { color: '#8E8E93', fontSize: 10.5, marginTop: 2 },
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
        paddingTop: 12, // Compensar a parte que fica escondida atr├ís do card
        paddingBottom: 6,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        borderWidth: 1,
        borderTopWidth: 0, // Sem borda superior para parecer grudado
        borderColor: 'rgba(217, 119, 87, 0.3)', // Borda laranja sutil
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        zIndex: -1, // Atr├ís do card
        elevation: -1
    },
    futureTotalLabel: { color: '#888', fontSize: 11, fontWeight: '500' },
    futureTotalValue: { color: '#D97757', fontSize: 12, fontWeight: '700' },

    // Lists
    // Lists
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8, paddingHorizontal: 20 },
    listHeaderTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    listHeaderCount: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
    listHeaderTotal: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    listContent: { paddingBottom: 140 },
    transactionCardWrapper: {
        width: '100%',
    },
    refundTopCardPressable: {
        marginHorizontal: 20,
        marginBottom: -1,
        zIndex: 12,
    },
    refundTopCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#233A31',
        borderColor: '#2D5D4D',
        borderWidth: 1,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    refundTopCardIcon: {
        width: 18,
        height: 18,
    },
    refundTopCardText: {
        color: '#E7FFF2',
        fontSize: 11,
        fontWeight: '600',
        flexShrink: 1,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#101010',
        paddingVertical: 12,
        paddingHorizontal: 14,
        minHeight: 66,
        marginHorizontal: 20,
        overflow: 'hidden',
        borderColor: '#252525',
        borderWidth: 1,
    },
    transactionMovingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    transactionMovingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(12, 12, 12, 0.45)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    separator: {
        position: 'absolute',
        bottom: 0,
        left: 14,
        right: 14,
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#252525',
    },
    detailsContainer: { flex: 1, gap: 2, minWidth: 0, paddingRight: 8 },
    descriptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    description: { fontSize: 14, lineHeight: 18, fontWeight: '400', color: '#FFFFFF', flex: 1, flexShrink: 1 },
    paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(4, 211, 97, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    paymentBadgeText: { color: '#04D361', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    subDetails: { flexDirection: 'row', alignItems: 'center' },
    category: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
    amountContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 0 },
    amount: { fontSize: 15, fontWeight: '400' },
    installmentPill: {
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    installmentPillText: {
        fontSize: 9,
        lineHeight: 11,
        color: '#B8B8BE',
        fontWeight: '600',
    },
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
        backgroundColor: '#101010',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#252525',
    },
    expandOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', zIndex: 50, elevation: 50 },
    expandBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    expandBackdropPress: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    expandCard: {
        backgroundColor: '#101010',
        borderWidth: 1,
        borderColor: '#252525',
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
        borderColor: '#252525',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#161616'
    },
    expandDetails: { marginTop: 18, gap: 12 },
    expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    expandLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
    expandValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    expandAmountContainer: { marginTop: 18, alignItems: 'flex-end' },
    expandAmount: { fontSize: 22, fontWeight: '700' },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingBottom: 96
    },
    emptyLottie: {
        width: 48,
        height: 48
    },
    emptyTitle: {
        fontSize: 15,
        fontFamily: 'AROneSans_400Regular',
        color: '#E5E5E5',
        marginTop: 8,
        marginBottom: 4,
        textAlign: 'center'
    },
    emptyText: {
        fontSize: 13,
        color: '#8E8E93',
        textAlign: 'center',
        maxWidth: 232,
        lineHeight: 18,
        fontFamily: 'AROneSans_400Regular'
    },
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
    statusBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999 },
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
        marginBottom: 8,
        marginHorizontal: 20,
    },
    groupHeader: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginLeft: 0,
    },
    groupCard: {
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
        elevation: 8,
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
        fontFamily: 'AROneSans_400Regular',
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
        marginBottom: 0, // Lottie j├í tem um padding natural geralmente, ou ajustamos aqui
        alignItems: 'center',
        justifyContent: 'center',
    },
    configNeededTitle: {
        fontSize: 20,
        fontFamily: 'AROneSans_400Regular',
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
        fontFamily: 'AROneSans_400Regular',
    },
    // Card Selector Styles
    cardSelectorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4, // kept minimum padding for touch targets or layout
        paddingHorizontal: 0, // removed horizontal padding since no background
        // borderRadius: 20, // Removed
        // borderWidth: 1, // Removed
    },
    cardSelectorArrow: {
        padding: 4,
    },
    cardSelectorText: {
        fontSize: 14,
        color: '#FFF',
        fontFamily: 'AROneSans_400Regular',
        minWidth: 80,
        textAlign: 'center',
        maxWidth: 140,
    },
    globalLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    globalLoaderContainer: {
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(16, 16, 16, 0.92)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#252525',
    },
    globalLoadingText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'AROneSans_400Regular',
    },
});

// Search Modal Styles
const searchStyles = StyleSheet.create({
    container: {
        paddingTop: 12,
        maxHeight: 520,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#101010',
        marginBottom: 24,
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#252525',
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 15,
        padding: 0,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    resultsContent: {
        paddingBottom: 8,
    },
    resultsGroup: {
        backgroundColor: '#101010',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#252525',
        overflow: 'hidden',
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 14,
    },
    resultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 58,
    },
    resultDetails: {
        flex: 1,
        marginRight: 12,
    },
    resultDescription: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '400',
        marginBottom: 2,
    },
    resultMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    resultCategory: {
        color: '#8E8E93',
        fontSize: 12,
        flexShrink: 1,
    },
    resultDate: {
        color: '#636366',
        fontSize: 12,
    },
    resultAmountContainer: {
        alignItems: 'flex-end',
    },
    resultAmount: {
        fontSize: 15,
        fontWeight: '400',
    },
    resultInstallment: {
        fontSize: 10,
        color: '#8E8E93',
        marginTop: 2,
    },
    resultSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#252525',
        marginLeft: 16,
    },
});
