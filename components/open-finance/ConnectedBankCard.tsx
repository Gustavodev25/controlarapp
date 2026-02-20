import { BankConnectorLogo } from '@/components/open-finance/BankConnectorLogo';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { DynamicText } from '@/components/ui/DynamicText';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    CheckCircle,
    Database,
    Eye,
    EyeOff,
    Landmark,
    Link2,
    Lock,
    ScrollText
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    LayoutAnimation,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import Animated, {
    Extrapolate,
    FadeIn,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const IntervalLottie = React.memo(({ source, size = 20, interval = 3000 }: { source: any; size?: number; interval?: number }) => (
    <DelayedLoopLottie
        source={source}
        style={{ width: size, height: size }}
        delay={interval}
        initialDelay={100}
        renderMode="HARDWARE"
        resizeMode="contain"
        jitterRatio={0.15}
    />
));
IntervalLottie.displayName = 'ConnectedBankCardIntervalLottie';

// Components moved to bottom


export type BankSyncStatus = {
    step: 'idle' | 'connecting' | 'fetching_accounts' | 'saving_accounts' | 'fetching_transactions' | 'saving_transactions' | 'done' | 'error';
    message: string;
    progress: number;
    details?: { checking: number; credit: number };
};

interface ConnectedBankCardProps {
    group: any;
    onDelete: (group: any) => void;
    onSync: (group: any, onStatusUpdate: (status: BankSyncStatus) => void) => Promise<void>;
    // Sync Credits props
    hasCredits?: boolean;
    // Function to check if this specific bank can sync (by itemId)
    canSyncItem?: (itemId: string) => boolean;
    // Function to consume credit with itemId
    onConsumeCredit?: (action: 'sync', itemId?: string) => Promise<{ success: boolean; error?: string }>;
    hiddenAccountIds?: string[];
    onToggleVisibility?: (accountId: string) => void;
}

const STEPS = [
    { key: 'connecting', label: 'Conectando...', icon: Link2 },
    { key: 'fetching_accounts', label: 'Verificando contas', icon: Landmark },
    { key: 'fetching_transactions', label: 'Buscando transações', icon: ScrollText },
    { key: 'saving_transactions', label: 'Processando dados', icon: Database },
];

// Helper Component: Minimalist progress indicator
// Removed complex stepper components (PulseRing, StepIcon, StepItem) for a minimalist design

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
};


