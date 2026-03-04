import MonthSelector from '@/components/MonthSelector';
import { RecurrenceDeleteModal } from '@/components/RecurrenceDeleteModal';
import { RecurrenceFilterModal, RecurrenceFilterState } from '@/components/RecurrenceFilterModal';
import { ReminderModal } from '@/components/ReminderModal';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { databaseService } from '@/services/firebase';
import { DetectedSubscription, detectSubscriptions, formatDetectedSubscription } from '@/services/subscriptionDetector';
import { getCategoryConfig } from '@/utils/categoryUtils';
import { addMonths } from '@/utils/monthWindow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import {
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Edit2,
    LayoutList,
    RotateCcw,
    X
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Dimensions, FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';

import Animated, {
    FadeIn,
    Layout,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}



type RecurrenceTab = 'subscriptions' | 'reminders';

interface RecurrenceItem {
    id: string;
    name: string;
    amount: number;
    dueDate: string; // ISO Date
    category?: string;
    type: 'subscription' | 'reminder';
    status: 'paid' | 'pending' | 'overdue';
    frequency?: 'monthly' | 'yearly';
    cancellationDate?: string; // ISO Date
    transactionType?: 'income' | 'expense';
    paidMonths?: string[];
    isValidated?: boolean; // Se false ou undefined, não soma nos totais
    isDetected?: boolean; // Se true, mostra botões de confirmar/excluir
    detectedData?: DetectedSubscription; // Dados da detecção original
}

// Componente Lottie que toca em intervalos
const IntervalLottie = React.memo(({ source, size, interval = 5000 }: { source: any; size: number; interval?: number }) => (
    <DelayedLoopLottie
        source={source}
        style={{ width: size, height: size }}
        delay={interval}
        initialDelay={100 + Math.random() * 800}
        renderMode="HARDWARE"
        jitterRatio={0.2}
    />
));
IntervalLottie.displayName = 'RecurrenceIntervalLottie';

// Helper para calcular status relative
const getDueStatus = (item: RecurrenceItem) => {
    if (item.status === 'paid') return null;

    const parseDate = (dateStr: string) => {
        // Supports YYYY-MM-DD
        const parts = dateStr.split('-');
        if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return new Date();
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dueDate = parseDate(item.dueDate);
    const day = dueDate.getDate();
    const month = dueDate.getMonth();
    const year = dueDate.getFullYear();

    // Se for mensal, precisamos projetar para o mês atual
    // APENAS para Assinaturas (que usam lógica de paidMonths)
    // Lembretes agora confiam na data exata do banco
    if (item.frequency === 'monthly' && item.type === 'subscription') {
        // Cria data para este mês com o dia do vencimento
        const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), day);

        // Se o dia já passou neste mês, o próximo é mês que vem
        // MAS, se estamos "atrasados", pode ser que seja desse mês mesmo.
        // Como saber se é atrasado ou próximo?
        // Se item.status === 'overdue', assume que é passado.

        // Vamos simplificar: 
        // Se hoje <= dia do vencimento, o vencimento é este mês.
        // Se hoje > dia do vencimento, o vencimento foi este mês (passado).

        dueDate = thisMonthDue;
    }
    // Se for anual, usa a data exata (ou projeta para este ano se a lógica for essa, mas geralmente anual é data fixa)
    // Se for LEMBRETE, usa a data exata do banco (dueDate) que já foi atualizada na lógica simplificada

    // Calcula diferença em dias
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: `Vencido há ${Math.abs(diffDays)} dia(s)`, color: '#FF453A' };
    } else if (diffDays === 0) {
        return { label: 'Vence hoje', color: '#FFD60A' };
    } else if (diffDays === 1) {
        return { label: 'Falta 1 dia', color: '#FF9F0A' };
    } else if (diffDays <= 5) {
        return { label: `Faltam ${diffDays} dias`, color: '#FF9F0A' };
    }

    // Opcional: mostrar data se longe? Não pedido explicitamente, mas clean.
    return null;
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const d = parseInt(parts[2]);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
};

const RecurrenceGroup = ({ title, children }: { title: string, children: React.ReactNode }) => {
    const { icon: Icon, color, backgroundColor } = getCategoryConfig(title);

    return (
        <View style={styles.groupContainer}>
            <View style={styles.groupHeader}>
                <View style={[styles.groupIcon, { backgroundColor }]}>
                    <Icon size={14} color={color} />
                </View>
                <Text style={styles.groupTitle}>{title}</Text>
            </View>
            <View style={styles.groupList}>
                {children}
            </View>
        </View>
    );
};

