import { UniversalBackground } from '@/components/UniversalBackground';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/use-categories';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { db } from '@/services/firebase';
import { isNonInstallmentMerchant } from '@/services/installmentRules';
import { normalizePluggyDate } from '@/services/invoiceBuilder';
import {
    dedupeTransactionsBySourceId,
    mergeSortedTransactions
} from '@/utils/transactionsMerge';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter } from 'firebase/firestore';
import {
    ArrowRightLeft,
    ChevronLeft,
    ChevronRight,
    Baby,
    BookOpen,
    Car,
    Cat,
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
    Shirt,
    ShoppingBag,
    ShoppingCart,
    Smartphone,
    Stethoscope,
    Utensils,
    Search,
    Wifi,
    X,
    Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Extrapolation,
    FadeIn,
    FadeOut,
    interpolate,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
} from 'react-native-reanimated';

interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    date: string;
    category?: string;
    source: 'checking' | 'credit';
    invoiceMonthKey?: string;
    installmentNumber?: number;
    totalInstallments?: number;
    cardId?: string;
    accountId?: string;
    accountName?: string;
}

interface TransactionSection {
    title: string;
    data: Transaction[];
}

const HEADER_CONTROL_HEIGHT = 36;
const FOCUS_REFRESH_MIN_INTERVAL_MS = 15000;

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

const AS_SPRING_ENTRY   = { damping: 16, stiffness: 195, mass: 1.05, overshootClamping: false, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001 } as const;
const AS_SPRING_STRETCH = { damping: 12, stiffness: 165, mass: 1.1,  overshootClamping: false, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001 } as const;
const AS_SPRING_RECOIL  = { damping: 16, stiffness: 150, mass: 1.05, overshootClamping: false, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001 } as const;
const AS_SPRING_SETTLE  = { damping: 22, stiffness: 160, mass: 1,    overshootClamping: false, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001 } as const;
const AS_LABEL_SPRING   = { damping: 18, stiffness: 260, mass: 0.7,  overshootClamping: false } as const;
const AS_PRESS_SPRING   = { damping: 16, stiffness: 360, mass: 0.5,  overshootClamping: false } as const;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface ArrowSelectorOption { label: string; value: string | null; }

