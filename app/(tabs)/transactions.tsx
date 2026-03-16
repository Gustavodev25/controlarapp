import { CreditCardFilterModal, FilterState } from '@/components/CreditCardFilterModal';
import { UniversalBackground } from '@/components/UniversalBackground';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
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
import LottieView from 'lottie-react-native';
import {
    ArrowRightLeft,
    Baby,
    BookOpen,
    Car,
    Cat,
    Clapperboard,
    Coffee,
    DollarSign,
    Dumbbell,
    Filter,
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
    Wifi,
    Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    LayoutAnimation,
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

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

// Configuração de ícones e cores por categoria (mesmo do CreditCardInvoice)
const getCategoryConfig = (category?: string) => {
    const cat = category?.toLowerCase() || '';

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

    let icon = ShoppingBag;
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

    return { icon, color, backgroundColor: getBg(color) };
};

// Formatar moeda
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(amount);
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

    const amountColor = isExpense ? '#FFFFFF' : '#04D361';
    const { icon: CategoryIcon, color: categoryColor, backgroundColor: categoryBg } = getCategoryConfig(item.category || item.description);

    const borderStyle = {
        borderTopLeftRadius: isFirst ? 16 : 0,
        borderTopRightRadius: isFirst ? 16 : 0,
        borderBottomLeftRadius: isLast ? 16 : 0,
        borderBottomRightRadius: isLast ? 16 : 0,
        marginTop: index === 0 ? 0 : -1,
    };

    return (
        <Animated.View
            layout={animateRow ? LinearTransition.duration(300) : undefined}
            entering={animateRow ? FadeIn.duration(400) : undefined}
            exiting={animateRow ? FadeOut.duration(200) : undefined}
            style={[styles.transactionCard, borderStyle]}
        >
            <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: categoryBg,
                justifyContent: 'center', alignItems: 'center',
                marginRight: 12,
                borderWidth: 1,
                borderColor: categoryColor + '20'
            }}>
                <CategoryIcon size={20} color={categoryColor} strokeWidth={2.5} />
            </View>

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
                <Text style={[
                    styles.amount,
                    {
                        color: amountColor,
                        textShadowColor: amountColor + '40',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: 8,
                    }
                ]}>
                    {isExpense ? '- ' : '+ '}{formatCurrency(item.amount)}
                </Text>

                {!hideInstallments && (item.totalInstallments && item.totalInstallments > 1) && (
                    <Text style={{ fontSize: 10, color: '#666', marginTop: 2, textAlign: 'right', fontWeight: '500' }}>
                        {item.installmentNumber}/{item.totalInstallments}
                    </Text>
                )}
            </View>
            {!isLast && <View style={styles.separator} />}
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

    const [loadingDots, setLoadingDots] = useState('');

    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setLoadingDots(prev => {
                if (prev === '...') return '';
                return prev + '.';
            });
        }, 500);
        return () => clearInterval(interval);
    }, [loading]);

    // Pagination State
    const [lastCheckingDoc, setLastCheckingDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [lastCreditDoc, setLastCreditDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMoreChecking, setHasMoreChecking] = useState(true);
    const [hasMoreCredit, setHasMoreCredit] = useState(true);
    const BATCH_SIZE = 50;

    // Filter State
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        categories: [],
        startDate: '',
        endDate: '',
        year: ''
    });

    const isCredit = filter === 'credit';
    const hasMoreForCurrentFilter = filter === 'credit'
        ? hasMoreCredit
        : filter === 'account'
            ? hasMoreChecking
            : (hasMoreChecking || hasMoreCredit);

    // Calcular quantidade de filtros ativos
    const activeFilterCount = [
        filters.search,
        filters.categories.length > 0,
        filters.startDate,
        filters.endDate,
        filters.year
    ].filter(Boolean).length;

    // Handler para aplicar filtros
    const handleApplyFilters = (newFilters: FilterState) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilters(newFilters);
    };

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
        // Primeiro, remover estornos de todas as transações
        const transactionsWithoutRefunds = transactions.filter(item => {
            const isRefund = (item as any).isRefund || item.category === 'Refund';
            return !isRefund;
        });

        if (activeFilterCount === 0) return transactionsWithoutRefunds;

        const parseFilterDate = (d: string) => {
            const parts = d.split('/');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return '';
        };

        const searchLower = filters.search.toLowerCase();
        const startIso = parseFilterDate(filters.startDate);
        const endIso = parseFilterDate(filters.endDate);

        return transactionsWithoutRefunds.filter(item => {
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
                matches = matches && !!item.date && item.date >= startIso;
            }

            // End Date
            if (endIso) {
                matches = matches && !!item.date && item.date <= endIso;
            }

            // Year
            if (filters.year) {
                matches = matches && !!item.date && item.date.startsWith(filters.year);
            }

            return matches;
        });
    }, [transactions, filters, activeFilterCount, isCredit]);

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
                const d = new Date(item.date + 'T12:00:00');
                const day = d.getDate();
                const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).toUpperCase().replace('.', '');
                header = `HOJE, ${day} ${month}`;
            } else if (item.date === yesterdayYMD) {
                const d = new Date(item.date + 'T12:00:00');
                const day = d.getDate();
                const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).toUpperCase().replace('.', '');
                header = `ONTEM, ${day} ${month}`;
            } else {
                const d = new Date(item.date + 'T12:00:00');
                const day = d.getDate();
                const monthFull = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d).toUpperCase();
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
    const animateRows = lod < 2 && visibleItemsCount <= 120;

    // Optimized Fetch Logic
    const fetchTransactions = async (isLoadMore = false) => {
        if (!user) return;
        if (isLoadMore && (loadingMore || !hasMoreForCurrentFilter)) return;

        try {
            if (isLoadMore) {
                setLoadingMore(true);
            } else {
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
        // Reset pagination state when filters change or user changes
        setLastCheckingDoc(null);
        setLastCreditDoc(null);
        setHasMoreChecking(true);
        setHasMoreCredit(true);
        setTransactions([]); // Clear list to show loading state correctly

        fetchTransactions(false);
    }, [user, filter]);

    // Refresh data when screen comes into focus (e.g., after connecting a bank)
    useFocusEffect(
        useCallback(() => {
            if (user) {
                // Silently refresh without showing loading state
                setLastCheckingDoc(null);
                setLastCreditDoc(null);
                setHasMoreChecking(true);
                setHasMoreCredit(true);
                fetchTransactions(false);
            }
        }, [user, filter, isCredit])
    );


    const onRefresh = () => {
        setRefreshing(true);
        // Reset pagination
        setLastCheckingDoc(null);
        setLastCreditDoc(null);
        setHasMoreChecking(true);
        setHasMoreCredit(true);
        fetchTransactions(false);
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
                {/* Mostrar header apenas se tiver transações ou filtros ativos */}
                {(filteredTransactions.length > 0 || activeFilterCount > 0 || loading) && (
                    <>
                        <View style={styles.header}>
                            <Text style={styles.title}>Transações</Text>
                            <View style={styles.headerButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.filterButton,
                                        activeFilterCount > 0 && styles.filterButtonActive
                                    ]}
                                    onPress={() => setFilterModalVisible(true)}
                                >
                                    <Filter size={18} color={activeFilterCount > 0 ? '#D97757' : '#888'} />
                                    {activeFilterCount > 0 && (
                                        <View style={styles.filterBadge}>
                                            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                    </>
                )}



                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <LottieView
                                source={require('@/assets/carregando.json')}
                                autoPlay
                                loop
                                style={{ width: 50, height: 50 }}
                            />
                            <Text style={styles.loadingText}>Carregando transações{loadingDots}</Text>
                        </View>
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
                            SectionSeparatorComponent={() => <View style={{ height: 16 }} />}
                            ListFooterComponent={
                                loadingMore ? (
                                    <View style={{ padding: 20 }}>
                                        <ActivityIndicator size="small" color="#D97757" />
                                    </View>
                                ) : null
                            }
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#D97757"
                                />
                            }
                            ListHeaderComponent={
                                activeFilterCount > 0 && filteredTransactions.length > 0 ? (
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
                                        {activeFilterCount > 0 ? 'Nenhum resultado' : 'Nenhuma transação'}
                                    </Text>
                                    <Text style={styles.emptyText}>
                                        {activeFilterCount > 0
                                            ? 'Tente ajustar os filtros para encontrar transações.'
                                            : 'Suas movimentações financeiras aparecerão aqui.'}
                                    </Text>

                                    {activeFilterCount === 0 && (
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
                </View>
            </View>


            {/* Filter Modal */}
            <CreditCardFilterModal
                visible={filterModalVisible}
                onClose={() => setFilterModalVisible(false)}
                onApply={handleApplyFilters}
                initialFilters={filters}
                categories={availableCategories}
                getCategoryName={getCategoryName}
                years={availableYears}
            />
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
        paddingTop: 60,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    header: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    filterButton: {
        padding: 10,
        borderRadius: 12,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    filterButtonActive: {
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        borderColor: '#D97757',
    },
    filterBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#D97757',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: '#000',
        fontSize: 11,
        fontWeight: '700',
    },
    settingsButton: {
        padding: 10,
        borderRadius: 12,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    content: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    listContent: {
        paddingBottom: 20,
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
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        padding: 10,
        borderWidth: 1,
        borderColor: '#252525',
    },
    separator: {
        position: 'absolute',
        bottom: 0,
        left: 14,
        right: 14,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    detailsContainer: {
        flex: 1,
        gap: 2,
    },
    descriptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    description: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
    },
    subDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    category: {
        fontSize: 12,
        color: '#666',
        marginTop: 1,
    },
    dot: {
        fontSize: 12,
        color: '#888',
        marginHorizontal: 6,
    },
    installments: {
        fontSize: 12,
        color: '#D97757',
        fontWeight: '500',
    },
    amountContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    amount: {
        fontSize: 14,
        fontWeight: '700',
    },
    loadingText: {
        color: '#888',
        fontSize: 14,
        marginTop: 10,
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