// Componente para item da lista (Assinatura ou Lembrete)
const ListItem = ({
    item,
    index,
    onPay,
    onEdit,
    onDelete,
    onConfirmDetection,
    onDismissDetection,
    isSelectionMode,
    isSelected,
    onLongPress,
    onToggleSelect,
    showTutorial
}: {
    item: RecurrenceItem,
    index: number,
    onPay: (item: RecurrenceItem) => void,
    onEdit: (item: RecurrenceItem) => void,
    onDelete: (item: RecurrenceItem) => void,
    onConfirmDetection?: (detection: DetectedSubscription) => void,
    onDismissDetection?: (detection: DetectedSubscription) => void,
    isSelectionMode: boolean,
    isSelected: boolean,
    onLongPress: (item: RecurrenceItem) => void,
    onToggleSelect: (item: RecurrenceItem) => void,
    showTutorial?: boolean
}) => {
    const [expanded, setExpanded] = useState(false);

    const dueStatus = getDueStatus(item);
    const isDetected = item.isDetected === true;

    // Fecha expanded quando entra no modo de seleção
    useEffect(() => {
        if (isSelectionMode && expanded) {
            setExpanded(false);
        }
    }, [isSelectionMode]);

    const handlePress = () => {
        if (isSelectionMode) {
            onToggleSelect(item);
        } else {
            // Se é detecção, não expande
            if (!isDetected) {
                setExpanded(!expanded);
            }
        }
    };

    const handleLongPress = () => {
        if (isSelectionMode) {
            // Quando já está em modo de seleção, long press também seleciona/deseleciona
            onToggleSelect(item);
        } else if (!isDetected) {
            onLongPress(item);
        }
    };

    // Layout normal (Actions)
    return (
        <Animated.View
            entering={FadeIn.delay(index * 50)}
            layout={Layout.springify()}
            style={[
                styles.listItem,
                expanded && !isSelectionMode && { borderColor: '#E67E5E', backgroundColor: '#161616' },
                isSelected && { borderColor: '#D97757', backgroundColor: '#1A1512' },
                { marginBottom: 12 }
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePress}
                onLongPress={handleLongPress}
                delayLongPress={300}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
            >
                {/* Checkbox de seleção */}
                {isSelectionMode && (
                    <View style={[
                        styles.selectionCheckbox,
                        isSelected && styles.selectionCheckboxSelected
                    ]}>
                        {isSelected && <Check size={14} color="#FFF" />}
                    </View>
                )}

                <View style={[styles.listItemLeft, isSelectionMode && { flex: 1 }]}>
                    <View style={[styles.listIconContainer, { backgroundColor: item.type === 'subscription' ? 'rgba(10, 132, 255, 0.15)' : 'rgba(255, 159, 10, 0.15)' }]}>
                        {item.type === 'subscription' ? (
                            <IntervalLottie
                                source={require('@/assets/assinatura.json')}
                                size={28}
                                interval={6000}
                            />
                        ) : (
                            <IntervalLottie
                                source={require('@/assets/lembretes.json')}
                                size={28}
                                interval={6000}
                            />
                        )}
                    </View>
                    <View style={{ flex: 1, flexShrink: 1 }}>
                        <Text style={styles.listItemTitle} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                        <Text style={styles.listItemSubtitle} numberOfLines={1} ellipsizeMode="tail">
                            {formatDate(item.dueDate)}
                            {item.frequency && ` • ${item.frequency === 'monthly' ? 'Mensal' : 'Anual'} `}
                            {item.transactionType === 'income' && ` • Receita`}
                        </Text>
                    </View>
                </View>

                {/* Right side with value/status OR actions */}
                {!isSelectionMode && (
                    <View style={styles.listItemRight}>
                        {isDetected ? (
                            // Botões de confirmar/excluir para detecções
                            <View style={styles.detectionActions}>
                                <TouchableOpacity
                                    style={styles.dismissButton}
                                    onPress={() => {
                                        console.log('[ListItem] Dismiss clicked, detectedData:', !!item.detectedData);
                                        if (item.detectedData) {
                                            console.log('[ListItem] Calling onDismissDetection with:', item.detectedData.name);
                                            onDismissDetection?.(item.detectedData);
                                        } else {
                                            console.error('[ListItem] No detectedData found!');
                                        }
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <X size={16} color="#FF453A" />
                                    <Text style={styles.dismissButtonText}>Excluir</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.confirmButton}
                                    onPress={() => {
                                        console.log('[ListItem] Confirm clicked, detectedData:', !!item.detectedData);
                                        if (item.detectedData) {
                                            console.log('[ListItem] Calling onConfirmDetection with:', item.detectedData.name);
                                            onConfirmDetection?.(item.detectedData);
                                        } else {
                                            console.error('[ListItem] No detectedData found!');
                                        }
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Check size={16} color="#FFF" />
                                    <Text style={styles.confirmButtonText}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        ) : expanded ? (
                            // Actions when expanded - with gradient background
                            <Animated.View
                                entering={FadeIn.duration(150)}
                                style={styles.actionsOverlay}
                            >
                                <LinearGradient
                                    colors={['transparent', '#161616']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.actionsGradient}
                                />
                                <TouchableOpacity style={styles.actionButton} onPress={() => onPay(item)}>
                                    {item.status === 'paid' ? (
                                        <RotateCcw size={18} color="#909090" />
                                    ) : (
                                        <CheckCircle2 size={18} color="#909090" />
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(item)}>
                                    <Edit2 size={18} color="#909090" />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(item)}>
                                    <IntervalLottie source={require('@/assets/lixeira.json')} size={18} interval={4000} />
                                </TouchableOpacity>
                            </Animated.View>
                        ) : (
                            // Value and status when collapsed
                            <>
                                <Text style={[styles.listItemAmount, { color: item.transactionType === 'income' ? '#04D361' : '#FF453A' }]}>
                                    {item.transactionType === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                                </Text>
                                <View style={[styles.statusBadge, {
                                    backgroundColor: item.status === 'paid'
                                        ? 'rgba(4, 211, 97, 0.1)'
                                        : (dueStatus ? dueStatus.color + '26' : 'rgba(234, 179, 8, 0.1)')
                                }]}>
                                    <Text style={[styles.statusText, {
                                        color: item.status === 'paid'
                                            ? '#04D361'
                                            : (dueStatus ? dueStatus.color : '#EAB308')
                                    }]}>
                                        {item.status === 'paid' ? 'PAGO' : (dueStatus?.label || 'PENDENTE')}
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                )}

            </TouchableOpacity>

            {/* Tutorial Overlay */}
            {showTutorial && (
                <Animated.View
                    entering={FadeIn.duration(500)}
                    style={styles.cardTutorialOverlay}
                    pointerEvents="none"
                >
                    <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.cardTutorialContent}>
                        <IntervalLottie
                            source={require('@/assets/check.json')}
                            size={28}
                            interval={4000}
                        />
                        <Text style={styles.cardTutorialText}>
                            Segure para selecionar
                        </Text>
                    </View>
                </Animated.View>
            )}
        </Animated.View>
    );
};

// Empty State
const EmptyState = ({ type, onAdd }: { type: RecurrenceTab; onAdd: () => void }) => {
    const isSubscription = type === 'subscriptions';

    return (
        <View style={styles.emptyRemindersContainer}>
            <View style={styles.emptyRemindersIconWrapper}>
                <IntervalLottie
                    source={isSubscription ? require('@/assets/assinatura.json') : require('@/assets/lembretes.json')}
                    size={120}
                    interval={5000}
                />
            </View>

            <Text style={styles.emptyRemindersTitle}>
                {isSubscription ? 'Nenhuma assinatura' : 'Nenhum lembrete'}
            </Text>

            <Text style={styles.emptyRemindersText}>
                {isSubscription
                    ? 'Você ainda não possui assinaturas cadastradas.'
                    : 'Você não tem lembretes pendentes para este mês.'}
            </Text>

            <TouchableOpacity
                style={styles.emptyRemindersButton}
                onPress={onAdd}
                activeOpacity={0.8}
            >
                <IntervalLottie source={require('@/assets/adicionar.json')} size={20} interval={4000} />
                <Text style={styles.emptyRemindersButtonText}>
                    {isSubscription ? 'Nova Assinatura' : 'Novo Lembrete'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const MiniCalendar = ({
    currentMonth,
    onChangeMonth,
    selectedDate,
    onSelectDate,
    items,
    type
}: {
    currentMonth: Date;
    onChangeMonth: (date: Date) => void;
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    items: RecurrenceItem[];
    type: RecurrenceTab;
}) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = [];
    for (let i = firstDay - 1; i >= 0; i--) {
        prevMonthDays.push({ day: daysInPrevMonth - i, isCurrentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
    }

    const currentMonthDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
        currentMonthDays.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }

    const nextMonthDays = [];
    const totalSlots = 42;
    const remainingSlots = totalSlots - (prevMonthDays.length + currentMonthDays.length);
    for (let i = 1; i <= remainingSlots; i++) {
        nextMonthDays.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }

    const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

    const hasItem = (date: Date) => {
        return items.some(item => {
            const [y, m, d] = item.dueDate.split('-').map(Number);

            if (item.frequency === 'monthly') {
                return d === date.getDate();
            } else {
                // Para anual, checa dia e mês
                // Assumindo que item.dueDate é a data base. 
                return d === date.getDate() && (m - 1) === date.getMonth();
            }
        });
    };

    return (
        <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
                <TouchableOpacity
                    onPress={() => onChangeMonth(new Date(year, month - 1, 1))}
                    style={styles.calendarArrow}
                >
                    <ChevronLeft size={20} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.calendarMonthTitle}>{months[month]} {year}</Text>
                <TouchableOpacity
                    onPress={() => onChangeMonth(new Date(year, month + 1, 1))}
                    style={styles.calendarArrow}
                >
                    <ChevronRight size={20} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.weekDaysRow}>
                {weekDays.map(day => (
                    <Text key={day} style={styles.weekDayText}>{day}</Text>
                ))}
            </View>

            <View style={styles.daysGrid}>
                {allDays.map((dayObj, index) => {
                    const isSelected = selectedDate.getDate() === dayObj.date.getDate() &&
                        selectedDate.getMonth() === dayObj.date.getMonth() &&
                        selectedDate.getFullYear() === dayObj.date.getFullYear();

                    const isToday = new Date().toDateString() === dayObj.date.toDateString();
                    const hasEvent = hasItem(dayObj.date);

                    return (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.dayCell,
                                isSelected && styles.dayCellSelected,
                                !dayObj.isCurrentMonth && { opacity: 0.3 }
                            ]}
                            onPress={() => onSelectDate(dayObj.date)}
                        >
                            <Text style={[
                                styles.dayText,
                                isSelected && styles.dayTextSelected,
                                isToday && !isSelected && { color: '#D97757', fontWeight: 'bold' }
                            ]}>
                                {dayObj.day}
                            </Text>
                            {hasEvent && (
                                <View style={[
                                    styles.eventDot,
                                    { backgroundColor: type === 'subscriptions' ? '#0A84FF' : '#FF9F0A' }
                                ]} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

// Dynamic Island para seleção múltipla (anima subindo do navbar)
const SelectionIsland = ({
    selectedCount,
    showBulkDeleteConfirm,
    areAllSelectedPaid,
    onCancel,
    onPay,
    onDelete,
    onCancelDelete,
    onConfirmDelete,
}: {
    selectedCount: number;
    showBulkDeleteConfirm: boolean;
    areAllSelectedPaid: boolean;
    onCancel: () => void;
    onPay: () => void;
    onDelete: () => void;
    onCancelDelete: () => void;
    onConfirmDelete: () => void;
}) => {
    const [showContent, setShowContent] = useState(false);

    const animatedWidth = useSharedValue(48);
    const animatedOpacity = useSharedValue(0);

    useEffect(() => {
        // Reset
        animatedWidth.value = 48;
        animatedOpacity.value = 0;
        setShowContent(false);

        // Expand width
        animatedWidth.value = withDelay(100, withSpring(SCREEN_WIDTH - 48, { damping: 15, mass: 1, stiffness: 100 }));

        // Fade in content
        animatedOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));

        const timer = setTimeout(() => {
            setShowContent(true);
        }, 150);
        return () => clearTimeout(timer);
    }, [showBulkDeleteConfirm]);

    const rStyle = useAnimatedStyle(() => ({
        width: animatedWidth.value,
    }));

    const rContentStyle = useAnimatedStyle(() => ({
        opacity: animatedOpacity.value,
    }));

    const handleClose = (callback: () => void) => {
        animatedOpacity.value = withTiming(0, { duration: 100 });
        setShowContent(false);
        animatedWidth.value = withDelay(50, withTiming(48, { duration: 250 }));
        setTimeout(() => {
            callback();
        }, 350);
    };

    const handleIconPress = () => {
        if (showBulkDeleteConfirm) {
            animatedOpacity.value = withTiming(0, { duration: 100 });
            setShowContent(false);
            setTimeout(() => onCancelDelete(), 120);
            return;
        }
        handleClose(onCancel);
    };

    return (
        <View style={islandStyles.overlay} pointerEvents="box-none">
            <Animated.View
                entering={(values: any) => {
                    'worklet';
                    return {
                        initialValues: {
                            transform: [{ translateY: 150 }],
                        },
                        animations: {
                            transform: [{ translateY: withSpring(0, { damping: 15, mass: 1, stiffness: 100 }) }],
                        },
                    };
                }}
                exiting={SlideOutDown.duration(200)}
                layout={Layout.springify()}
                style={[islandStyles.pillWrapper, rStyle]}
                pointerEvents="auto"
            >
                <BlurView intensity={30} tint="dark" style={islandStyles.pillContainer}>
                    {/* Glass Border */}
                    <View style={islandStyles.glassBorder} />

                    {/* Icon always visible */}
                    <TouchableOpacity
                        style={islandStyles.iconPosition}
                        onPress={handleIconPress}
                        activeOpacity={0.8}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {showBulkDeleteConfirm ? (
                            <IntervalLottie source={require('@/assets/perigo.json')} size={22} interval={4000} />
                        ) : (
                            <LottieView
                                source={require('@/assets/check.json')}
                                autoPlay
                                loop={false}
                                style={{ width: 22, height: 22 }}
                            />
                        )}
                    </TouchableOpacity>

                    {/* Content that fades in */}
                    {showContent && (
                        <Animated.View style={[islandStyles.contentRow, rContentStyle]}>
                            <View style={{ width: 16 }} />

                            {showBulkDeleteConfirm ? (
                                <>
                                    <Text style={islandStyles.pillText} numberOfLines={1}>
                                        Excluir {selectedCount} ite{selectedCount > 1 ? 'ns' : 'm'}?
                                    </Text>

                                    <View style={islandStyles.divider} />

                                    <View style={islandStyles.actionsRow}>
                                        <TouchableOpacity
                                            style={islandStyles.cancelBtn}
                                            onPress={() => {
                                                animatedOpacity.value = withTiming(0, { duration: 100 });
                                                setShowContent(false);
                                                setTimeout(() => onCancelDelete(), 120);
                                            }}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text style={islandStyles.cancelBtnText}>Não</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={islandStyles.deleteBtn}
                                            onPress={() => handleClose(onConfirmDelete)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text style={islandStyles.deleteBtnText}>Sim</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={islandStyles.pillText} numberOfLines={1}>
                                        {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
                                    </Text>

                                    <View style={islandStyles.divider} />

                                    <View style={islandStyles.actionsRow}>
                                        <TouchableOpacity
                                            style={islandStyles.actionBtn}
                                            onPress={onPay}
                                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                        >
                                            {areAllSelectedPaid ? (
                                                <IntervalLottie source={require('@/assets/relogio.json')} size={16} interval={4000} />
                                            ) : (
                                                <IntervalLottie source={require('@/assets/certo.json')} size={16} interval={4000} />
                                            )}
                                            <Text style={islandStyles.actionBtnText}>
                                                {areAllSelectedPaid ? 'Pendente' : 'Pagar'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={islandStyles.actionBtn}
                                            onPress={onDelete}
                                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                        >
                                            <IntervalLottie source={require('@/assets/lixeira.json')} size={16} interval={4000} />
                                            <Text style={islandStyles.actionBtnText}>Excluir</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </Animated.View>
                    )}
                </BlurView>
            </Animated.View>
        </View>
    );
};

const islandStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'flex-end',
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
        alignItems: 'center',
    },
    pillWrapper: {
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        height: 46,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'transparent',
    },
    pillContainer: {
        flex: 1,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(20, 20, 20, 0.88)',
        paddingHorizontal: 14,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    iconPosition: {
        position: 'absolute',
        left: 13,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
        width: '100%',
        justifyContent: 'space-between',
        paddingRight: 0,
    },
    pillText: {
        fontSize: 13,
        fontWeight: '400',
        color: '#FFFFFF',
        flex: 1,
    },
    divider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 2,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 99,
        gap: 4,
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    cancelBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 99,
    },
    cancelBtnText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#A0A0A0',
    },
    deleteBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 99,
        backgroundColor: '#D97757',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export function RecurrenceView({ initialTab = 'subscriptions' }: { initialTab?: RecurrenceTab }) {
    const { user } = useAuthContext();
    const [selectedTab, setSelectedTab] = useState<RecurrenceTab>(initialTab);
    const [items, setItems] = useState<RecurrenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDots, setLoadingDots] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [reminderModalVisible, setReminderModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<RecurrenceItem | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);

    // Calendar Mode State
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [displayedMonth, setDisplayedMonth] = useState(new Date());

    // Month Selector State
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    const minDate = useMemo(() => addMonths(new Date(), -60), []); // 5 years back
    const maxDate = useMemo(() => addMonths(new Date(), 60), []); // 5 years forward

    // Delete Confirmation State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<RecurrenceItem | null>(null);

    // Filter State
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [filters, setFilters] = useState<RecurrenceFilterState>({
        search: '',
        status: [],
        frequency: []
    });

    const activeFilterCount = (filters.search ? 1 : 0) + filters.status.length + filters.frequency.length;

    // Estados de seleção múltipla
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    // Estados de detecção de assinaturas
    const [detectedSubscriptions, setDetectedSubscriptions] = useState<DetectedSubscription[]>([]);

    // Limpa seleção ao trocar de aba
    useEffect(() => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
        setShowBulkDeleteConfirm(false);
    }, [selectedTab]);

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



    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubscribe = databaseService.onRecurrencesChange(user.uid, (data) => {
            const loadedItems = data as RecurrenceItem[];
            setItems(loadedItems);
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Detecta assinaturas automaticamente
    useEffect(() => {
        const detectSubscriptionsAuto = async () => {
            if (!user || loading || selectedTab !== 'subscriptions') return;

            try {
                console.log('[RecurrenceView] Running auto detection...');

                // Busca transações bancárias
                const accountsResult = await databaseService.getAccounts(user.uid);
                if (!accountsResult.success || !accountsResult.data || accountsResult.data.length === 0) {
                    return;
                }

                // Coleta transações
                const allTransactions: any[] = [];
                for (const account of accountsResult.data) {
                    if (account.type === 'CHECKING_ACCOUNT' && account.transactions) {
                        allTransactions.push(...account.transactions);
                    }
                }

                if (allTransactions.length === 0) return;

                // Formata transações
                const formattedTransactions = allTransactions.map(t => ({
                    id: t.id,
                    description: t.description || t.name || 'Transação',
                    amount: Math.abs(t.amount),
                    date: t.date,
                    type: t.amount < 0 ? 'expense' as const : 'income' as const
                }));

                // Detecta assinaturas
                const detected = detectSubscriptions(formattedTransactions);
                console.log('[RecurrenceView] Detected', detected.length, 'subscriptions');

                // Filtra apenas novas (que não existem)
                const existingNames = items
                    .filter(i => i.type === 'subscription' && i.isValidated !== false)
                    .map(i => i.name.toLowerCase().trim());

                const newDetections = detected.filter((det: DetectedSubscription) => {
                    const detName = det.name.toLowerCase().trim();
                    return !existingNames.some(name =>
                        detName.includes(name) || name.includes(detName)
                    );
                });

                console.log('[RecurrenceView] New detections:', newDetections.length);
                setDetectedSubscriptions(newDetections);
            } catch (error) {
                console.error('[RecurrenceView] Error detecting:', error);
            }
        };

        detectSubscriptionsAuto();
    }, [user, loading, selectedTab, items]);

    const handleOptionPay = async (item: RecurrenceItem) => {
        if (!user) return;

        if (item.status === 'paid') {
            // Revert to pending (undo payment)
            await databaseService.unpayRecurrence(user.uid, item);
        } else {
            // Process payment
            await databaseService.payRecurrence(user.uid, item);
        }
    };

    const handleOptionDelete = (item: RecurrenceItem) => {
        setItemToDelete(item);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!user || !itemToDelete) return;

        // Close modal immediately for better UX
        setDeleteModalVisible(false);

        await databaseService.deleteRecurrence(user.uid, itemToDelete.id, itemToDelete.type);
        setItemToDelete(null);
    };

    const handleOptionEdit = (item: RecurrenceItem) => {
        setEditingItem(item);
        setReminderModalVisible(true);
    };

    const handleSaveReminder = async (data: { title: string; amount: number; date: string; frequency: 'monthly' | 'yearly'; cancellationReminder?: boolean; type: 'income' | 'expense'; category: string }) => {
        if (!user) return;

        const [dayRaw, monthRaw, year] = data.date.split('/');
        const day = dayRaw.padStart(2, '0');
        const month = monthRaw.padStart(2, '0');
        const dueDate = `${year}-${month}-${day}`;

        let cancellationDate = null;
        if (data.cancellationReminder) {
            // Calculate cancellation date (1 day before due date)
            // Note: Since dueDate is just a string without time, we treat it as local date.
            const dueObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            dueObj.setDate(dueObj.getDate() - 1); // 1 day before

            const cYear = dueObj.getFullYear();
            const cMonth = String(dueObj.getMonth() + 1).padStart(2, '0');
            const cDay = String(dueObj.getDate()).padStart(2, '0');
            cancellationDate = `${cYear}-${cMonth}-${cDay}`;
        }

        const type = selectedTab === 'subscriptions' ? 'subscription' : 'reminder';

        const recurrenceData = {
            name: data.title,
            amount: data.amount,
            dueDate: dueDate,
            type: type,
            status: 'pending',
            frequency: data.frequency,
            cancellationDate: cancellationDate,
            transactionType: data.type, // Add explicit transaction type (income/expense)
            category: data.category, // Add selected category
            isValidated: true // Assinaturas criadas manualmente são sempre validadas
        };

        if (editingItem) {
            await databaseService.updateRecurrence(user.uid, editingItem.id, recurrenceData, editingItem.type);
            setEditingItem(null);
        } else {
            await databaseService.addRecurrence(user.uid, recurrenceData);
        }
    };

    // Funções de seleção múltipla
    const handleLongPress = (item: RecurrenceItem) => {
        setIsSelectionMode(true);
        setSelectedIds(new Set([item.id]));
        setShowBulkDeleteConfirm(false);
    };

    const handleToggleSelect = (item: RecurrenceItem) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(item.id)) {
                newSet.delete(item.id);
                // Se não tiver mais selecionados, sai do modo seleção
                if (newSet.size === 0) {
                    setIsSelectionMode(false);
                    setShowBulkDeleteConfirm(false);
                }
            } else {
                newSet.add(item.id);
            }
            return newSet;
        });
    };

    const handleCancelSelection = () => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
        setShowBulkDeleteConfirm(false);
    };

    const handleDeleteSelected = () => {
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = async () => {
        if (!user || selectedIds.size === 0) return;

        // Deleta todos os itens selecionados
        const promises = Array.from(selectedIds).map(id => {
            const item = items.find(i => i.id === id);
            if (item) {
                return databaseService.deleteRecurrence(user.uid, id, item.type);
            }
            return Promise.resolve();
        });

        await Promise.all(promises);

        setSelectedIds(new Set());
        setIsSelectionMode(false);
        setShowBulkDeleteConfirm(false);
    };

    const areAllSelectedPaid = useMemo(() => {
        if (selectedIds.size === 0) return false;
        const selectedItems = items.filter(i => selectedIds.has(i.id));
        return selectedItems.length > 0 && selectedItems.every(i => i.status === 'paid');
    }, [selectedIds, items]);

    const handlePaySelected = async () => {
        if (!user || selectedIds.size === 0) return;

        const selectedItems = items.filter(i => selectedIds.has(i.id));
        const newStatus = areAllSelectedPaid ? 'pending' : 'paid';

        const promises = selectedItems.map(item => {
            if (newStatus === 'paid') {
                return databaseService.payRecurrence(user.uid, item);
            } else {
                return databaseService.unpayRecurrence(user.uid, item);
            }
        });

        await Promise.all(promises);

        // Feedback visual poderia ser adicionado aqui, mas por enquanto basta sair do modo de seleção
        setSelectedIds(new Set());
        setIsSelectionMode(false);
        setShowBulkDeleteConfirm(false);
    };

    // Handlers para assinaturas detectadas
    const handleConfirmDetection = async (detection: DetectedSubscription) => {
        if (!user) return;

        try {
            console.log('[RecurrenceView] Confirming detection:', detection.name);
            const formattedData = formatDetectedSubscription(detection);
            await databaseService.addRecurrence(user.uid, formattedData);

            // Remove da lista de detecções
            setDetectedSubscriptions(prev => prev.filter(d => d.id !== detection.id));
        } catch (error) {
            console.error('Erro ao confirmar assinatura:', error);
        }
    };

    const handleDismissDetection = async (detection: DetectedSubscription) => {
        console.log('[RecurrenceView] Dismissing detection:', detection.name);
        console.log('[RecurrenceView] Current detections:', detectedSubscriptions.length);

        // Remove da lista de detecções
        setDetectedSubscriptions(prev => {
            const filtered = prev.filter(d => d.id !== detection.id);
            console.log('[RecurrenceView] After dismiss:', filtered.length);
            return filtered;
        });
    };

    const onRefresh = () => {
        setRefreshing(true);
        // Trigger a re-fetch inside the listener if needed, or just let it be. 
        // For real-time, refresh is usually not needed unless we force a reload.
        // We can force reload by simulating a change or just re-setting the listener.
        // For now, simpliest way is to toggle a refresh trigger but the listener is persistent.
        // Let's just unset refreshing after a timeout since it's real-time.
        setTimeout(() => setRefreshing(false), 1000);
    };

    const filteredItems = useMemo(() => {
        let result = items.filter(item =>
            selectedTab === 'subscriptions'
                ? item.type === 'subscription'
                : item.type === 'reminder'
        );

        // Adiciona detecções como items temporários (apenas para subscriptions)
        if (selectedTab === 'subscriptions' && detectedSubscriptions.length > 0) {
            const detectedItems: RecurrenceItem[] = detectedSubscriptions.map(det => {
                const formatted = formatDetectedSubscription(det);
                return {
                    ...formatted,
                    id: det.id,
                    isDetected: true,
                    isValidated: false,
                    detectedData: det
                } as RecurrenceItem;
            });
            result = [...result, ...detectedItems];
        }

        // Filter and Project by Month
        result = result.map(item => {
            // Se é uma detecção, não precisa projetar
            if (item.isDetected) {
                return item;
            }

            const [y, m, d] = item.dueDate.split('-').map(Number);
            const selectedYear = selectedMonth.getFullYear();
            const selectedMonthIndex = selectedMonth.getMonth();

            // Helper to check if item is active in selected month (respecting cancellation)
            if (item.cancellationDate) {
                const [cy, cm, cd] = item.cancellationDate.split('-').map(Number);
                const cancelDate = new Date(cy, cm - 1, cd);
                const monthStart = new Date(selectedYear, selectedMonthIndex, 1);
                const dayToUse = Math.min(d, new Date(selectedYear, selectedMonthIndex + 1, 0).getDate()); // Define dayToUse here for cancellation check
                const dateToCheck = new Date(selectedYear, selectedMonthIndex, dayToUse);
                if (monthStart > cancelDate) return null;
            }

            // Logic Split: Subscriptions vs Reminders
            if (item.type === 'subscription') {
                // SUBSCRIPTIONS: Single document model. We MUST project.
                if (item.frequency === 'monthly') {
                    // Handle days like 31st in Feb
                    const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
                    const dayToUse = Math.min(d, daysInMonth);

                    // Create projected date
                    const projectedIso = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-${String(dayToUse).padStart(2, '0')}`;

                    // Check if this specific month is paid
                    const monthKey = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;
                    const altMonthKey = `${selectedYear}-${selectedMonthIndex + 1}`;
                    const isPaid = item.paidMonths?.some((m: string) => m === monthKey || m === altMonthKey);

                    return {
                        ...item,
                        dueDate: projectedIso,
                        status: isPaid ? 'paid' : 'pending'
                    };

                } else if (item.frequency === 'yearly') {
                    // Only show if month matches
                    if ((m - 1) === selectedMonthIndex) {
                        // Project year
                        const projectedIso = `${selectedYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                        // Check if paid
                        const monthKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
                        const altMonthKey = `${selectedYear}-${m}`;
                        const isPaid = item.paidMonths?.some((k: string) => k === monthKey || k === altMonthKey);

                        return {
                            ...item,
                            dueDate: projectedIso,
                            status: isPaid ? 'paid' : 'pending'
                        };
                    }
                    return null;
                }
            } else {
                // REMINDERS: Discrete document model (new doc created on payment).
                // Do NOT project. Strictly filter by stored dueDate.
                // Include "past" (overdue) pending reminders in the current month view.

                // Exact match for the selected month
                if ((m - 1) === selectedMonthIndex && y === selectedYear) {
                    return item;
                }

                // If overdue (before the selected month) and unpaid, show it in the current month
                const itemMonthValue = y * 12 + (m - 1);
                const selectedMonthValue = selectedYear * 12 + selectedMonthIndex;

                if (item.status !== 'paid' && itemMonthValue < selectedMonthValue) {
                    return item;
                }

                return null;
            }

            // Fallback for any other cases (should be covered above)
            return null;
        }).filter((item): item is RecurrenceItem => item !== null);

        // Apply Filters
        if (activeFilterCount > 0) {
            result = result.filter(item => {
                let matches = true;

                // Search
                if (filters.search) {
                    matches = matches && item.name.toLowerCase().includes(filters.search.toLowerCase());
                }

                // Status
                if (filters.status.length > 0) {
                    matches = matches && filters.status.includes(item.status);
                }

                // Frequency
                if (filters.frequency.length > 0) {
                    matches = matches && !!item.frequency && filters.frequency.includes(item.frequency);
                }

                return matches;
            });
        }

        // Sort by day
        result.sort((a, b) => {
            const dayA = parseInt(a.dueDate.split('-')[2]);
            const dayB = parseInt(b.dueDate.split('-')[2]);
            return dayA - dayB;
        });

        return result;
    }, [items, filters, activeFilterCount, selectedMonth, selectedTab, detectedSubscriptions]);

    const groupedItems = useMemo(() => {
        if (filteredItems.length === 0) return [];

        const groups: { title: string; items: RecurrenceItem[] }[] = [];

        filteredItems.forEach(item => {
            const category = item.category || 'Outros';
            let group = groups.find(g => g.title === category);
            if (!group) {
                group = { title: category, items: [] };
                groups.push(group);
            }
            group.items.push(item);
        });

        // Sort groups alphabetically
        groups.sort((a, b) => a.title.localeCompare(b.title));

        return groups;
    }, [filteredItems]);

    const subscriptionTotal = useMemo(() => {
        return items
            .filter(i => i.type === 'subscription')
            .reduce((acc, curr) => acc + curr.amount, 0);
    }, [items]);

    const reminderCount = useMemo(() => {
        return items.filter(i => i.type === 'reminder' && i.status !== 'paid').length;
    }, [items]);

    // Check tutorial - Moved here to verify filteredItems availability
    useEffect(() => {
        const checkTutorial = async () => {
            if (loading || filteredItems.length === 0) return;

            try {
                // Key with _v2 to force reset
                const hasShown = await AsyncStorage.getItem('hasShownLongPressTutorial_v3');
                if (!hasShown) {
                    setShowTutorial(true);
                }
            } catch (error) {
                console.error(error);
            }
        };

        checkTutorial();
    }, [loading, filteredItems]);

    const dismissTutorial = async () => {
        setShowTutorial(false);
        await AsyncStorage.setItem('hasShownLongPressTutorial_v3', 'true');
    };

    const totals = useMemo(() => {
        const formatMoney = (val: number) => val; // Placeholder for logic consistency

        if (selectedTab === 'subscriptions') {
            // Filtra apenas assinaturas validadas (isValidated !== false)
            const validatedItems = filteredItems.filter(item => item.isValidated !== false);

            const monthlyTotal = validatedItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
            const monthlyPaid = validatedItems.filter(i => i.status === 'paid').reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
            const monthlyRemaining = monthlyTotal - monthlyPaid;

            const yearlyEstimation = items
                .filter(i => i.type === 'subscription' && i.isValidated !== false)
                .reduce((acc, item) => {
                    const amount = Number(item.amount) || 0;
                    if (item.cancellationDate) {
                        const [y, m, d] = item.cancellationDate.split('-').map(Number);
                        const cDate = new Date(y, m - 1, d);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (cDate < today) return acc;
                    }

                    if (item.frequency === 'monthly') return acc + (amount * 12);
                    return acc + amount;
                }, 0);

            return { monthlyTotal, monthlyPaid, monthlyRemaining, yearlyEstimation };
        } else {
            let expensePending = 0;
            let expensePaid = 0;
            let incomePending = 0;
            let incomeReceived = 0;

            // Filtra apenas lembretes validados
            const validatedItems = filteredItems.filter(item => item.isValidated !== false);

            validatedItems.forEach(item => {
                const amount = Number(item.amount) || 0;
                const isIncome = item.transactionType === 'income';
                const isPaid = item.status === 'paid';

                if (isIncome) {
                    if (isPaid) incomeReceived += amount;
                    else incomePending += amount;
                } else {
                    if (isPaid) expensePaid += amount;
                    else expensePending += amount;
                }
            });

            return {
                expenseTotal: expensePending + expensePaid,
                expensePaid,
                expensePending,
                incomeTotal: incomePending + incomeReceived,
                incomeReceived,
                incomePending
            };
        }
    }, [filteredItems, items, selectedTab]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const renderSummaryCard = () => (
        <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
                {selectedTab === 'subscriptions' ? (
                    <>
                        <View style={styles.summaryCol}>
                            <View style={styles.summaryHeaderRow}>
                                <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(255, 69, 58, 0.1)' }]}>
                                    <IntervalLottie source={require('@/assets/despesa.json')} size={14} interval={5000} />
                                </View>
                                <Text style={styles.summaryLabelSmall}>A Pagar</Text>
                            </View>
                            <Text style={styles.summaryValueSmall}>
                                {formatCurrency((totals as any).monthlyRemaining || 0)}
                            </Text>
                            <Text style={styles.summarySubLabelSmall}>
                                Pago: {formatCurrency((totals as any).monthlyPaid || 0)}
                            </Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryCol}>
                            <View style={styles.summaryHeaderRow}>
                                <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(10, 132, 255, 0.1)' }]}>
                                    <IntervalLottie source={require('@/assets/previsao.json')} size={14} interval={5000} />
                                </View>
                                <Text style={styles.summaryLabelSmall}>Anual</Text>
                            </View>
                            <Text style={[styles.summaryValueSmall, { color: '#888' }]}>
                                {formatCurrency((totals as any).yearlyEstimation || 0)}
                            </Text>
                            <Text style={styles.summarySubLabelSmall}>Projeção ativa</Text>
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.summaryCol}>
                            <View style={styles.summaryHeaderRow}>
                                <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(255, 69, 58, 0.1)' }]}>
                                    <IntervalLottie source={require('@/assets/despesa.json')} size={14} interval={5000} />
                                </View>
                                <Text style={styles.summaryLabelSmall}>A Pagar</Text>
                            </View>
                            <Text style={[styles.summaryValueSmall, { color: '#FF453A' }]}>
                                {formatCurrency((totals as any).expensePending || 0)}
                            </Text>
                            <Text style={styles.summarySubLabelSmall}>
                                Pago: {formatCurrency((totals as any).expensePaid || 0)}
                            </Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryCol}>
                            <View style={styles.summaryHeaderRow}>
                                <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(4, 211, 97, 0.1)' }]}>
                                    <IntervalLottie source={require('@/assets/receita.json')} size={14} interval={5000} />
                                </View>
                                <Text style={styles.summaryLabelSmall}>Receber</Text>
                            </View>
                            <Text style={[styles.summaryValueSmall, { color: '#04D361' }]}>
                                {formatCurrency((totals as any).incomePending || 0)}
                            </Text>
                            <Text style={styles.summarySubLabelSmall}>
                                Recebido: {formatCurrency((totals as any).incomeReceived || 0)}
                            </Text>
                        </View>
                    </>
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <UniversalBackground
                backgroundColor="#0C0C0C"
                glowSize={350}
                height={280}
                showParticles={true}
                particleCount={15}
            />

            <View style={styles.content}>


                <View style={styles.header}>
                    <Text style={styles.title}>
                        {selectedTab === 'subscriptions' ? 'Assinaturas' : 'Lembretes'}
                    </Text>

                    <MonthSelector
                        currentMonth={selectedMonth}
                        onMonthChange={setSelectedMonth}
                        minDate={minDate}
                        maxDate={maxDate}
                        allowFuture={true}
                    />
                </View>

                <View style={styles.subHeader}>
                    <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => setViewMode(prev => prev === 'list' ? 'calendar' : 'list')}
                        >
                            {viewMode === 'list' ? (
                                <IntervalLottie source={require('@/assets/calendario.json')} size={22} interval={5000} />
                            ) : (
                                <LayoutList size={18} color="#FFF" />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.iconButton,
                                activeFilterCount > 0 && {
                                    borderColor: '#D97757',
                                    backgroundColor: 'rgba(217, 119, 87, 0.1)'
                                }
                            ]}
                            onPress={() => setFilterModalVisible(true)}
                        >
                            <IntervalLottie source={require('@/assets/previsao.json')} size={22} interval={5000} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setReminderModalVisible(true)} style={styles.headerButton}>
                            <IntervalLottie source={require('@/assets/adicionar.json')} size={18} interval={4000} />
                            <Text style={styles.headerButtonText}>Novo</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.listContainer}>







                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <LottieView
                                source={require('@/assets/carregando.json')}
                                autoPlay
                                loop
                                style={{ width: 50, height: 50 }}
                            />
                            <Text style={styles.loadingText}>
                                {selectedTab === 'subscriptions' ? 'Carregando assinaturas' : 'Carregando lembretes'}{loadingDots}
                            </Text>
                        </View>
                    ) : viewMode === 'calendar' ? (
                        <View style={{ flex: 1 }}>
                            <FlatList
                                extraData={{ isSelectionMode, selectedIds }}
                                data={filteredItems.filter(item => {
                                    const parts = item.dueDate.split('-');
                                    if (parts.length < 3) return false;
                                    const d = parseInt(parts[2]);
                                    const m = parseInt(parts[1]) - 1;

                                    const isSameDay = d === calendarDate.getDate();

                                    if (item.frequency === 'monthly') {
                                        return isSameDay;
                                    } else {
                                        return isSameDay && m === calendarDate.getMonth();
                                    }
                                })}
                                renderItem={({ item, index }) => (
                                    <ListItem
                                        item={item}
                                        index={index}
                                        onPay={handleOptionPay}
                                        onEdit={handleOptionEdit}
                                        onDelete={handleOptionDelete}
                                        onConfirmDetection={handleConfirmDetection}
                                        onDismissDetection={handleDismissDetection}
                                        isSelectionMode={isSelectionMode}
                                        isSelected={selectedIds.has(item.id)}
                                        onLongPress={handleLongPress}
                                        onToggleSelect={handleToggleSelect}
                                        showTutorial={false}
                                    />
                                )}
                                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                                keyExtractor={item => 'cal_' + item.id}
                                contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={
                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ color: '#555', fontSize: 14 }}>Nenhum vencimento neste dia</Text>
                                    </View>
                                }
                                ListHeaderComponent={
                                    <>
                                        {filteredItems.length > 0 && renderSummaryCard()}
                                        <MiniCalendar
                                            currentMonth={displayedMonth}
                                            onChangeMonth={setDisplayedMonth}
                                            selectedDate={calendarDate}
                                            onSelectDate={setCalendarDate}
                                            items={filteredItems}
                                            type={selectedTab}
                                        />
                                        <Text style={[styles.sectionTitle, { marginTop: 24, paddingHorizontal: 4 }]}>
                                            {calendarDate.getDate()} de {calendarDate.toLocaleDateString('pt-BR', { month: 'long' })}
                                        </Text>
                                    </>
                                }
                            />
                        </View>
                    ) : groupedItems.length > 0 ? (
                        <FlatList
                            extraData={{ isSelectionMode, selectedIds }}
                            data={groupedItems}
                            renderItem={({ item: group }) => (
                                <RecurrenceGroup title={group.title}>
                                    {group.items.map((item, index) => (
                                        <ListItem
                                            key={item.id}
                                            item={item}
                                            index={index}
                                            onPay={handleOptionPay}
                                            onEdit={handleOptionEdit}
                                            onDelete={handleOptionDelete}
                                            onConfirmDetection={handleConfirmDetection}
                                            onDismissDetection={handleDismissDetection}
                                            isSelectionMode={isSelectionMode}
                                            isSelected={selectedIds.has(item.id)}
                                            // Se tem tutorial, intercepta o long press para dispensar
                                            onLongPress={(item) => {
                                                if (showTutorial) {
                                                    dismissTutorial();
                                                }
                                                handleLongPress(item);
                                            }}
                                            onToggleSelect={handleToggleSelect}
                                            showTutorial={showTutorial}
                                        />
                                    ))}
                                </RecurrenceGroup>
                            )}
                            ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
                            keyExtractor={item => item.title}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#D97757"
                                />
                            }
                            ListHeaderComponent={renderSummaryCard}
                        />
                    ) : (
                        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                            <EmptyState
                                type={selectedTab}
                                onAdd={() => {
                                    setEditingItem(null);
                                    setReminderModalVisible(true);
                                }}
                            />
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Dynamic Island - Barra de seleção múltipla */}
            {isSelectionMode && (
                <SelectionIsland
                    selectedCount={selectedIds.size}
                    showBulkDeleteConfirm={showBulkDeleteConfirm}
                    areAllSelectedPaid={areAllSelectedPaid}
                    onCancel={handleCancelSelection}
                    onPay={handlePaySelected}
                    onDelete={handleDeleteSelected}
                    onCancelDelete={() => setShowBulkDeleteConfirm(false)}
                    onConfirmDelete={confirmBulkDelete}
                />
            )}
            {/* Delete Confirmation Modal */}
            <RecurrenceDeleteModal
                visible={deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={handleConfirmDelete}
                title={`Excluir ${itemToDelete?.type === 'subscription' ? 'Assinatura' : 'Lembrete'}?`}
                message="Esta ação não pode ser desfeita."
                confirmText="Excluir"
                cancelText="Cancelar"
            />

            {/* Modal de Adicionar/Editar */}
            <ReminderModal
                visible={reminderModalVisible}
                onClose={() => {
                    setReminderModalVisible(false);
                    setEditingItem(null);
                }}
                onSave={handleSaveReminder}
                mode={selectedTab}
                initialData={editingItem ? {
                    title: editingItem.name,
                    amount: editingItem.amount,
                    date: editingItem.dueDate,
                    frequency: editingItem.frequency || 'monthly',
                    cancellationDate: editingItem.cancellationDate,
                    transactionType: editingItem.transactionType,
                    category: editingItem.category
                } : null}
            />

            <RecurrenceFilterModal
                visible={filterModalVisible}
                onClose={() => setFilterModalVisible(false)}
                onApply={setFilters}
                initialFilters={filters}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    content: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 60, // Space for status bar
        zIndex: 10,
    },
    header: {
        paddingHorizontal: 20,
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
    headerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D97757',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    headerButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    subHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 20,
        marginTop: 10,
    },
    listHeaderCount: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },

    // Group Styles
    groupContainer: {
        marginBottom: 8,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    groupIcon: {
        width: 24,
        height: 24,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    groupTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#BBB',
        textTransform: 'capitalize',
    },
    groupList: {
        gap: 12,
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    listItem: {
        flexDirection: 'column',
        padding: 16,
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        overflow: 'hidden', // Importante para o tutorial cobrir tudo respeitando as bordas
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    listItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    listIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    listItemSubtitle: {
        fontSize: 12,
        color: '#909090',
    },
    listItemRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    listItemAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        marginTop: 40,
        display: 'none', // Deprecated, keeping for safety if referenced elsewhere but shouldn't be
    },
    emptyStateIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        display: 'none',
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
        display: 'none',
    },
    emptyStateText: {
        fontSize: 14,
        color: '#909090',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
        display: 'none',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D97757',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
        display: 'none',
    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
        display: 'none',
    },
    actionsOverlay: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    actionsGradient: {
        position: 'absolute',
        left: -40,
        top: 0,
        bottom: 0,
        width: 40,
        backgroundColor: 'transparent',
        // Simulates gradient fade from transparent to dark
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#161616',
        paddingLeft: 8,
        gap: 4,
    },
    actionButton: {
        padding: 10,
        borderRadius: 8,
    },
    // Estilos do card de confirmação de exclusão
    deleteConfirmCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    deleteConfirmContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    deleteConfirmText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Estilos de seleção múltipla
    selectionCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#555',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    selectionCheckboxSelected: {
        backgroundColor: '#D97757',
        borderColor: '#D97757',
    },
    // Estilos do Tutorial Inline
    cardTutorialOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden', // Importante para o BlurView respeitar o borderRadius do pai
        borderRadius: 16,
        zIndex: 20,
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 16,
        backgroundColor: 'rgba(0,0,0,0.85)', // Camada extra de escurecimento
    },
    cardTutorialContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        gap: 8,
    },
    cardTutorialText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    // Calendar Styles
    calendarContainer: {
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    calendarMonthTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        textTransform: 'capitalize',
    },
    calendarArrow: {
        padding: 8,
        backgroundColor: '#252525',
        borderRadius: 8,
    },
    weekDaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekDayText: {
        width: '14.28%',
        textAlign: 'center',
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        height: 48,
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginBottom: 4,
        paddingTop: 8,
        borderRadius: 8,
    },
    dayCellSelected: {
        backgroundColor: 'rgba(217, 119, 87, 0.2)',
        borderWidth: 1,
        borderColor: '#D97757',
    },
    dayText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '500',
    },
    dayTextSelected: {
        color: '#D97757',
        fontWeight: '700',
    },
    eventDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 6,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginTop: 40,
    },
    loadingText: {
        color: '#909090',
        fontSize: 14,
    },
    // New Empty State Styles (Reminders)
    emptyRemindersContainer: {
        paddingHorizontal: 32,
        // Added paddingBottom to visually center vertically relative to the full screen
        paddingBottom: 120,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    emptyRemindersIconWrapper: {
        marginBottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyRemindersTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyRemindersText: {
        fontSize: 15,
        color: '#888',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    emptyRemindersButton: {
        backgroundColor: '#D97757',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 100,
        elevation: 0,
        shadowColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    emptyRemindersButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },


    // Summary Card Styles
    summaryCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    summaryLabelSmall: {
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '600',
    },
    summaryValueSmall: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    summarySubLabelSmall: {
        fontSize: 10,
        color: '#666',
        marginTop: 2,
    },
    summaryIconBox: {
        width: 24,
        height: 24,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    summaryCol: {
        flex: 1,
        alignItems: 'flex-start',
    },
    summaryDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#2A2A2A',
        marginHorizontal: 12,
    },
    // Detection Actions Styles
    detectionActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    dismissButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.3)',
    },
    dismissButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FF453A',
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#D97757',
    },
    confirmButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});