function ArrowSelector({ options, selectedValue, onChange }: {
    options: ArrowSelectorOption[];
    selectedValue: string | null;
    onChange: (value: string | null) => void;
}) {
    const currentIndex = Math.max(0, options.findIndex(o => o.value === selectedValue));
    const directionRef = useRef(0);

    const visibility    = useSharedValue(0);
    const squash        = useSharedValue(0.84);
    const contentReveal = useSharedValue(1);
    const leftPress     = useSharedValue(0);
    const rightPress    = useSharedValue(0);

    useEffect(() => {
        squash.value    = 0.84;
        visibility.value = withSpring(1, AS_SPRING_ENTRY);
        squash.value    = withSequence(
            withSpring(1.085, AS_SPRING_STRETCH),
            withSpring(0.976, AS_SPRING_RECOIL),
            withSpring(1,     AS_SPRING_SETTLE),
        );
    }, []);

    useEffect(() => {
        squash.value = withSequence(
            withSpring(1.075, AS_SPRING_STRETCH),
            withSpring(0.978, AS_SPRING_RECOIL),
            withSpring(1,     AS_SPRING_SETTLE),
        );
        contentReveal.value = 0;
        contentReveal.value = withDelay(75, withSpring(1, AS_LABEL_SPRING));
    }, [currentIndex]);

    const containerStyle = useAnimatedStyle(() => {
        const pressAmount = Math.max(leftPress.value, rightPress.value);
        const stretchX = interpolate(squash.value, [0.84, 0.976, 1, 1.085], [0.92, 0.99, 1, 1.04],  Extrapolation.CLAMP);
        const stretchY = interpolate(squash.value, [0.84, 0.976, 1, 1.085], [1.08, 1.018, 1, 0.976], Extrapolation.CLAMP);
        const baseScaleX = interpolate(visibility.value, [0, 0.34, 0.68, 1], [0.18, 1.028, 0.992, 1], Extrapolation.CLAMP);
        const baseScaleY = interpolate(visibility.value, [0, 0.42, 0.78, 1], [0.18, 0.94,  1.012, 1], Extrapolation.CLAMP);
        const pressScaleX = interpolate(pressAmount, [0, 1], [1, 0.986], Extrapolation.CLAMP);
        const pressScaleY = interpolate(pressAmount, [0, 1], [1, 1.035], Extrapolation.CLAMP);
        const translateY  = interpolate(visibility.value, [0, 0.5, 0.82, 1], [14, -3, 1, 0], Extrapolation.CLAMP);
        return {
            opacity: interpolate(visibility.value, [0, 0.22, 1], [0, 0.86, 1], Extrapolation.CLAMP),
            transform: [
                { translateY },
                { scaleX: baseScaleX * stretchX * pressScaleX },
                { scaleY: baseScaleY * stretchY * pressScaleY },
            ],
        };
    });

    const contentCounterStyle = useAnimatedStyle(() => {
        const cx = interpolate(squash.value, [0.84, 0.976, 1, 1.085], [1.09, 1.012, 1, 0.962], Extrapolation.CLAMP);
        const cy = interpolate(squash.value, [0.84, 0.976, 1, 1.085], [0.93, 0.984, 1, 1.024], Extrapolation.CLAMP);
        return { transform: [{ scaleX: cx }, { scaleY: cy }] };
    });

    const labelStyle = useAnimatedStyle(() => ({
        opacity: interpolate(contentReveal.value, [0, 0.45, 1], [0, 0.35, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(contentReveal.value, [0, 1], [4, 0],  Extrapolation.CLAMP) },
            { translateX: interpolate(contentReveal.value, [0, 1], [directionRef.current * 5, 0], Extrapolation.CLAMP) },
            { scale:      interpolate(contentReveal.value, [0, 1], [0.965, 1], Extrapolation.CLAMP) },
        ],
    }));

    const leftBtnStyle = useAnimatedStyle(() => ({
        opacity: interpolate(leftPress.value, [0, 1], [0.68, 1], Extrapolation.CLAMP),
        transform: [
            { translateX: interpolate(leftPress.value,  [0, 1], [0, -1.4], Extrapolation.CLAMP) },
            { scale:      interpolate(leftPress.value,  [0, 1], [1, 0.88], Extrapolation.CLAMP) },
        ],
    }));

    const rightBtnStyle = useAnimatedStyle(() => ({
        opacity: interpolate(rightPress.value, [0, 1], [0.68, 1], Extrapolation.CLAMP),
        transform: [
            { translateX: interpolate(rightPress.value, [0, 1], [0, 1.4],  Extrapolation.CLAMP) },
            { scale:      interpolate(rightPress.value, [0, 1], [1, 0.88], Extrapolation.CLAMP) },
        ],
    }));

    const handlePrev = () => {
        directionRef.current = -1;
        const prev = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
        onChange(options[prev].value);
    };

    const handleNext = () => {
        directionRef.current = 1;
        const next = (currentIndex + 1) % options.length;
        onChange(options[next].value);
    };

    return (
        <Animated.View style={[txStyles.arrowSelector, containerStyle]}>
            <Animated.View style={[txStyles.arrowSelectorContent, contentCounterStyle]}>
                <AnimatedTouchableOpacity
                    onPress={handlePrev}
                    onPressIn={() => { leftPress.value = withSpring(1, AS_PRESS_SPRING); }}
                    onPressOut={() => { leftPress.value = withSpring(0, AS_PRESS_SPRING); }}
                    style={[txStyles.arrowSelectorBtn, leftBtnStyle]}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <ChevronLeft size={14} color="#F5F5F7" strokeWidth={2.4} />
                </AnimatedTouchableOpacity>

                <View style={txStyles.arrowSelectorLabelWrapper}>
                    <Animated.Text
                        key={options[currentIndex].label}
                        style={[txStyles.arrowSelectorLabel, labelStyle]}
                        numberOfLines={1}
                    >
                        {options[currentIndex].label}
                    </Animated.Text>
                </View>

                <AnimatedTouchableOpacity
                    onPress={handleNext}
                    onPressIn={() => { rightPress.value = withSpring(1, AS_PRESS_SPRING); }}
                    onPressOut={() => { rightPress.value = withSpring(0, AS_PRESS_SPRING); }}
                    style={[txStyles.arrowSelectorBtn, rightBtnStyle]}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <ChevronRight size={14} color="#F5F5F7" strokeWidth={2.4} />
                </AnimatedTouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

// Styles compartilhados do ArrowSelector (fora do StyleSheet principal)
const txStyles = StyleSheet.create({
    arrowSelector: {
        width: 146,
        height: 36,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#101010',
        borderWidth: 1,
        borderColor: '#252525',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 6,
    },
    arrowSelectorContent: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 7,
        gap: 4,
        zIndex: 5,
    },
    arrowSelectorBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowSelectorLabelWrapper: {
        overflow: 'hidden',
        width: 76,
        height: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowSelectorLabel: {
        color: '#F5F5F7',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        position: 'absolute',
    },
});
const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});
const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const MONTH_LONG_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