export const ConnectedBankCard = ({
    group,
    onDelete,
    onSync,
    hasCredits = true,
    canSyncItem,
    onConsumeCredit,
    hiddenAccountIds,
    onToggleVisibility
}: ConnectedBankCardProps) => {
    const cardId = group.connector?.id || group.accounts?.[0]?.itemId || 'unknown_bank';
    const storageKey = `bank_card_expanded_${cardId}`;

    const [expanded, setExpanded] = useState(true);
    const [syncStatus, setSyncStatus] = useState<BankSyncStatus>({
        step: 'idle',
        message: '',
        progress: 0
    });
    const syncStepRef = useRef<BankSyncStatus['step']>('idle');

    useEffect(() => {
        syncStepRef.current = syncStatus.step;
    }, [syncStatus.step]);


    // Load persisted expansion state
    useEffect(() => {
        const loadState = async () => {
            try {
                const stored = await AsyncStorage.getItem(storageKey);
                if (stored !== null) {
                    const shouldExpand = stored === 'true';
                    setExpanded(shouldExpand);
                    // Update shared value immediately to match state without animation if mounting
                    rotation.value = shouldExpand ? 0 : 180;
                }
            } catch (e) {
                console.log('Error loading bank card state', e);
            }
        };
        loadState();
    }, [storageKey]);

    // Timer state for countdown until midnight
    const [timeUntilReset, setTimeUntilReset] = useState<string>('');

    // Get itemId from first account in group
    const itemId = group.accounts?.[0]?.pluggyItemId || group.accounts?.[0]?.itemId || null;

    // Check if THIS specific bank can sync today
    const canSyncThisBank = canSyncItem ? (itemId ? canSyncItem(itemId) : true) : true;

    // Update countdown timer every second when sync is disabled
    useEffect(() => {
        if (!canSyncThisBank) {
            const updateTimer = () => {
                const now = new Date();
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);

                const diffMs = tomorrow.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

                setTimeUntilReset(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            };

            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [canSyncThisBank]);

    const isSyncing = syncStatus.step !== 'idle' && syncStatus.step !== 'done' && syncStatus.step !== 'error';

    // Sync is disabled if: no credits OR already synced this bank today
    const isSyncDisabled = !hasCredits || !canSyncThisBank;

    const handleSync = async () => {
        if (isSyncing) return;

        console.log('[ConnectedBankCard] handleSync called');

        // Check if sync is available for THIS bank
        if (!canSyncThisBank) {
            const resetTime = databaseService.getTimeUntilReset();
            Alert.alert(
                'Sincronização Diária Usada',
                `Você já sincronizou este banco hoje. A sincronização estará disponível novamente após meia-noite.\n\nRenova em: ${resetTime.formatted}`,
                [{ text: 'Entendi' }]
            );
            return;
        }

        if (!hasCredits) {
            const resetTime = databaseService.getTimeUntilReset();
            Alert.alert(
                'Créditos Esgotados',
                `Você não tem mais créditos de sincronização hoje.\n\nSeus créditos serão renovados em ${resetTime.formatted}.`,
                [{ text: 'Entendi' }]
            );
            return;
        }

        // Consume credit for sync - pass itemId to track per-bank
        if (onConsumeCredit) {
            const creditResult = await onConsumeCredit('sync', itemId);
            if (!creditResult.success) {
                Alert.alert('Erro', creditResult.error || 'Erro ao consumir crédito.');
                return;
            }

            // Schedule notification for when this bank is available again
            notificationService.scheduleBankAvailabilityNotification(group.connector?.name || 'Banco');
        }

        setSyncStatus({ step: 'connecting', message: 'Iniciando...', progress: 0 });

        try {
            await onSync(group, setSyncStatus);
            // Fallback: guarantee a final status when sync resolves without done/error.
            if (!['idle', 'done', 'error'].includes(syncStepRef.current)) {
                setSyncStatus({
                    step: 'done',
                    message: 'Sincronizacao concluida com sucesso.',
                    progress: 100
                });
                setTimeout(() => {
                    setSyncStatus({ step: 'idle', message: '', progress: 0 });
                }, 3000);
            }
        } catch (error) {
            setSyncStatus({ step: 'error', message: 'Erro na sincronização', progress: 0 });
            setTimeout(() => {
                setSyncStatus({ step: 'idle', message: '', progress: 0 });
            }, 3000);
        }
    };

    const rotation = useSharedValue(expanded ? 0 : 180);

    // Sync rotation with expanded state changes
    useEffect(() => {
        rotation.value = withTiming(expanded ? 0 : 180, { duration: 300 });
    }, [expanded]);

    const animatedChevronStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }],
        };
    });

    const toggleExpand = () => {
        LayoutAnimation.configureNext({
            duration: 300,
            create: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
            update: {
                type: LayoutAnimation.Types.easeInEaseOut,
            },
            delete: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
        });
        setExpanded(!expanded);
    };

    const getCurrentStepIndex = (step: string) => {
        if (step === 'saving_accounts') return 1;
        const idx = STEPS.findIndex(s => s.key === step);
        return idx === -1 ? (step === 'done' ? STEPS.length : -1) : idx;
    };

    const currentStepIndex = getCurrentStepIndex(syncStatus.step);
    const showSyncBanner = isSyncing || syncStatus.step === 'done';

    const renderHeaderSyncStatus = () => {
        const isDone = syncStatus.step === 'done' || currentStepIndex >= STEPS.length;
        const currentLabel = syncStatus.message || STEPS[currentStepIndex]?.label || 'Sincronizando...';

        return (
            <Animated.View
                key={`sync-status-${syncStatus.step}`}
                entering={FadeIn.duration(300)}
                style={styles.syncStatusHeader}
            >
                {isDone ? (
                    <Animated.View entering={FadeIn} style={styles.labelWrapper}>
                        <CheckCircle size={14} color="#04D361" />
                        <DynamicText
                            items={[{ text: 'Sincronização concluída', id: 'done' }]}
                            loop={false}
                            initialIndex={0}
                            timing={{ interval: 2000, animationDuration: 350 }}
                            dot={{
                                visible: false,
                                size: 6,
                                color: '#04D361',
                            }}
                            text={{
                                fontSize: 13,
                                color: '#04D361',
                                fontWeight: '600',
                            }}
                            animationPreset="fade"
                            animationDirection="up"
                        />
                    </Animated.View>
                ) : (
                    <View style={styles.labelWrapper}>
                        <DynamicText
                            key={`sync-step-${syncStatus.step}`}
                            items={[{ text: currentLabel, id: syncStatus.step }]}
                            loop={false}
                            initialIndex={0}
                            timing={{ interval: 2000, animationDuration: 350 }}
                            dot={{
                                visible: true,
                                size: 6,
                                color: '#D97757',
                                style: { marginRight: 4 },
                            }}
                            text={{
                                fontSize: 13,
                                color: '#E0E0E0',
                                fontWeight: '500',
                            }}
                            animationPreset="fade"
                            animationDirection="up"
                        />
                    </View>
                )}
            </Animated.View>
        );
    };

    return (
        <View style={styles.connectedBankCard}>
            <TouchableOpacity
                style={styles.connectedBankHeader}
                onPress={isSyncing ? undefined : toggleExpand}
                activeOpacity={isSyncing ? 1 : 0.7}
            >
                <View style={styles.bankHeaderLeft}>
                    <BankConnectorLogo
                        connector={group.connector}
                        size={34}
                        borderRadius={10}
                        iconSize={16}
                        borderColor="#2A2A2A"
                        containerStyle={styles.connectorLogoContainer}
                    />
                    <View style={styles.headerInfo}>
                        <Text style={styles.connectorName}>
                            {group.connector?.name || 'Instituição'}
                        </Text>
                        <Text style={styles.accountCount}>
                            {group.accounts.length} {group.accounts.length === 1 ? 'conta conectada' : 'contas conectadas'}
                        </Text>
                    </View>
                </View>

                <View style={styles.bankHeaderRight}>
                    {showSyncBanner ? (
                        renderHeaderSyncStatus()
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onDelete(group);
                                }}
                                style={styles.deleteButtonHeader}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <IntervalLottie source={require('../../assets/lixeira.json')} size={16} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSync}
                                style={[
                                    styles.syncButton,
                                    syncStatus.step === 'done' && styles.syncButtonSuccess,
                                    syncStatus.step === 'error' && styles.syncButtonError,
                                    isSyncDisabled && styles.syncButtonDisabled,
                                    !canSyncThisBank && styles.syncButtonTimer
                                ]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                disabled={isSyncDisabled && syncStatus.step === 'idle'}
                            >
                                {syncStatus.step === 'done' ? (
                                    <Text style={[styles.syncButtonText, { color: '#04D361' }]}>Concluído</Text>
                                ) : syncStatus.step === 'error' ? (
                                    <Text style={[styles.syncButtonText, { color: '#EF4444' }]}>Erro</Text>
                                ) : !canSyncThisBank && timeUntilReset ? (
                                    <View style={styles.timerContainer}>
                                        <Lock size={12} color="#FFFFFF" />
                                        <FlipTimer timeString={timeUntilReset} />
                                    </View>
                                ) : isSyncDisabled ? (
                                    <Lock size={16} color="#FFFFFF" />
                                ) : (
                                    <IntervalLottie source={require('../../assets/sincronizar.json')} size={16} />
                                )}
                            </TouchableOpacity>

                            <View style={styles.chevronContainer}>
                                <Animated.View style={animatedChevronStyle}>
                                    <IntervalLottie source={require('../../assets/cima.json')} size={16} />
                                </Animated.View>
                            </View>
                        </>
                    )}
                </View>
            </TouchableOpacity>

            {isSyncing ? (
                <View style={{ paddingBottom: 0 }} />
            ) : (
                expanded && (
                    <View style={styles.connectedBankBody}>
                        {/* Header/Content Separator */}
                        <View style={styles.headerSeparator} />

                        {/* Flat Accounts List */}
                        <View style={styles.accountsGroup}>
                            {group.accounts.map((acc: any, i: number) => {
                                const isCredit = acc.type === 'CREDIT' || acc.type === 'credit' || acc.type === 'CREDIT_CARD' || acc.subtype === 'CREDIT_CARD';
                                const defaultName = isCredit ? 'Cartão de Crédito' : 'Conta Corrente';
                                const accountName = (acc.name && acc.name !== group.connector?.name)
                                    ? acc.name
                                    : defaultName;

                                const value = isCredit ? acc.creditLimit : acc.balance;
                                const label = isCredit ? 'Limite Total' : 'Saldo Disponível';
                                const formattedValue = value !== null && value !== undefined
                                    ? formatCurrency(value)
                                    : '---';

                                // Visibility Logic
                                const isVisible = !(hiddenAccountIds || []).includes(acc.id);

                                return (
                                    <View key={acc.id} style={styles.accountRowContainer}>
                                        <View style={styles.accountRow}>
                                            <View style={styles.accountIconContainer}>
                                                <View style={[
                                                    styles.accountIconWrapper,
                                                    isCredit ? styles.creditIconBg : styles.debitIconBg
                                                ]}>
                                                    {isCredit ?
                                                        <IntervalLottie source={require('../../assets/cartao.json')} size={20} interval={4500} /> :
                                                        <IntervalLottie source={require('../../assets/carteira.json')} size={20} interval={4500} />
                                                    }
                                                </View>
                                            </View>

                                            <View style={styles.accountMainInfo}>
                                                <Text style={styles.accountName} numberOfLines={1}>{accountName}</Text>
                                                <Text style={styles.accountNumber}>
                                                    {acc.number ? `"""" ${acc.number.slice(-4)}` : '""""'}
                                                </Text>
                                            </View>

                                            <View style={styles.accountBalanceInfo}>
                                                <Text style={[
                                                    styles.accountValue,
                                                    !isCredit && (value > 0 ? styles.positiveValue : value < 0 ? styles.negativeValue : {})
                                                ]}>
                                                    {formattedValue}
                                                </Text>
                                                <Text style={styles.accountLabel}>{label}</Text>
                                            </View>

                                            {/* Visibility Toggle for Checking Accounts */}
                                            {!isCredit && onToggleVisibility && (
                                                <TouchableOpacity
                                                    style={styles.visibilityButton}
                                                    onPress={() => onToggleVisibility(acc.id)}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    {isVisible ? (
                                                        <Eye size={18} color="#666" />
                                                    ) : (
                                                        <EyeOff size={18} color="#D97757" />
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Separator - show only if NOT the last item */}
                                        {i < group.accounts.length - 1 && <View style={styles.accountSeparator} />}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    connectedBankCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    connectedBankHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#1A1A1A',
        minHeight: 56,
    },
    bankHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    headerInfo: {
        flex: 1,
    },
    accountCount: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    bankHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    connectorLogoContainer: {
        flexShrink: 0,
    },
    connectorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    connectedBankBody: {
        backgroundColor: '#1A1A1A',
        paddingTop: 0,
    },
    headerSeparator: {
        height: 1,
        backgroundColor: '#2A2A2A',
        width: '100%',
    },
    accountsGroup: {
        marginTop: 12,
        marginBottom: 12,
        marginHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#262626',
        overflow: 'hidden',
    },
    accountRowContainer: {
        position: 'relative',
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'transparent',
    },
    accountSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#262626',
    },
    accountIconContainer: {
        marginRight: 10,
    },
    accountIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    creditIconBg: {
        backgroundColor: 'rgba(217, 119, 87, 0.15)',
    },
    debitIconBg: {
        backgroundColor: 'rgba(4, 211, 97, 0.15)',
    },
    accountMainInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 8,
    },
    accountName: {
        fontSize: 14,
        color: '#FFF',
        fontWeight: '500',
        marginBottom: 2,
    },
    accountNumber: {
        fontSize: 11,
        color: '#666',
        fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    },
    accountBalanceInfo: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    accountValue: {
        fontSize: 14,
        color: '#FFF',
        fontWeight: '600',
        marginBottom: 2,
    },
    accountLabel: {
        fontSize: 9,
        color: '#888',
        textTransform: 'uppercase',
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    positiveValue: {
        color: '#04D361',
    },
    negativeValue: {
        color: '#EF4444',
    },
    visibilityButton: {
        marginLeft: 12,
        padding: 4,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    syncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 0,
        paddingHorizontal: 8,
        backgroundColor: 'transparent',
        borderRadius: 8,
        height: 32,
        minWidth: 32,
    },
    disconnectButton: {
        backgroundColor: 'transparent',
        marginRight: -4,
    },
    syncButtonSuccess: {
        backgroundColor: 'rgba(4, 211, 97, 0.1)',
    },
    syncButtonError: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    syncButtonDisabled: {
        opacity: 0.5,
    },
    syncButtonTimer: {
        backgroundColor: '#222',
    },
    syncButtonText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    syncContainer: {
        paddingTop: 16,
        paddingBottom: 8,
        paddingHorizontal: 16,
        position: 'relative'
    },
    syncLine: {
        position: 'absolute',
        left: 27,
        top: 38,
        bottom: 30,
        width: 2,
        backgroundColor: '#262626',
        borderRadius: 1,
        zIndex: 0
    },
    activeBall: {
        position: 'absolute',
        left: 24,
        top: 34,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D97757',
        zIndex: 10,
        shadowColor: '#D97757',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        zIndex: 1
    },
    stepDotContainer: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        zIndex: 2,
        backgroundColor: '#111111'
    },
    stepCompletedDot: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepPendingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#333',
    },
    stepTextActive: {
        color: '#E0E0E0',
        fontSize: 13.5,
        fontWeight: '500'
    },
    stepText: {
        fontSize: 13.5,
    },
    stepTextCompleted: {
        color: '#666',
        fontWeight: '400'
    },
    stepTextPending: {
        color: '#444',
        fontWeight: '400'
    },
    timerText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    flipTimerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timerDigit: {
        fontSize: 12,
        fontWeight: '600',
        color: '#888',
        fontVariant: ['tabular-nums'],
        width: 8,
        textAlign: 'center',
    },
    digitContainer: {
        overflow: 'hidden',
        height: 16,
        width: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    digitAbsolute: {
        position: 'absolute',
    },
    timerColon: {
        fontSize: 12,
        color: '#888',
        marginHorizontal: 1,
    },
    morphButton: {
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        borderWidth: 1,
    },
    morphIconContainer: {
        width: 36,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    morphContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 8,
    },
    morphConfirmBtn: {
        flex: 1,
        justifyContent: 'center',
    },
    morphConfirmText: {
        color: '#EF4444',
        fontSize: 12,
        fontWeight: '600',
    },
    morphDivider: {
        width: 1,
        height: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 8,
    },
    morphCancelBtn: {
        padding: 4,
    },
    syncContainerHorizontal: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
        borderRadius: 8,
        marginHorizontal: 16,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    labelWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    successLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(4, 211, 97, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    hLabelText: {
        fontSize: 12,
        color: '#E0E0E0',
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    deleteButtonHeader: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chevronContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    syncStatusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
    }
});

// Animated digit component for flip clock effect
function AnimatedDigit({ digit, style }: { digit: string; style?: any }) {
    const [currentDigit, setCurrentDigit] = useState(digit);
    const [previousDigit, setPreviousDigit] = useState(digit);
    const flipAnim = useSharedValue(0);

    useEffect(() => {
        if (digit !== currentDigit) {
            setPreviousDigit(currentDigit);
            flipAnim.value = 0;
            flipAnim.value = withTiming(1, { duration: 300 });
            setCurrentDigit(digit);
        }
    }, [digit]);

    const exitStyle = useAnimatedStyle(() => ({
        opacity: interpolate(flipAnim.value, [0, 0.5], [1, 0], Extrapolate.CLAMP),
        transform: [
            { translateY: interpolate(flipAnim.value, [0, 0.5], [0, -8], Extrapolate.CLAMP) },
        ],
    }));

    const enterStyle = useAnimatedStyle(() => ({
        opacity: interpolate(flipAnim.value, [0.5, 1], [0, 1], Extrapolate.CLAMP),
        transform: [
            { translateY: interpolate(flipAnim.value, [0.5, 1], [8, 0], Extrapolate.CLAMP) },
        ],
    }));

    return (
        <View style={styles.digitContainer}>
            <Animated.Text style={[style, exitStyle, styles.digitAbsolute]}>
                {previousDigit}
            </Animated.Text>
            <Animated.Text style={[style, enterStyle]}>
                {currentDigit}
            </Animated.Text>
        </View>
    );
};

function FlipTimer({ timeString }: { timeString: string }) {
    const parts = timeString.split(':');
    if (parts.length !== 3) return <Text style={styles.timerText}>{timeString}</Text>;

    const [hours, minutes, seconds] = parts;

    return (
        <View style={styles.flipTimerContainer}>
            <AnimatedDigit digit={hours[0]} style={styles.timerDigit} />
            <AnimatedDigit digit={hours[1]} style={styles.timerDigit} />
            <Text style={styles.timerColon}>:</Text>
            <AnimatedDigit digit={minutes[0]} style={styles.timerDigit} />
            <AnimatedDigit digit={minutes[1]} style={styles.timerDigit} />
            <Text style={styles.timerColon}>:</Text>
            <AnimatedDigit digit={seconds[0]} style={styles.timerDigit} />
            <AnimatedDigit digit={seconds[1]} style={styles.timerDigit} />
        </View>
    );
};


