import BottomSheet from '@/components/templates/bottom-sheet';
import { BottomSheetMethods } from '@/components/templates/bottom-sheet/types';
import { buildEventsByDateIndex, EventsForDate } from '@/utils/financialCalendarIndex';
import { addMonths, compareMonths, isSameMonth, startOfMonth } from '@/utils/monthWindow';

import { useCategories } from '@/hooks/use-categories';
import LottieView from 'lottie-react-native';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    DollarSign,
    Repeat
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AnimatedCurrency } from './AnimatedCurrency';

// Types (reused/adapted)
export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
    category?: string;
    cardId?: string; // If present, it's a credit card transaction
}

export interface RecurrenceItem {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    type: 'subscription' | 'reminder';
    status: 'paid' | 'pending' | 'overdue';
    category?: string;
}

interface FinancialCalendarProps {
    checkingTransactions: Transaction[];
    creditCardTransactions: Transaction[];
    recurrences: RecurrenceItem[];
    selectedMonth?: Date;
    minMonth?: Date;
    maxMonth?: Date;
    onMonthChange?: (date: Date) => void;
}

const EMPTY_EVENTS: EventsForDate<Transaction, RecurrenceItem> = {
    checking: [],
    cards: [],
    recs: [],
    totalCount: 0,
};

export function FinancialCalendar({
    checkingTransactions,
    creditCardTransactions,
    recurrences,
    selectedMonth,
    minMonth,
    maxMonth,
    onMonthChange
}: FinancialCalendarProps) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const { getCategoryName } = useCategories();
    const normalizeMonthInBounds = React.useCallback((date: Date) => {
        const normalized = startOfMonth(date);
        if (minMonth && compareMonths(normalized, startOfMonth(minMonth)) < 0) {
            return startOfMonth(minMonth);
        }
        if (maxMonth && compareMonths(normalized, startOfMonth(maxMonth)) > 0) {
            return startOfMonth(maxMonth);
        }
        return normalized;
    }, [minMonth, maxMonth]);
    const [displayedMonth, setDisplayedMonth] = useState(() =>
        normalizeMonthInBounds(selectedMonth || new Date())
    );
    const sheetRef = React.useRef<BottomSheetMethods>(null);
    const [isModalMounted, setIsModalMounted] = useState(false);

    // Sync with selectedMonth from parent
    React.useEffect(() => {
        if (selectedMonth) {
            const normalized = normalizeMonthInBounds(selectedMonth);
            setDisplayedMonth(prev => (isSameMonth(prev, normalized) ? prev : normalized));
        }
    }, [selectedMonth, normalizeMonthInBounds]);

    // Keep displayed month inside limits if bounds change.
    React.useEffect(() => {
        setDisplayedMonth(prev => {
            const normalized = normalizeMonthInBounds(prev);
            return isSameMonth(prev, normalized) ? prev : normalized;
        });
    }, [normalizeMonthInBounds]);

    // Helper: Normalize date to YYYY-MM-DD
    const normalizeDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const eventsByDate = useMemo(
        () => buildEventsByDateIndex(checkingTransactions, creditCardTransactions, recurrences),
        [checkingTransactions, creditCardTransactions, recurrences]
    );

    const selectedDateKey = useMemo(() => normalizeDate(selectedDate), [selectedDate]);

    const selectedEvents = useMemo(() => {
        const { checking, cards, recs } = eventsByDate.get(selectedDateKey) || EMPTY_EVENTS;

        // Combine and map to common structure
        const combined = [
            ...checking.map(t => ({
                id: t.id,
                title: t.description,
                amount: t.amount,
                type: t.type === 'income' ? 'checking_income' : 'checking_expense',
                icon: t.type === 'income' ? 'arrow-up-circle' : 'arrow-down-circle',
                date: t.date,
                category: t.category
            })),
            ...cards.map(t => ({
                id: t.id,
                title: t.description,
                amount: t.amount,
                type: 'credit_card',
                icon: 'credit-card',
                date: t.date,
                category: t.category
            })),
            ...recs.map(r => ({
                id: r.id,
                title: r.name,
                amount: r.amount,
                type: r.type, // 'subscription' | 'reminder'
                icon: r.type === 'subscription' ? 'repeat' : 'calendar',
                date: r.dueDate,
                category: r.category,
                status: r.status
            }))
        ];

        return combined;
    }, [eventsByDate, selectedDateKey]);

    // Calendar Generation
    const generateCalendar = () => {
        const year = displayedMonth.getFullYear();
        const month = displayedMonth.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const calendarDays = [];

        // Prev Month Padding
        for (let i = firstDay - 1; i >= 0; i--) {
            calendarDays.push({
                day: daysInPrevMonth - i,
                date: new Date(year, month - 1, daysInPrevMonth - i),
                isCurrentMonth: false
            });
        }

        // Current Month
        for (let i = 1; i <= daysInMonth; i++) {
            calendarDays.push({
                day: i,
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }

        // Next Month Padding
        const remainingSlots = 42 - calendarDays.length; // 6 rows of 7
        for (let i = 1; i <= remainingSlots; i++) {
            calendarDays.push({
                day: i,
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }

        return calendarDays;
    };

    const calendarDays = useMemo(generateCalendar, [displayedMonth]);

    const canGoPrev = !minMonth || compareMonths(displayedMonth, startOfMonth(minMonth)) > 0;
    const canGoNext = !maxMonth || compareMonths(displayedMonth, startOfMonth(maxMonth)) < 0;

    const changeMonth = (increment: number) => {
        const candidate = addMonths(displayedMonth, increment);
        const nextMonth = normalizeMonthInBounds(candidate);
        if (isSameMonth(nextMonth, displayedMonth)) return;

        setDisplayedMonth(nextMonth);

        // Notify parent about month change
        if (onMonthChange) {
            onMonthChange(nextMonth);
        }
    };

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const renderEventIcon = (type: string) => {
        switch (type) {
            case 'checking_income': return <ArrowUpCircle size={20} color="#04D361" />;
            case 'checking_expense': return <ArrowDownCircle size={20} color="#FA5C5C" />;
            case 'credit_card': return <CreditCard size={20} color="#FFB800" />;
            case 'subscription': return <Repeat size={20} color="#A855F7" />;
            case 'reminder': return <Repeat size={20} color="#A855F7" />;
            default: return <DollarSign size={20} color="#909090" />;
        }
    };

    const renderEventItem = ({ item, index }: { item: any, index: number }) => {
        const isLast = index === selectedEvents.length - 1;
        const cappedDelay = Math.min(index, 12) * 45;

        return (
            <Animated.View
                key={item.id + item.type + index}
                entering={FadeIn.delay(cappedDelay)}
                style={styles.itemContainer}
            >
                <View style={[styles.itemIconContainer, {
                    backgroundColor:
                        item.type === 'checking_income' ? 'rgba(4, 211, 97, 0.1)' :
                            item.type === 'checking_expense' ? 'rgba(250, 92, 92, 0.1)' :
                                item.type === 'credit_card' ? 'rgba(255, 184, 0, 0.1)' :
                                    (item.type === 'subscription' || item.type === 'reminder') ? 'rgba(168, 85, 247, 0.1)' :
                                        'rgba(59, 130, 246, 0.1)'
                }]}>
                    {renderEventIcon(item.type)}
                </View>
                <View style={styles.itemRightContainer}>
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>{item.title || 'Sem descrição'}</Text>
                            <Text style={styles.itemSubtitle}>{item.category ? getCategoryName(item.category) : (
                                item.type === 'credit_card' ? 'Cartão de Crédito' :
                                    item.type === 'subscription' ? 'Assinatura' :
                                        item.type === 'reminder' ? 'Lembrete' : 'Lançamento'
                            )}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <AnimatedCurrency
                                value={item.amount}
                                style={[styles.itemAmount, {
                                    color: item.type === 'checking_income' ? '#FFFFFF' : '#FA5C5C'
                                }]}
                                prefix="R$ "
                            />
                            {item.status && (
                                <Text style={[styles.itemStatus, {
                                    color: item.status === 'paid' ? '#04D361' : '#EAB308'
                                }]}>
                                    {item.status === 'paid' ? 'Pago' : 'Pendente'}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
                {!isLast && <View style={styles.itemSeparator} />}
            </Animated.View >
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Calendário Financeiro</Text>
            </View>

            <View style={styles.calendarCard}>
                {/* Month Navigation */}
                <View style={styles.monthHeader}>
                    <TouchableOpacity
                        onPress={() => changeMonth(-1)}
                        style={[styles.arrowButton, !canGoPrev && styles.arrowButtonDisabled]}
                        disabled={!canGoPrev}
                    >
                        <ChevronLeft size={20} color="#E0E0E0" />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {months[displayedMonth.getMonth()]} {displayedMonth.getFullYear()}
                    </Text>
                    <TouchableOpacity
                        onPress={() => changeMonth(1)}
                        style={[styles.arrowButton, !canGoNext && styles.arrowButtonDisabled]}
                        disabled={!canGoNext}
                    >
                        <ChevronRight size={20} color="#E0E0E0" />
                    </TouchableOpacity>
                </View>

                {/* Week Days */}
                <View style={styles.weekDays}>
                    {weekDays.map(day => (
                        <Text key={day} style={styles.weekDayText}>{day}</Text>
                    ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                    {calendarDays.map((dayObj, index) => {
                        const dateStr = normalizeDate(dayObj.date);
                        const isSelected = normalizeDate(selectedDate) === dateStr;
                        const isToday = normalizeDate(new Date()) === dateStr;

                        const { checking, cards, recs } = eventsByDate.get(dateStr) || EMPTY_EVENTS;
                        const hasIncome = checking.some(t => t.type === 'income');
                        const hasExpense = checking.some(t => t.type === 'expense') || cards.length > 0;
                        const hasRecurrence = recs.length > 0;

                        return (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.dayCell,
                                    isSelected && styles.dayCellSelected,
                                    !dayObj.isCurrentMonth && { opacity: 0.3 }
                                ]}
                                onPress={() => {
                                    setSelectedDate(dayObj.date);
                                    setIsModalMounted(true);
                                    requestAnimationFrame(() => {
                                        sheetRef.current?.snapToIndex(0);
                                    });
                                }}
                            >
                                <Text style={[
                                    styles.dayText,
                                    isSelected && styles.dayTextSelected,
                                    isToday && !isSelected && { color: '#D97757', fontWeight: 'bold' }
                                ]}>
                                    {dayObj.day}
                                </Text>

                                <View style={styles.dotsContainer}>
                                    {hasRecurrence && <View style={[styles.dot, { backgroundColor: '#A855F7' }]} />}
                                    {hasIncome && <View style={[styles.dot, { backgroundColor: '#04D361' }]} />}
                                    {hasExpense && <View style={[styles.dot, { backgroundColor: '#FF4C4C' }]} />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>


            {/* Bottom Modal Day Details */}
            <Modal visible={isModalMounted} transparent animationType="none" statusBarTranslucent hardwareAccelerated>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <BottomSheet
                        ref={sheetRef}
                        snapPoints={["60%", "90%"]} // Initial and expanded state
                        backgroundColor="#141414"
                        backdropOpacity={0.6}
                        borderRadius={24}
                        onClose={() => setIsModalMounted(false)}
                    >
                        <View style={[styles.header, { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, marginBottom: 0, borderBottomWidth: 1, borderBottomColor: '#2A2A2A', backgroundColor: '#141414' }]}>
                            <Text style={[styles.title, { fontSize: 18, color: '#FFFFFF' }]}>
                                {`${selectedDate.getDate()} de ${months[selectedDate.getMonth()]}`}
                            </Text>
                            <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 2, fontFamily: 'AROneSans_500Medium' }}>
                                {weekDays[selectedDate.getDay()]}
                            </Text>
                        </View>

                        <ScrollView
                            contentContainerStyle={{ gap: 12, padding: 20, paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {selectedEvents.length > 0 ? (
                                <View style={styles.sectionCard}>
                                    {selectedEvents.map((item, index) =>
                                        renderEventItem({ item, index })
                                    )}
                                </View>
                            ) : (
                                <View style={styles.emptyStateExpanded}>
                                    <LottieView
                                        source={require('@/assets/calendario.json')}
                                        autoPlay
                                        loop={false}
                                        style={{ width: 50, height: 50 }}
                                    />
                                    <Text style={styles.emptyStateText}>Nenhum evento neste dia</Text>
                                </View>
                            )}
                        </ScrollView>
                    </BottomSheet>
                </GestureHandlerRootView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
        marginBottom: 24,
    },
    header: {
        marginBottom: 12,
        paddingHorizontal: 0,
    },
    title: {
        fontSize: 16,
        color: '#909090',
        fontFamily: 'AROneSans_700Bold',
    },
    calendarCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    arrowButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#252525',
    },
    arrowButtonDisabled: {
        opacity: 0.4,
    },
    monthText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontFamily: 'AROneSans_600SemiBold',
        textTransform: 'capitalize',
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekDayText: {
        width: '14.28%',
        textAlign: 'center',
        fontSize: 12,
        color: '#666',
        fontFamily: 'AROneSans_500Medium',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        marginBottom: 4,
    },
    dayCellSelected: {
        backgroundColor: '#D97757',
    },
    dayText: {
        fontSize: 14,
        color: '#E0E0E0',
        fontFamily: 'AROneSans_400Regular',
    },
    dayTextSelected: {
        color: '#FFFFFF',
        fontFamily: 'AROneSans_700Bold',
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 3,
        marginTop: 4,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    // New Card Styles
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        position: 'relative',
        backgroundColor: '#1A1A1A',
    },
    itemIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemRightContainer: {
        flex: 1,
    },
    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemTitle: {
        fontSize: 15,
        color: '#FFFFFF',
        fontFamily: 'AROneSans_500Medium',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#707070',
        marginTop: 2,
        fontFamily: 'AROneSans_400Regular',
    },
    itemAmount: {
        fontSize: 15,
        fontWeight: 'bold',
        letterSpacing: -0.5,
    },
    itemStatus: {
        fontSize: 11,
        marginTop: 2,
        fontFamily: 'AROneSans_500Medium',
        textAlign: 'right',
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 64,
        right: 16,
        height: 1,
        backgroundColor: '#2A2A2A',
    },
    emptyStateExpanded: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateText: {
        color: '#666',
        fontSize: 14,
        fontFamily: 'AROneSans_400Regular',
    },
});