type CategoryIconComponent = React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
}>;

interface CategoryConfig {
    icon: CategoryIconComponent;
    color: string;
    backgroundColor: string;
}

const categoryConfigCache = new Map<string, CategoryConfig>();

// Configuração de ícones e cores por categoria (mesmo do CreditCardInvoice)
const getCategoryConfig = (category?: string): CategoryConfig => {
    const cat = category?.toLowerCase() || '';
    const cached = categoryConfigCache.get(cat);
    if (cached) {
        return cached;
    }

    const colors = {
        transport: '#FF9F0A',
        food: '#FF453A',
        shopping: '#30D158',
        health: '#64D2FF',
        bills: '#FFD60A',
        home: '#AC8E68',
        entertainment: '#FF375F',
        tech: '#0A84FF',
        income: '#32D74B',
        gray: '#8E8E93',
        finance: '#A2845E'
    };

    const getBg = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        const r = result ? parseInt(result[1], 16) : 128;
        const g = result ? parseInt(result[2], 16) : 128;
        const b = result ? parseInt(result[3], 16) : 128;
        return `rgba(${r}, ${g}, ${b}, 0.15)`;
    };

    let icon: CategoryIconComponent = ShoppingBag;
    let color = colors.gray;

    // Transport
    if (cat.includes('uber') || cat.includes('99') || cat.includes('transport') || cat.includes('taxi') || cat.includes('cab')) { icon = Car; color = colors.transport; }
    else if (cat.includes('fuel') || cat.includes('gas') || cat.includes('posto') || cat.includes('shell') || cat.includes('ipiranga')) { icon = Fuel; color = colors.transport; }
    else if (cat.includes('parking') || cat.includes('estacionamento') || cat.includes('park')) { icon = Car; color = colors.transport; }
    else if (cat.includes('auto') || cat.includes('repair') || cat.includes('mecanic') || cat.includes('manuten')) { icon = Car; color = colors.transport; }

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

    const config = { icon, color, backgroundColor: getBg(color) };
    categoryConfigCache.set(cat, config);
    return config;
};

// Formatar moeda
const formatCurrency = (amount: number) => {
    return CURRENCY_FORMATTER.format(amount);
};

const normalizeTransactionDate = (value?: string): string => {
    const normalized = normalizePluggyDate(typeof value === 'string' ? value : null);
    if (normalized) return normalized;
    if (typeof value === 'string' && value.trim()) {
        const trimmed = value.trim();
        return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
    }
    return '';
};

// Componente de item de transação com ícone
const TransactionItem = React.memo(({
    item,
    index,
    total,
    getCategoryName,
    animateRow
}: {
    item: Transaction;
    index: number;
    total: number;
    getCategoryName: (key?: string) => string;
    animateRow: boolean;
}) => {
    const isExpense = item.type === 'expense';
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const hideInstallments = isNonInstallmentMerchant(item.description);
    const press = useSharedValue(0);
    const morph = useSharedValue(0);

    const amountColor = isExpense ? '#FFFFFF' : '#04D361';
    const formattedAmount = useMemo(() => formatCurrency(item.amount), [item.amount]);

    const borderStyle = {
        borderTopLeftRadius: isFirst ? 12 : 0,
        borderTopRightRadius: isFirst ? 12 : 0,
        borderBottomLeftRadius: isLast ? 12 : 0,
        borderBottomRightRadius: isLast ? 12 : 0,
        marginTop: index === 0 ? 0 : -1,
    };

    const cardMorphStyle = useAnimatedStyle(() => {
        const pressed = press.value;
        const morphed = morph.value;
        const cornerMorph = morphed * 3 - pressed * 0.8;

        return {
            borderTopLeftRadius: isFirst ? 12 + cornerMorph : 0,
            borderTopRightRadius: isFirst ? 12 + cornerMorph : 0,
            borderBottomLeftRadius: isLast ? 12 + cornerMorph : 0,
            borderBottomRightRadius: isLast ? 12 + cornerMorph : 0,
            transform: [
                { translateY: pressed * 1.4 },
                { scaleX: 1 + morphed * 0.012 - pressed * 0.012 },
                { scaleY: 1 + morphed * 0.016 + pressed * 0.008 },
            ],
        };
    });

    const handlePressIn = () => {
        press.value = withSpring(1, MORPH_PRESS_SPRING);
        morph.value = withSpring(1, MORPH_SHAPE_SPRING);
    };

    const handlePressOut = () => {
        press.value = withSpring(0, MORPH_RELEASE_PRESS_SPRING);
        morph.value = withSpring(0, MORPH_RELEASE_SHAPE_SPRING);
    };

    return (
        <Animated.View
            layout={animateRow ? IOS_CORE_LAYOUT : undefined}
            entering={animateRow ? IOS_FADE_IN : undefined}
            exiting={animateRow ? IOS_FADE_OUT : undefined}
            style={styles.transactionCardWrapper}
        >
            <AnimatedTouchableOpacity
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[styles.transactionCard, borderStyle, cardMorphStyle]}
            >
                <View style={styles.detailsContainer}>
                    <View style={styles.descriptionRow}>
                        <Text style={styles.description} numberOfLines={1}>
                            {item.description}
                        </Text>
                    </View>
                    <View style={styles.subDetails}>
                        <Text style={styles.category}>{getCategoryName(item.category)}</Text>
                    </View>
                </View>

                <View style={styles.amountContainer}>
                    <Text style={[styles.amount, { color: amountColor }]}>
                        {isExpense ? '- ' : '+ '}{formattedAmount}
                    </Text>
                    {!hideInstallments && (item.totalInstallments && item.totalInstallments > 1) && (
                        <View style={styles.installmentPill}>
                            <Text style={styles.installmentPillText}>
                                {item.installmentNumber}/{item.totalInstallments}
                            </Text>
                        </View>
                    )}
                </View>
                {!isLast && <View style={styles.separator} />}
            </AnimatedTouchableOpacity>
        </Animated.View>
    );
});
TransactionItem.displayName = 'TransactionsScreenItem';

