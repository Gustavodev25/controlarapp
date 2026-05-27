import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { buildEventsByDateIndex, EventsForDate } from '@/utils/financialCalendarIndex';
import { compareMonths, isSameMonth, startOfMonth } from '@/utils/monthWindow';

import { useCategories } from '@/hooks/use-categories';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInUp,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { AnimatedCurrency } from './AnimatedCurrency';

const DAY_ITEM_WIDTH = 52;
const DAY_ITEM_SPACING = 8;
const DAY_SNAP_INTERVAL = DAY_ITEM_WIDTH + DAY_ITEM_SPACING;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
    category?: string;
    cardId?: string;
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

interface CalendarDay {
    day: number;
    date: Date;
    isCurrentMonth: boolean;
}

const toStartOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDefaultSelectedDate = (month: Date) => {
    const today = toStartOfDay(new Date());
    return isSameMonth(today, month) ? today : startOfMonth(month);
};

interface CalendarRailDayProps {
    item: CalendarDay;
    weekDay: string;
    isSelected: boolean;
    isToday: boolean;
    hasIncome: boolean;
    hasExpense: boolean;
    hasRecurrence: boolean;
    onPress: () => void;
}

function CalendarRailDay({
    item,
    weekDay,
    isSelected,
    isToday,
    hasIncome,
    hasExpense,
    hasRecurrence,
    onPress
}: CalendarRailDayProps) {
    const selectedProgress = useSharedValue(isSelected ? 1 : 0);
    const morphProgress = useSharedValue(0);
    const pressProgress = useSharedValue(0);

    React.useEffect(() => {
        selectedProgress.value = withSpring(isSelected ? 1 : 0, {
            damping: 15,
            stiffness: 190,
            mass: 0.72,
        });

        if (isSelected) {
            morphProgress.value = 0;
            morphProgress.value = withSequence(
                withTiming(1, { duration: 150 }),
                withSpring(0, {
                    damping: 10,
                    stiffness: 135,
                    mass: 0.58,
                })
            );
        }
    }, [isSelected, morphProgress, selectedProgress]);

    const shellStyle = useAnimatedStyle(() => {
        const selected = selectedProgress.value;
        const morph = morphProgress.value;
        const pressed = pressProgress.value;

        return {
            borderColor: interpolateColor(
                selected,
                [0, 1],
                ['rgba(255,255,255,0.045)', 'rgba(217,119,87,0.82)']
            ),
            backgroundColor: interpolateColor(
                selected,
                [0, 1],
                ['rgba(255,255,255,0.015)', 'rgba(217,119,87,0.10)']
            ),
            borderRadius: 17 + selected * 6 + morph * 4 - pressed * 1.2,
            transform: [
                { translateY: -selected * 4 + pressed * 1.4 },
                { scaleX: 1 + selected * 0.035 + morph * 0.018 - pressed * 0.018 },
                { scaleY: 1 - selected * 0.014 + morph * 0.014 + pressed * 0.014 },
            ],
        };
    });

    const fillStyle = useAnimatedStyle(() => {
        const selected = selectedProgress.value;
        const morph = morphProgress.value;

        return {
            opacity: selected,
            borderRadius: 18 + morph * 9,
            transform: [
                { scaleX: 0.22 + selected * 0.82 + morph * 0.05 },
                { scaleY: 0.24 + selected * 0.80 - morph * 0.03 },
            ],
        };
    });

    const softHighlightStyle = useAnimatedStyle(() => {
        const selected = selectedProgress.value;
        const morph = morphProgress.value;

        return {
            opacity: selected * 0.28,
            borderRadius: 24 + morph * 10,
            transform: [
                { translateY: -8 + morph * 4 },
                { scaleX: 0.55 + selected * 0.65 },
                { scaleY: 0.45 + selected * 0.52 - morph * 0.05 },
            ],
        };
    });

    const contentStyle = useAnimatedStyle(() => {
        const selected = selectedProgress.value;
        const morph = morphProgress.value;
        const pressed = pressProgress.value;

        return {
            transform: [
                { translateY: -selected * 1.5 + morph * 1.1 },
                { scaleX: 1 + morph * 0.014 - pressed * 0.004 },
                { scaleY: 1 - morph * 0.01 + pressed * 0.004 },
            ],
        };
    });

    const weekdayStyle = useAnimatedStyle(() => ({
        color: interpolateColor(
            selectedProgress.value,
            [0, 1],
            ['#777777', '#FFE4DA']
        ),
        opacity: 0.82 + selectedProgress.value * 0.18,
    }));

    const dayNumberStyle = useAnimatedStyle(() => ({
        color: interpolateColor(
            selectedProgress.value,
            [0, 1],
            ['#E2E2E2', '#FFFFFF']
        ),
        transform: [
            { scale: 1 + selectedProgress.value * 0.04 + morphProgress.value * 0.025 },
        ],
    }));

    const todayMarkStyle = useAnimatedStyle(() => ({
        opacity: isToday && !isSelected ? 1 : 0,
        transform: [
            { scale: 0.8 + morphProgress.value * 0.25 },
        ],
    }));

    return (
        <Animated.View
            style={[
                styles.dayRailMotion,
                shellStyle,
                !item.isCurrentMonth && !isSelected && styles.dayRailItemMuted
            ]}
        >
            <AnimatedTouchableOpacity
                style={styles.dayRailItem}
                onPress={onPress}
                onPressIn={() => {
                    pressProgress.value = withSpring(1, {
                        damping: 16,
                        stiffness: 250,
                        mass: 0.42,
                    });

                    morphProgress.value = withSpring(0.75, {
                        damping: 13,
                        stiffness: 190,
                        mass: 0.48,
                    });
                }}
                onPressOut={() => {
                    pressProgress.value = withSpring(0, {
                        damping: 15,
                        stiffness: 215,
                        mass: 0.45,
                    });

                    morphProgress.value = withSpring(0, {
                        damping: 11,
                        stiffness: 145,
                        mass: 0.52,
                    });
                }}
                activeOpacity={1}
            >
                <Animated.View pointerEvents="none" style={[styles.dayRailSelectedFill, fillStyle]} />
                <Animated.View pointerEvents="none" style={[styles.dayRailSoftHighlight, softHighlightStyle]} />

                <Animated.View style={[styles.dayRailContent, contentStyle]}>
                    <Animated.Text style={[styles.dayRailWeekday, weekdayStyle]}>
                        {weekDay}
                    </Animated.Text>

                    <Animated.Text style={[styles.dayRailNumber, dayNumberStyle]}>
                        {item.day}
                    </Animated.Text>

                    <Animated.View style={[styles.dayRailTodayMark, todayMarkStyle]} />

                    <View style={styles.dayRailDots}>
                        {hasRecurrence && <View style={[styles.dayRailDot, { backgroundColor: '#A855F7' }]} />}
                        {hasIncome && <View style={[styles.dayRailDot, { backgroundColor: '#34C759' }]} />}
                        {hasExpense && <View style={[styles.dayRailDot, { backgroundColor: '#FF453A' }]} />}
                    </View>
                </Animated.View>
            </AnimatedTouchableOpacity>
        </Animated.View>
    );
}