export default function TransactionsScreen() {
    const router = useRouter();
    const { user } = useAuthContext();
    const { filter } = useLocalSearchParams<{ filter: string }>();
    const { getCategoryName } = useCategories();
    const { lod } = usePerformanceBudget();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Pagination State
    const [lastCheckingDoc, setLastCheckingDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [lastCreditDoc, setLastCreditDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMoreChecking, setHasMoreChecking] = useState(true);
    const [hasMoreCredit, setHasMoreCredit] = useState(true);
    const BATCH_SIZE = 50;

    // Filter State
    const [filters, setFilters] = useState({ search: '', categories: [] as string[], year: '' });
    const [typeFilter, setTypeFilter] = useState<string | null>(null);

    const isCredit = filter === 'credit';
    const hasMoreForCurrentFilter = filter === 'credit'
        ? hasMoreCredit
        : filter === 'account'
            ? hasMoreChecking
            : (hasMoreChecking || hasMoreCredit);
    const screenEntryProgress = useSharedValue(0);
    const hasCompletedInitialFetchRef = useRef(false);
    const lastFocusRefreshAtRef = useRef(0);

    const hasActiveFilters = !!(filters.search || filters.categories.length > 0 || filters.year || typeFilter);

    // Calcular anos disponíveis
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        years.add(new Date().getFullYear().toString());
        transactions.forEach(t => {
            if (t.date) {
                const y = t.date.split('-')[0];
                if (y && y.length === 4) years.add(y);
            }
        });
        return Array.from(years).sort().reverse();
    }, [transactions]);

    // Calcular categorias disponíveis
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        transactions.forEach(t => {
            if (t.category) cats.add(t.category);
        });
        return Array.from(cats).sort((a, b) => {
            const nameA = getCategoryName(a);
            const nameB = getCategoryName(b);
            return nameA.localeCompare(nameB, 'pt-BR');
        });
    }, [transactions, getCategoryName]);

    // Filtrar transações
    const filteredTransactions = useMemo(() => {
        const transactionsWithoutRefunds = transactions.filter(item => {
            const isRefund = (item as any).isRefund || item.category === 'Refund';
            return !isRefund;
        });

        const hasFilters = !!(filters.search || filters.categories.length > 0 || filters.year || typeFilter);
        if (!hasFilters) return transactionsWithoutRefunds;

        const searchLower = filters.search.toLowerCase();

        return transactionsWithoutRefunds.filter(item => {
            let matches = true;

            if (filters.search) {
                matches = matches && (
                    (!!item.description && item.description.toLowerCase().includes(searchLower)) ||
                    (!!item.amount && item.amount.toString().includes(filters.search))
                );
            }

            if (filters.categories.length > 0) {
                matches = matches && !!item.category && filters.categories.includes(item.category);
            }

            if (filters.year) {
                matches = matches && !!item.date && item.date.startsWith(filters.year);
            }

            if (typeFilter) {
                matches = matches && item.type === typeFilter;
            }

            return matches;
        });
    }, [transactions, filters, typeFilter]);

    // Agrupar transações por dia
    const groupedTransactions = useMemo(() => {
        if (filteredTransactions.length === 0) return [];

        const sorted = filteredTransactions;
        const groups: TransactionSection[] = [];
        let currentGroup: TransactionSection | null = null;

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

        sorted.forEach(item => {
            if (!item.date) return;
            const testD = new Date(item.date + 'T12:00:00');
            if (isNaN(testD.getTime())) return;
            let header = '';
            if (item.date === todayYMD) {
                const d = testD;
                const day = d.getDate();
                const month = MONTH_SHORT_FORMATTER.format(d).toUpperCase().replace('.', '');
                header = `HOJE, ${day} ${month}`;
            } else if (item.date === yesterdayYMD) {
                const d = testD;
                const day = d.getDate();
                const month = MONTH_SHORT_FORMATTER.format(d).toUpperCase().replace('.', '');
                header = `ONTEM, ${day} ${month}`;
            } else {
                const d = testD;
                const day = d.getDate();
                const monthFull = MONTH_LONG_FORMATTER.format(d).toUpperCase();
                header = `${day} ${monthFull}`;
            }

            if (!currentGroup || currentGroup.title !== header) {
                currentGroup = { title: header, data: [] };
                groups.push(currentGroup);
            }
            currentGroup.data.push(item);
        });

        return groups;
    }, [filteredTransactions]);

    const visibleItemsCount = filteredTransactions.length;
    const animateRows = lod === 0 && visibleItemsCount <= 40;

    // Optimized Fetch Logic
    const fetchTransactions = async (isLoadMore = false, isSilent = false) => {
        if (!user) return;
        if (isLoadMore && (loadingMore || !hasMoreForCurrentFilter)) return;

        try {
            if (isLoadMore) {
                setLoadingMore(true);
            } else if (!isSilent) {
                setLoading(true);
            }

            // 1. Fetch checking transactions
            let checkingList: Transaction[] = [];
            let newLastChecking = lastCheckingDoc;
            let checkHasMore = hasMoreChecking;

            // Optimization: Only fetch if needed
            const shouldFetchChecking = (!filter || filter === 'account');

            if (shouldFetchChecking && (!isLoadMore || hasMoreChecking)) {
                const transactionsRef = collection(db, 'users', user.uid, 'transactions');
                let qTransactions = query(transactionsRef, orderBy('date', 'desc'), limit(BATCH_SIZE));

                if (isLoadMore && lastCheckingDoc) {
                    qTransactions = query(transactionsRef, orderBy('date', 'desc'), startAfter(lastCheckingDoc), limit(BATCH_SIZE));
                }

                const snapshotTransactions = await getDocs(qTransactions);

                if (!snapshotTransactions.empty) {
                    newLastChecking = snapshotTransactions.docs[snapshotTransactions.docs.length - 1];
                    checkingList = snapshotTransactions.docs.map(doc => {
                        const data = doc.data() as Partial<Transaction>;
                        return {
                            id: doc.id,
                            description: data.description || '',
                            amount: Number(data.amount || 0),
                            type: data.type === 'income' ? 'income' : 'expense',
                            date: normalizeTransactionDate(data.date),
                            category: data.category,
                            invoiceMonthKey: data.invoiceMonthKey,
                            installmentNumber: data.installmentNumber,
                            totalInstallments: data.totalInstallments,
                            cardId: data.cardId,
                            accountId: data.accountId,
                            accountName: data.accountName,
                            source: 'checking'
                        };
                    });
                }

                if (snapshotTransactions.docs.length < BATCH_SIZE) {
                    checkHasMore = false;
                }
            }

            // 2. Fetch credit card transactions
            let creditList: Transaction[] = [];
            let newLastCredit = lastCreditDoc;
            let credHasMore = hasMoreCredit;

            const shouldFetchCredit = (!filter || filter === 'credit');

            if (shouldFetchCredit && (!isLoadMore || hasMoreCredit)) {
                const creditRef = collection(db, 'users', user.uid, 'creditCardTransactions');
                let qCredit = query(creditRef, orderBy('date', 'desc'), limit(BATCH_SIZE));

                if (isLoadMore && lastCreditDoc) {
                    qCredit = query(creditRef, orderBy('date', 'desc'), startAfter(lastCreditDoc), limit(BATCH_SIZE));
                }

                const snapshotCredit = await getDocs(qCredit);

                if (!snapshotCredit.empty) {
                    newLastCredit = snapshotCredit.docs[snapshotCredit.docs.length - 1];
                    creditList = snapshotCredit.docs.map(doc => {
                        const data = doc.data() as Partial<Transaction>;
                        const raw = data as any;
                        const txCardId = data.cardId || data.accountId || raw.pluggyAccountId || raw.pluggyRaw?.accountId;
                        return {
                            id: doc.id,
                            description: data.description || '',
                            amount: Number(data.amount || 0),
                            type: data.type === 'income' ? 'income' : 'expense',
                            date: normalizeTransactionDate(data.date),
                            category: data.category,
                            invoiceMonthKey: data.invoiceMonthKey,
                            invoiceMonthKeyManual: (data as any).invoiceMonthKeyManual === true,
                            installmentNumber: data.installmentNumber,
                            totalInstallments: data.totalInstallments,
                            cardId: txCardId,
                            accountId: txCardId,
                            accountName: data.accountName,
                            source: 'credit'
                        };
                    });
                }

                if (snapshotCredit.docs.length < BATCH_SIZE) {
                    credHasMore = false;
                }
            }

            // Update Pagination State
            setLastCheckingDoc(newLastChecking);
            setLastCreditDoc(newLastCredit);
            setHasMoreChecking(checkHasMore);
            setHasMoreCredit(credHasMore);

            // 3. Merge and keep stable date ordering with source:id dedupe
            setTransactions(prev => {
                const current = isLoadMore ? prev : [];
                const mergedBatch = mergeSortedTransactions(checkingList, creditList);
                const mergedWithCurrent = mergeSortedTransactions(current, mergedBatch);
                const merged = dedupeTransactionsBySourceId(mergedWithCurrent);

                // Apply Filters on merged result (to handle mixed loading states cleanly)
                let finalTransactions = merged;
                if (filter === 'credit') {
                    finalTransactions = merged.filter(t => t.source === 'credit');
                } else if (filter === 'account') {
                    finalTransactions = merged.filter(t => t.source === 'checking');
                }

                return finalTransactions;
            });

        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    };


    useEffect(() => {
        hasCompletedInitialFetchRef.current = false;
        lastFocusRefreshAtRef.current = Date.now();

        // Reset pagination state when filters change or user changes
        setLastCheckingDoc(null);
        setLastCreditDoc(null);
        setHasMoreChecking(true);
        setHasMoreCredit(true);
        setTransactions([]); // Clear list to show loading state correctly

        void fetchTransactions(false).finally(() => {
            hasCompletedInitialFetchRef.current = true;
        });
    }, [user, filter]);

    useFocusEffect(
        useCallback(() => {
            screenEntryProgress.value = 0;
            screenEntryProgress.value = withDelay(35, withSpring(1, AS_SPRING_ENTRY));
        }, [screenEntryProgress])
    );

    // Refresh data when screen comes into focus (e.g., after connecting a bank)
    useFocusEffect(
        useCallback(() => {
            if (!user || !hasCompletedInitialFetchRef.current) {
                return;
            }

            const now = Date.now();
            if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_MIN_INTERVAL_MS) {
                return;
            }

            lastFocusRefreshAtRef.current = now;

            // Silently refresh without showing loading state
            setLastCheckingDoc(null);
            setLastCreditDoc(null);
            setHasMoreChecking(true);
            setHasMoreCredit(true);
            void fetchTransactions(false, true);
        }, [user, filter])
    );


    const onRefresh = () => {
        setRefreshing(true);
        // Reset pagination
        setLastCheckingDoc(null);
        setLastCreditDoc(null);
        setHasMoreChecking(true);
        setHasMoreCredit(true);
        fetchTransactions(false, true);
    };

    const loadMore = () => {
        if (!loadingMore && !loading && hasMoreForCurrentFilter) {
            fetchTransactions(true);
        }
    };

    const renderTransactionItem = useCallback(({ item, index, section }: { item: Transaction; index: number; section: TransactionSection }) => (
        <TransactionItem
            item={item}
            index={index}
            total={section.data.length}
            getCategoryName={getCategoryName}
            animateRow={animateRows}
        />
    ), [animateRows, getCategoryName]);

    const renderSectionHeader = useCallback(({ section }: { section: TransactionSection }) => (
        <View style={[styles.groupContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={styles.groupHeader}>{section.title}</Text>
            {section === groupedTransactions[0] && (
                <Text style={[styles.groupHeader, { marginRight: 4, marginLeft: 0, textTransform: 'lowercase' }]}>
                    {filteredTransactions.length} {filteredTransactions.length === 1 ? 'lançamento' : 'lançamentos'}
                </Text>
            )}
        </View>
    ), [groupedTransactions, filteredTransactions.length]);
    const keyExtractor = useCallback((item: Transaction) => `${item.source}-${item.id}`, []);
    const renderSectionSeparator = useCallback(() => <View style={styles.sectionSeparator} />, []);
    const listFooter = useMemo(() => (
        loadingMore ? (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#F5F5F7" />
            </View>
        ) : null
    ), [loadingMore]);

    const headerEntryStyle = useAnimatedStyle(() => ({
        opacity: interpolate(screenEntryProgress.value, [0, 0.28, 1], [0, 0.86, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(screenEntryProgress.value, [0, 1], [-10, 0], Extrapolation.CLAMP) },
            { scale: interpolate(screenEntryProgress.value, [0, 1], [0.985, 1], Extrapolation.CLAMP) },
        ],
    }));

    const filterEntryStyle = useAnimatedStyle(() => ({
        opacity: interpolate(screenEntryProgress.value, [0, 0.22, 1], [0, 0.25, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(screenEntryProgress.value, [0, 1], [10, 0], Extrapolation.CLAMP) },
            { scaleX: interpolate(screenEntryProgress.value, [0, 1], [0.968, 1], Extrapolation.CLAMP) },
            { scaleY: interpolate(screenEntryProgress.value, [0, 1], [1.025, 1], Extrapolation.CLAMP) },
        ],
    }));

    const contentEntryStyle = useAnimatedStyle(() => ({
        opacity: interpolate(screenEntryProgress.value, [0, 0.34, 1], [0, 0.16, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: interpolate(screenEntryProgress.value, [0, 1], [18, 0], Extrapolation.CLAMP) },
            { scaleX: interpolate(screenEntryProgress.value, [0, 1], [0.992, 1], Extrapolation.CLAMP) },
            { scaleY: interpolate(screenEntryProgress.value, [0, 1], [1.01, 1], Extrapolation.CLAMP) },
        ],
    }));

    return (
        <View style={styles.mainContainer}>
            <UniversalBackground
                backgroundColor="#0C0C0C"
                glowSize={350}
                height={280}
                showParticles={true}
                particleCount={8}
            />

            <View style={styles.container}>
                <Animated.View style={[styles.header, headerEntryStyle]}>
                    <View style={styles.headerTitleRow}>
                        <Image
                            source={require('@/assets/images/icon.png')}
                            style={styles.headerIcon}
                            resizeMode="contain"
                        />
                        <Text style={styles.screenHeader} numberOfLines={1}>
                            Transações
                        </Text>
                    </View>
                </Animated.View>

                <Animated.View style={filterEntryStyle}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        style={styles.filterBarScroll}
                        contentContainerStyle={styles.filterBarContent}
                    >
                        <View style={styles.filterSearchBar}>
                            <Search size={15} color="#555" />
                            <TextInput
                                style={styles.filterSearchInput}
                                value={filters.search}
                                onChangeText={(t) => setFilters(prev => ({ ...prev, search: t }))}
                                placeholder="Buscar..."
                                placeholderTextColor="#555"
                            />
                            {filters.search.length > 0 && (
                                <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, search: '' }))}>
                                    <X size={14} color="#8E8E93" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <ArrowSelector
                            options={[
                                { label: 'Tipo', value: null },
                                { label: 'Receita', value: 'income' },
                                { label: 'Despesa', value: 'expense' },
                            ]}
                            selectedValue={typeFilter}
                            onChange={setTypeFilter}
                        />
                        <ArrowSelector
                            options={[
                                { label: 'Categoria', value: null },
                                ...availableCategories.map(cat => ({ label: getCategoryName(cat), value: cat })),
                            ]}
                            selectedValue={filters.categories[0] ?? null}
                            onChange={(v) => setFilters(prev => ({ ...prev, categories: v ? [v] : [] }))}
                        />
                        <ArrowSelector
                            options={[
                                { label: 'Ano', value: null },
                                ...availableYears.map(y => ({ label: y, value: y })),
                            ]}
                            selectedValue={filters.year || null}
                            onChange={(v) => setFilters(prev => ({ ...prev, year: v ?? '' }))}
                        />
                    </ScrollView>
                </Animated.View>

                <Animated.View style={[styles.content, contentEntryStyle]}>
                    {loading ? (
                        <IosCoreLoader />
                    ) : (
                        <SectionList
                            sections={groupedTransactions}
                            renderItem={renderTransactionItem}
                            renderSectionHeader={renderSectionHeader}
                            keyExtractor={keyExtractor}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            stickySectionHeadersEnabled={false}
                            onEndReached={loadMore}
                            onEndReachedThreshold={0.5}
                            initialNumToRender={lod >= 2 ? 6 : 10}
                            maxToRenderPerBatch={lod >= 2 ? 6 : 10}
                            updateCellsBatchingPeriod={lod >= 2 ? 80 : 50}
                            windowSize={lod >= 2 ? 5 : 7}
                            removeClippedSubviews={lod >= 1}
                            SectionSeparatorComponent={renderSectionSeparator}
                            ListFooterComponent={listFooter}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#D97757"
                                />
                            }
                            ListHeaderComponent={
                                hasActiveFilters && filteredTransactions.length > 0 ? (
                                    <View style={styles.listHeader}>
                                        <Text style={styles.listHeaderTitle}>Resultados do Filtro</Text>
                                    </View>
                                ) : null
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIconContainer}>
                                        <DelayedLoopLottie
                                            source={require('@/assets/carteirabranca.json')}
                                            style={{ width: 80, height: 80 }}
                                            delay={3000}
                                            initialDelay={100}
                                            jitterRatio={0.2}
                                            renderMode="HARDWARE"
                                        />
                                    </View>
                                    <Text style={styles.emptyTitle}>
                                        {hasActiveFilters ? 'Nenhum resultado' : 'Nenhuma transação'}
                                    </Text>
                                    <Text style={styles.emptyText}>
                                        {hasActiveFilters
                                            ? 'Tente ajustar os filtros para encontrar transações.'
                                            : 'Suas movimentações financeiras aparecerão aqui.'}
                                    </Text>

                                    {!hasActiveFilters && (
                                        <TouchableOpacity
                                            style={styles.connectButton}
                                            onPress={() => router.push('/(tabs)/open-finance')}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.connectButtonText}>Conectar Conta</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            }
                        />
                    )}
                </Animated.View>
            </View>


        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 100,
        paddingTop: 58,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 22,
        marginBottom: 12,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        minWidth: 0,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
    },
    screenHeader: {
        fontSize: 18,
        fontFamily: 'AROneSans_400Regular',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    content: {
        flex: 1,
    },
    filterBarScroll: {
        height: HEADER_CONTROL_HEIGHT + 4,
        maxHeight: HEADER_CONTROL_HEIGHT + 4,
        flexGrow: 0,
        flexShrink: 0,
        marginBottom: 8,
    },
    filterBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 22,
        gap: 10,
        minHeight: HEADER_CONTROL_HEIGHT + 4,
        paddingVertical: 2,
    },
    filterSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#101010',
        borderRadius: 24,
        paddingHorizontal: 12,
        height: 36,
        width: 160,
        gap: 8,
        borderWidth: 1,
        borderColor: '#252525',
    },
    filterSearchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13,
        padding: 0,
    },
    listContent: {
        paddingBottom: 20,
        paddingHorizontal: 22,
    },
    sectionSeparator: {
        height: 16,
    },
    footerLoader: {
        padding: 20,
    },

    // List Header
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    listHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    listHeaderCount: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },

    // Group Styles
    groupContainer: {
        marginTop: 24,
        marginBottom: 10,
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
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },

    // Transaction Item Styles
    transactionCardWrapper: {
        width: '100%',
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#101010',
        paddingVertical: 12,
        paddingHorizontal: 14,
        minHeight: 66,
        overflow: 'hidden',
        borderColor: '#252525',
        borderWidth: 1,
    },
    separator: {
        position: 'absolute',
        bottom: 0,
        left: 14,
        right: 14,
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#252525',
    },
    detailsContainer: {
        flex: 1,
        gap: 2,
        minWidth: 0,
        paddingRight: 8,
    },
    descriptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },
    description: {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '400',
        color: '#FFFFFF',
        flex: 1,
        flexShrink: 1,
    },
    subDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    category: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 1,
    },
    dot: {
        fontSize: 12,
        color: '#888',
        marginHorizontal: 6,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        flexShrink: 0,
    },
    amount: {
        fontSize: 15,
        fontWeight: '400',
    },
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
    // Empty State Styles
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyIconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#909090',
        textAlign: 'center',
        maxWidth: 250,
        lineHeight: 20,
        marginBottom: 24,
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
});