function EventRow({
    item,
    index,
    isLast,
    getCategoryName,
}: {
    item: any;
    index: number;
    isLast: boolean;
    getCategoryName: (id: string) => string;
}) {
    const pressProgress = useSharedValue(0);
    const morphProgress = useSharedValue(0);
    const cappedDelay = Math.min(index, 12) * 45;

    const rowAnimatedStyle = useAnimatedStyle(() => {
        const pressed = pressProgress.value;
        const morph = morphProgress.value;

        return {
            borderRadius: 14 + morph * 3 - pressed * 0.8,
            transform: [
                { translateY: pressed * 1.1 },
                { scaleX: 1 + morph * 0.006 - pressed * 0.006 },
                { scaleY: 1 + morph * 0.008 + pressed * 0.004 },
            ],
        };
    });

    const contentAnimatedStyle = useAnimatedStyle(() => {
        const pressed = pressProgress.value;
        const morph = morphProgress.value;

        return {
            transform: [
                { scaleX: 1 + morph * 0.003 - pressed * 0.002 },
                { scaleY: 1 - morph * 0.002 + pressed * 0.002 },
            ],
        };
    });

    return (
        <Animated.View
            entering={FadeInUp.delay(cappedDelay).duration(420)}
            style={[styles.itemContainer, rowAnimatedStyle]}
        >
            <AnimatedTouchableOpacity
                activeOpacity={1}
                style={styles.itemTouchable}
                onPressIn={() => {
                    pressProgress.value = withSpring(1, {
                        damping: 16,
                        stiffness: 250,
                        mass: 0.42,
                    });

                    morphProgress.value = withSpring(1, {
                        damping: 13,
                        stiffness: 190,
                        mass: 0.48,
                    });
                }}
                onPressOut={() => {
                    pressProgress.value = withSpring(0, {
                        damping: 15,
                        stiffness: 215,
                        mass: 0.45,
                    });

                    morphProgress.value = withSpring(0, {
                        damping: 11,
                        stiffness: 145,
                        mass: 0.52,
                    });
                }}
            >
                <Animated.View style={[styles.itemRightContainer, contentAnimatedStyle]}>
                    <View style={styles.itemContent}>
                        <View style={styles.itemTextBlock}>
                            <Text style={styles.itemTitle} numberOfLines={1}>
                                {item.title || 'Sem descrição'}
                            </Text>

                            <Text style={styles.itemSubtitle}>
                                {item.category ? getCategoryName(item.category) : (
                                    item.type === 'credit_card' ? 'Cartão de Crédito' :
                                        item.type === 'subscription' ? 'Assinatura' :
                                            item.type === 'reminder' ? 'Lembrete' : 'Lançamento'
                                )}
                            </Text>
                        </View>

                        <View style={styles.itemAmountBlock}>
                            <AnimatedCurrency
                                value={item.amount}
                                style={[
                                    styles.itemAmount,
                                    {
                                        color: (item.type === 'checking_income' || item.transactionType === 'income')
                                            ? '#34C759'
                                            : '#FF453A'
                                    }
                                ]}
                                prefix="R$ "
                                prefixStyle={styles.itemAmountPrefix}
                            />

                            {item.status && (
                                <Text
                                    style={[
                                        styles.itemStatus,
                                        {
                                            color: item.status === 'paid' ? '#34C759' : '#8E8E93'
                                        }
                                    ]}
                                >
                                    {item.status === 'paid' ? 'Pago' : 'Pendente'}
                                </Text>
                            )}
                        </View>
                    </View>
                </Animated.View>

                {!isLast && <View style={styles.itemSeparator} />}
            </AnimatedTouchableOpacity>
        </Animated.View>
    );
}

export function FinancialCalendar({
    checkingTransactions,
    creditCardTransactions,
    recurrences,
    selectedMonth,
    minMonth,
    maxMonth,
    onMonthChange
}: FinancialCalendarProps) {
    const { getCategoryName } = useCategories();

    const calendarMorph = useSharedValue(0);
    const railMorph = useSharedValue(0);
    const modalContentMorph = useSharedValue(0);

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

    const [selectedDate, setSelectedDate] = useState(() =>
        getDefaultSelectedDate(normalizeMonthInBounds(selectedMonth || new Date()))
    );

    const [isModalMounted, setIsModalMounted] = useState(false);
    const [railWidth, setRailWidth] = useState(0);

    const dayListRef = React.useRef<FlatList<CalendarDay>>(null);
    const skipNextAutoScrollRef = React.useRef(false);
    const lastCenteredDateKeyRef = React.useRef<string | null>(null);

    const railSidePadding = useMemo(() => {
        if (!railWidth) return 0;
        return Math.max(0, (railWidth - DAY_ITEM_WIDTH) / 2);
    }, [railWidth]);

    React.useEffect(() => {
        if (selectedMonth) {
            const normalized = normalizeMonthInBounds(selectedMonth);

            setDisplayedMonth(prev => (
                isSameMonth(prev, normalized) ? prev : normalized
            ));

            setSelectedDate(prev => (
                isSameMonth(prev, normalized) ? prev : getDefaultSelectedDate(normalized)
            ));
        }
    }, [selectedMonth, normalizeMonthInBounds]);

    React.useEffect(() => {
        const normalized = normalizeMonthInBounds(displayedMonth);

        if (!isSameMonth(displayedMonth, normalized)) {
            setDisplayedMonth(normalized);
            setSelectedDate(prev => (
                isSameMonth(prev, normalized) ? prev : getDefaultSelectedDate(normalized)
            ));
        }
    }, [displayedMonth, normalizeMonthInBounds]);

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

        return [
            ...checking.map(t => ({
                id: t.id,
                title: t.description,
                amount: t.amount,
                type: t.type === 'income' ? 'checking_income' : 'checking_expense',
                date: t.date,
                category: t.category,
            })),
            ...cards.map(t => ({
                id: t.id,
                title: t.description,
                amount: t.amount,
                type: 'credit_card',
                date: t.date,
                category: t.category,
            })),
            ...recs.map(r => ({
                id: r.id,
                title: r.name,
                amount: r.amount,
                type: r.type,
                date: r.dueDate,
                category: r.category,
                status: r.status,
                transactionType: (r as any).transactionType,
            })),
        ];
    }, [eventsByDate, selectedDateKey]);

    const generateCalendar = (): CalendarDay[] => {
        const year = displayedMonth.getFullYear();
        const month = displayedMonth.getMonth();
        const currentMonth = startOfMonth(displayedMonth);
        const minBound = minMonth ? startOfMonth(minMonth) : undefined;
        const maxBound = maxMonth ? startOfMonth(maxMonth) : undefined;

        let firstMonth = startOfMonth(new Date(year, month - 1, 1));
        let lastMonth = startOfMonth(new Date(year, month + 1, 1));

        if (minBound && compareMonths(firstMonth, minBound) < 0) {
            firstMonth = currentMonth;
        }

        if (maxBound && compareMonths(lastMonth, maxBound) > 0) {
            lastMonth = currentMonth;
        }

        const calendarDays: CalendarDay[] = [];
        let cursor = firstMonth;

        while (compareMonths(cursor, lastMonth) <= 0) {
            const daysInMonth = new Date(
                cursor.getFullYear(),
                cursor.getMonth() + 1,
                0
            ).getDate();

            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);

                calendarDays.push({
                    day,
                    date,
                    isCurrentMonth: isSameMonth(date, displayedMonth),
                });
            }

            cursor = startOfMonth(new Date(
                cursor.getFullYear(),
                cursor.getMonth() + 1,
                1
            ));
        }

        return calendarDays;
    };

    const calendarDays = useMemo(generateCalendar, [displayedMonth, minMonth, maxMonth]);

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const displayedMonthLabel = `${months[displayedMonth.getMonth()]} ${displayedMonth.getFullYear()}`;

    const selectedEventsLabel = selectedEvents.length === 0
        ? 'Sem eventos'
        : selectedEvents.length === 1
            ? '1 evento'
            : `${selectedEvents.length} eventos`;

    const selectedDateIndex = useMemo(
        () => calendarDays.findIndex(dayObj => normalizeDate(dayObj.date) === selectedDateKey),
        [calendarDays, selectedDateKey]
    );

    React.useEffect(() => {
        calendarMorph.value = 0;
        calendarMorph.value = withSequence(
            withTiming(1, { duration: 145 }),
            withSpring(0, {
                damping: 12,
                stiffness: 145,
                mass: 0.62,
            })
        );

        railMorph.value = 0;
        railMorph.value = withSequence(
            withTiming(1, { duration: 175 }),
            withSpring(0, {
                damping: 12,
                stiffness: 130,
                mass: 0.7,
            })
        );
    }, [selectedDateKey, calendarMorph, railMorph]);

    React.useEffect(() => {
        modalContentMorph.value = 0;
        modalContentMorph.value = withSequence(
            withTiming(1, { duration: 155 }),
            withSpring(0, {
                damping: 12,
                stiffness: 145,
                mass: 0.58,
            })
        );
    }, [selectedEvents.length, selectedDateKey, modalContentMorph]);

    React.useEffect(() => {
        if (selectedDateIndex < 0 || railWidth <= 0) return;

        if (skipNextAutoScrollRef.current) {
            skipNextAutoScrollRef.current = false;
            return;
        }

        const timer = setTimeout(() => {
            dayListRef.current?.scrollToOffset({
                offset: selectedDateIndex * DAY_SNAP_INTERVAL,
                animated: false,
            });
        }, 0);

        return () => clearTimeout(timer);
    }, [calendarDays.length, selectedDateIndex, railWidth]);

    const calendarCardAnimatedStyle = useAnimatedStyle(() => {
        const morph = calendarMorph.value;

        return {
            borderRadius: 22 + morph * 5,
            transform: [
                { translateY: -morph * 1.2 },
                { scaleX: 1 + morph * 0.01 },
                { scaleY: 1 - morph * 0.004 },
            ],
        };
    });

    const railAnimatedStyle = useAnimatedStyle(() => {
        const morph = railMorph.value;

        return {
            transform: [
                { scaleX: 1 + morph * 0.006 },
                { scaleY: 1 - morph * 0.004 },
            ],
        };
    });

    const headerInfoAnimatedStyle = useAnimatedStyle(() => {
        const morph = calendarMorph.value;

        return {
            opacity: 1,
            transform: [
                { translateY: -morph * 1.6 },
                { scaleX: 1 + morph * 0.006 },
                { scaleY: 1 - morph * 0.003 },
            ],
        };
    });

    const modalContentAnimatedStyle = useAnimatedStyle(() => {
        const morph = modalContentMorph.value;

        return {
            borderRadius: 18 + morph * 4,
            transform: [
                { translateY: -morph * 1.2 },
                { scaleX: 1 + morph * 0.006 },
                { scaleY: 1 - morph * 0.003 },
            ],
        };
    });

    const handleSelectDate = React.useCallback((date: Date, openDetails = false) => {
        const cleanDate = toStartOfDay(date);
        const nextMonth = normalizeMonthInBounds(cleanDate);

        setSelectedDate(cleanDate);
        setDisplayedMonth(prev => (isSameMonth(prev, nextMonth) ? prev : nextMonth));

        if (!isSameMonth(displayedMonth, nextMonth)) {
            onMonthChange?.(nextMonth);
        }

        if (openDetails) {
            setIsModalMounted(true);
        }
    }, [displayedMonth, normalizeMonthInBounds, onMonthChange]);

    const previewCenteredDate = React.useCallback((date: Date) => {
        const cleanDate = toStartOfDay(date);
        const dateKey = normalizeDate(cleanDate);

        if (lastCenteredDateKeyRef.current === dateKey) return;

        lastCenteredDateKeyRef.current = dateKey;
        skipNextAutoScrollRef.current = true;

        setSelectedDate(prev => {
            if (normalizeDate(prev) === dateKey) return prev;
            return cleanDate;
        });
    }, []);

    const getCenteredIndexFromOffset = React.useCallback((offsetX: number) => {
        if (calendarDays.length === 0) return -1;

        const rawIndex = Math.round(offsetX / DAY_SNAP_INTERVAL);

        return Math.max(0, Math.min(calendarDays.length - 1, rawIndex));
    }, [calendarDays.length]);

    const handleRailScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = getCenteredIndexFromOffset(event.nativeEvent.contentOffset.x);
        if (index < 0) return;

        previewCenteredDate(calendarDays[index].date);
    }, [calendarDays, getCenteredIndexFromOffset, previewCenteredDate]);

    const handleRailScrollEnd = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = getCenteredIndexFromOffset(event.nativeEvent.contentOffset.x);
        if (index < 0) return;

        handleSelectDate(calendarDays[index].date);
    }, [calendarDays, getCenteredIndexFromOffset, handleSelectDate]);

    const renderEventItem = ({ item, index }: { item: any; index: number }) => {
        const isLast = index === selectedEvents.length - 1;

        return (
            <EventRow
                key={item.id + item.type + index}
                item={item}
                index={index}
                isLast={isLast}
                getCategoryName={getCategoryName}
            />
        );
    };

    const renderDayItem = ({ item }: { item: CalendarDay }) => {
        const dateStr = normalizeDate(item.date);
        const isSelected = selectedDateKey === dateStr;
        const isToday = normalizeDate(new Date()) === dateStr;

        const { checking, cards, recs } = eventsByDate.get(dateStr) || EMPTY_EVENTS;

        const hasIncome =
            checking.some(t => t.type === 'income') ||
            recs.some(r => (r as any).transactionType === 'income');

        const hasExpense =
            checking.some(t => t.type === 'expense') ||
            cards.length > 0 ||
            recs.some(r => (r as any).transactionType !== 'income');

        const hasRecurrence = recs.length > 0;

        return (
            <CalendarRailDay
                item={item}
                weekDay={weekDays[item.date.getDay()]}
                isSelected={isSelected}
                isToday={isToday}
                hasIncome={hasIncome}
                hasExpense={hasExpense}
                hasRecurrence={hasRecurrence}
                onPress={() => handleSelectDate(item.date, true)}
            />
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Calendário Financeiro</Text>
            </View>

            <Animated.View style={[styles.calendarCard, calendarCardAnimatedStyle]}>
                <Animated.View style={[styles.railHeader, headerInfoAnimatedStyle]}>
                    <View>
                        <Text style={styles.monthText}>{displayedMonthLabel}</Text>
                        <Text style={styles.selectedEventsText}>{selectedEventsLabel}</Text>
                    </View>
                </Animated.View>

                <Animated.View
                    style={railAnimatedStyle}
                    onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
                >
                    <FlatList
                        ref={dayListRef}
                        data={calendarDays}
                        style={styles.daysRail}
                        horizontal
                        keyExtractor={(item) => normalizeDate(item.date)}
                        renderItem={renderDayItem}
                        extraData={selectedDateKey}
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        snapToInterval={DAY_SNAP_INTERVAL}
                        snapToAlignment="start"
                        disableIntervalMomentum
                        onScroll={handleRailScroll}
                        scrollEventThrottle={16}
                        onMomentumScrollEnd={handleRailScrollEnd}
                        onScrollEndDrag={handleRailScrollEnd}
                        getItemLayout={(_, index) => ({
                            length: DAY_SNAP_INTERVAL,
                            offset: DAY_SNAP_INTERVAL * index,
                            index,
                        })}
                        initialScrollIndex={selectedDateIndex > 0 ? selectedDateIndex : 0}
                        ItemSeparatorComponent={() => <View style={{ width: DAY_ITEM_SPACING }} />}
                        contentContainerStyle={[
                            styles.daysRailContent,
                            {
                                paddingLeft: railSidePadding,
                                paddingRight: railSidePadding,
                            }
                        ]}
                        onScrollToIndexFailed={(info) => {
                            dayListRef.current?.scrollToOffset({
                                offset: Math.max(0, info.averageItemLength * info.index),
                                animated: false,
                            });
                        }}
                    />
                </Animated.View>
            </Animated.View>

            <ModalPadrao
                visible={isModalMounted}
                onClose={() => setIsModalMounted(false)}
                titleAlign="start"
                title={
                    <View>
                        <Text style={[styles.title, styles.modalTitle]}>
                            {`${selectedDate.getDate()} de ${months[selectedDate.getMonth()]}`}
                        </Text>
                        <Text style={styles.modalSubtitle}>
                            {weekDays[selectedDate.getDay()]}
                        </Text>
                    </View>
                }
                bodyStyle={{ paddingTop: 16 }}
            >
                {selectedEvents.length > 0 ? (
                    <Animated.View
                        entering={FadeIn.duration(260)}
                        style={[styles.sectionCard, modalContentAnimatedStyle]}
                    >
                        {selectedEvents.map((item, index) =>
                            renderEventItem({ item, index })
                        )}
                    </Animated.View>
                ) : (
                    <Animated.View
                        entering={FadeInUp.duration(420)}
                        style={[styles.emptyStateExpanded, modalContentAnimatedStyle]}
                    >
                        <Text style={styles.emptyStateTitle}>Nenhum evento</Text>
                        <Text style={styles.emptyStateText}>
                            Este dia ainda não tem lançamentos, faturas ou recorrências.
                        </Text>
                    </Animated.View>
                )}
            </ModalPadrao>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 22,
        marginBottom: 24,
    },

    header: {
        marginBottom: 10,
        paddingHorizontal: 0,
    },

    title: {
        fontSize: 16,
        color: '#808080',
        fontFamily: 'AROneSans_400Regular',
    },

    calendarCard: {
        position: 'relative',
        backgroundColor: '#111111',
        borderRadius: 22,
        padding: 14,
        borderWidth: 1,
        borderColor: '#161616',
        minHeight: 144,
        overflow: 'hidden',
    },

    railHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },

    monthText: {
        fontSize: 15,
        color: '#FFFFFF',
        fontFamily: 'AROneSans_400Regular',
        textTransform: 'capitalize',
        letterSpacing: -0.2,
    },

    selectedEventsText: {
        fontSize: 12,
        color: '#707070',
        marginTop: 2,
        fontFamily: 'AROneSans_400Regular',
    },

    daysRailContent: {
        paddingVertical: 4,
    },

    daysRail: {
        height: 66,
    },

    dayRailMotion: {
        width: DAY_ITEM_WIDTH,
        height: 62,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#161616',
        overflow: 'hidden',
    },

    dayRailItem: {
        width: '100%',
        height: '100%',
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#151515',
        overflow: 'hidden',
    },

    dayRailSelectedFill: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#D97757',
    },

    dayRailSoftHighlight: {
        position: 'absolute',
        top: -12,
        left: -10,
        right: -10,
        height: 46,
        backgroundColor: 'rgba(255,255,255,0.055)',
    },

    dayRailContent: {
        width: '100%',
        height: '100%',
        zIndex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },

    dayRailItemMuted: {
        opacity: 0.42,
    },

    dayRailWeekday: {
        fontSize: 9.5,
        color: '#777777',
        fontFamily: 'AROneSans_400Regular',
        marginBottom: 2,
    },

    dayRailNumber: {
        fontSize: 18,
        color: '#E2E2E2',
        fontFamily: 'AROneSans_400Regular',
        lineHeight: 22,
    },

    dayRailDots: {
        minHeight: 4,
        marginTop: 4,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 3,
    },

    dayRailTodayMark: {
        position: 'absolute',
        top: 7,
        right: 8,
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#D97757',
    },

    dayRailDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },

    sectionCard: {
        backgroundColor: '#111111',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#161616',
        marginBottom: 16,
    },

    itemContainer: {
        position: 'relative',
        overflow: 'hidden',
    },

    itemTouchable: {
        paddingVertical: 14,
        paddingHorizontal: 16,
    },

    itemRightContainer: {
        flex: 1,
    },

    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    itemTextBlock: {
        flex: 1,
        marginRight: 8,
    },

    itemTitle: {
        fontSize: 15,
        color: '#FFFFFF',
        fontFamily: 'AROneSans_400Regular',
    },

    itemSubtitle: {
        fontSize: 12,
        color: '#707070',
        marginTop: 2,
        fontFamily: 'AROneSans_400Regular',
    },

    itemAmountBlock: {
        alignItems: 'flex-end',
    },

    itemAmount: {
        fontSize: 16,
        fontFamily: 'AROneSans_500Medium',
        letterSpacing: -0.5,
    },

    itemAmountPrefix: {
        fontSize: 12,
        fontFamily: 'AROneSans_400Regular',
        color: '#8E8E93',
    },

    itemStatus: {
        fontSize: 10,
        marginTop: 1,
        fontFamily: 'AROneSans_400Regular',
        textAlign: 'right',
        opacity: 0.8,
    },

    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.07)',
    },

    emptyStateExpanded: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        paddingHorizontal: 22,
    },

    emptyStateTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: 'AROneSans_400Regular',
        marginBottom: 8,
        textAlign: 'center',
    },

    emptyStateText: {
        color: '#8E8E93',
        fontSize: 14,
        fontFamily: 'AROneSans_400Regular',
        lineHeight: 20,
        maxWidth: 260,
        textAlign: 'center',
    },

    modalTitle: {
        fontSize: 18,
        color: '#FFFFFF',
    },

    modalSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
        fontFamily: 'AROneSans_400Regular',
    },
});