import { InvestmentDetailsModal } from '@/components/InvestmentDetailsModal';
import { InvestmentModal } from '@/components/InvestmentModal';
import { InvestmentStatementModal } from '@/components/InvestmentStatementModal';
import { OfflineWarningCard } from '@/components/OfflineWarningCard';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { databaseService } from '@/services/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { ArrowRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-gesture-handler'; // Ensure TextInput is available or use standard RN
import Animated, { Easing, FadeInUp, runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);


const IntervalLottie = ({ source, size, interval = 5000 }: { source: any, size: number, interval?: number }) => {
    return (
        <DelayedLoopLottie
            source={source}
            style={{ width: size, height: size }}
            delay={interval}
            initialDelay={100}
            jitterRatio={0.15}
        />
    );
};

interface Investment {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    color: string;
    icon: string;
    deadline?: string;
    createdAt: string;
    // Campos de sincronização (poupança Pluggy)
    source?: string;
    pluggyAccountId?: string;
    connector?: {
        id: number;
        name: string;
        primaryColor?: string;
        imageUrl?: string;
    };
    lastSyncedAt?: string;
}

const HoldDeletePill = ({ visible, onComplete }: { visible: boolean; onComplete: () => void }) => {
    const progress = useSharedValue(0);
    const visualProgress = useSharedValue(0);

    // Reset or Start Animation when visibility changes
    useEffect(() => {
        if (visible) {
            // 1. Kick off master progress (0 -> 1 in 5s)
            progress.value = withTiming(1, { duration: 5000, easing: Easing.linear }, (finished) => {
                if (finished) {
                    runOnJS(onComplete)();
                }
            });
            // 2. Kick off first visual chunk immediately (0 -> 20% in 0.5s)
            visualProgress.value = withTiming(20, { duration: 500, easing: Easing.out(Easing.quad) });
        } else {
            // Reset immediately
            progress.value = 0;
            visualProgress.value = 0;
        }
    }, [visible]);

    // Calculate step (0 to 5) based on progress
    const stepIndex = useDerivedValue(() => {
        return Math.floor(progress.value * 5);
    });

    // React to step changes to animate NEXT visual chunk
    useAnimatedReaction(
        () => stepIndex.value,
        (currentStep: number, previousStep: number | null) => {
            if (currentStep !== previousStep && currentStep > 0) {
                // When entering step 1 (1s elapsed), we want to go from 20->40
                // Target = (step + 1) * 20.
                // Step 1 -> 40. Step 2 -> 60. Step 4 -> 100.
                const target = (currentStep + 1) * 20;
                visualProgress.value = withTiming(target, { duration: 500, easing: Easing.out(Easing.quad) });
            }
        },
        [visible]
    );

    const progressStyle = useAnimatedStyle(() => ({
        width: `${visualProgress.value}%`,
    }));

    const animatedProps = useAnimatedProps(() => {
        // Countdown from 5 to 0
        // Sincronized with step: 5 - stepIndex
        const count = Math.max(0, 5 - stepIndex.value);
        return {
            text: `${count}`,
        } as any;
    });

    if (!visible) return null;

    return (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.holdPillContainer}>
            <View style={styles.holdPill}>
                {/* Progress Fill */}
                <Animated.View style={[styles.holdPillFill, progressStyle]} />

                {/* Text & Countdown */}
                <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 1, gap: 6 }}>
                    <Text style={styles.holdPillText}>Segure</Text>
                    <AnimatedTextInput
                        underlineColorAndroid="transparent"
                        editable={false}
                        value="5"
                        style={styles.holdPillTimer}
                        animatedProps={animatedProps}
                    />
                </View>
            </View>
        </Animated.View>
    );
};

const InvestmentCard = React.memo(({ item, index, onPress, onHoldStart, onHoldEnd }: {
    item: Investment,
    index: number,
    onPress: () => void,
    onHoldStart: () => void,
    onHoldEnd: () => void
}) => {
    const percentage = item.targetAmount > 0
        ? Math.min((item.currentAmount / item.targetAmount) * 100, 100)
        : 0;

    // Calculate progress color based on percentage
    let progressColor = '#FF4C4C';
    if (percentage > 70) {
        progressColor = '#04D361';
    } else if (percentage > 30) {
        progressColor = '#FFB800';
    }

    // Press Animation
    const scale = useSharedValue(1);

    const handlePressIn = () => {
        // No animation on simple press
    };

    const handleLongPress = () => {
        scale.value = withSpring(0.95);
        onHoldStart();
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
        onHoldEnd();
    };

    const animatedCardStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }]
        };
    });

    return (
        <Animated.View
            entering={FadeInUp.delay(index * 100).springify()}
            style={[styles.cardContainer, animatedCardStyle]}
        >
            <Pressable
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onLongPress={handleLongPress}
                delayLongPress={200} // Only trigger hold start after 200ms
                hitSlop={8}
                style={({ pressed }) => [
                    styles.cardContent,
                    { opacity: pressed ? 0.9 : 1 }
                ]}
            >
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.01)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />

                {/* Header: Icon + Name */}
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }]} pointerEvents="none">
                        <IntervalLottie
                            source={require('../../assets/caixinhasamarelo.json')}
                            size={24}
                            interval={5000}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        {item.source === 'pluggy' ? (
                            <View style={styles.openFinancePill}>
                                <Text style={styles.openFinancePillText}>Poupança • Conta Bancária</Text>
                            </View>
                        ) : (
                            <Text style={styles.cardSubtitle}>
                                {item.deadline
                                    ? `Meta: ${new Date(item.deadline).toLocaleDateString('pt-BR')}`
                                    : 'Sem prazo definido'}
                            </Text>
                        )}
                    </View>
                    <ArrowRight size={20} color="#505050" />
                </View>

                {/* Amounts */}
                {item.source === 'pluggy' ? (
                    // Layout simplificado para poupança sincronizada
                    <View style={styles.amountContainer}>
                        <View>
                            <Text style={styles.amountLabel}>Saldo Poupança</Text>
                            <Text style={[styles.currentAmount, { color: '#04D361' }]}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.currentAmount)}
                            </Text>
                        </View>
                        {item.lastSyncedAt && (
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.amountLabel}>Última Sync</Text>
                                <Text style={styles.targetAmount}>
                                    {new Date(item.lastSyncedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        )}
                    </View>
                ) : (
                    // Layout original para caixinhas manuais
                    <>
                        <View style={styles.amountContainer}>
                            <View>
                                <Text style={styles.amountLabel}>Guardado</Text>
                                <Text style={styles.currentAmount}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.currentAmount)}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.amountLabel}>Meta</Text>
                                <Text style={styles.targetAmount}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.targetAmount)}
                                </Text>
                            </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressTextLeft}>{Math.round(percentage)}% concluído</Text>
                                <Text style={styles.progressTextRight}>
                                    Falta {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, item.targetAmount - item.currentAmount))}
                                </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { width: `${percentage}%`, backgroundColor: progressColor }
                                    ]}
                                />
                            </View>
                        </View>
                    </>
                )}
            </Pressable>
        </Animated.View>
    );
});

export default function PlanningScreen() {
    const { user } = useAuthContext();
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);
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
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [statementModalVisible, setStatementModalVisible] = useState(false);
    const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);

    // Delete Confirmation State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);

    // Hold Interaction State
    const [holdingItem, setHoldingItem] = useState<Investment | null>(null);
    const ignorePressRef = useRef(false);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = databaseService.onInvestmentsChange(user.uid, (data) => {
            setInvestments(data as Investment[]);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleCreateInvestment = async (data: { name: string; targetAmount: number; deadline?: string }) => {
        if (!user) return;

        await databaseService.addInvestment(user.uid, {
            name: data.name,
            targetAmount: data.targetAmount,
            currentAmount: 0,
            deadline: data.deadline,
            color: '#D97757', // Default color
            icon: 'caixinhasamarelo.json' // Default icon ref
        });

        setCreateModalVisible(false);
    };

    const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw') => {
        if (!user || !selectedInvestment) return;

        const newAmount = type === 'deposit'
            ? selectedInvestment.currentAmount + amount
            : selectedInvestment.currentAmount - amount;

        // 1. Update Balance
        await databaseService.updateInvestment(user.uid, selectedInvestment.id, {
            currentAmount: newAmount
        });

        // 2. Add Transaction History
        await databaseService.addInvestmentTransaction(user.uid, selectedInvestment.id, {
            amount: amount,
            type: type,
            date: new Date().toISOString()
        });

        setDetailsModalVisible(false);
        setSelectedInvestment(null);
    };

    const handleRequestDelete = (investment: Investment) => {
        setInvestmentToDelete(investment);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!user || !investmentToDelete) return;

        // Close modal
        setDeleteModalVisible(false);

        await databaseService.deleteInvestment(user.uid, investmentToDelete.id);

        // Also close details modal if it's open (e.g. if deleted from details)
        if (detailsModalVisible) {
            setDetailsModalVisible(false);
        }

        setSelectedInvestment(null);
        setInvestmentToDelete(null);
    };

    const handleEditInvestment = async (data: { name: string; targetAmount: number; deadline?: string }) => {
        if (!user || !selectedInvestment) return;

        await databaseService.updateInvestment(user.uid, selectedInvestment.id, {
            name: data.name,
            targetAmount: data.targetAmount,
            deadline: data.deadline || null
        });

        setEditModalVisible(false);
        setSelectedInvestment(null);
    };

    const openDetails = (investment: Investment) => {
        if (ignorePressRef.current) {
            ignorePressRef.current = false;
            return;
        }
        setSelectedInvestment(investment);
        setDetailsModalVisible(true);
    };

    return (
        <View style={styles.mainContainer}>
            <View pointerEvents="none">
                <UniversalBackground
                    backgroundColor="#0C0C0C"
                    glowSize={350}
                    height={280}
                    showParticles={true}
                    particleCount={15}
                />
            </View>

            <View style={styles.contentWrapper}>
                {/* Header Fixo */}
                <View style={styles.header}>
                    <Text style={styles.title}>Caixinhas</Text>

                    <TouchableOpacity
                        style={styles.headerButton}
                        activeOpacity={0.7}
                        onPress={() => setCreateModalVisible(true)}
                    >
                        <IntervalLottie source={require('../../assets/adicionar.json')} size={18} interval={4000} />
                        <Text style={styles.headerButtonText}>Criar</Text>
                    </TouchableOpacity>
                </View>

                <OfflineWarningCard style={{ marginHorizontal: 20, marginBottom: 8 }} />

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <LottieView
                            source={require('@/assets/carregando.json')}
                            autoPlay
                            loop
                            style={{ width: 50, height: 50 }}
                        />
                        <Text style={styles.loadingText}>Carregando suas caixinhas{loadingDots}</Text>
                    </View>
                ) : investments.length > 0 ? (
                    <FlatList
                        data={investments}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item, index }) => (
                            <InvestmentCard
                                item={item}
                                index={index}
                                onPress={() => openDetails(item)}
                                onHoldStart={() => {
                                    ignorePressRef.current = false;
                                    setHoldingItem(item);
                                }}
                                onHoldEnd={() => setHoldingItem(null)}
                            />
                        )}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <ScrollView
                        style={styles.container}
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Empty State */}
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconWrapper}>
                                <IntervalLottie
                                    source={require('../../assets/caixinhas.json')}
                                    size={120}
                                    interval={5000}
                                />
                            </View>

                            <Text style={styles.emptyTitle}>
                                Nenhuma caixinha
                            </Text>

                            <Text style={styles.emptyText}>
                                Crie caixinhas para organizar seus objetivos financeiros e sonhos.
                            </Text>

                            <TouchableOpacity
                                style={styles.emptyButton}
                                activeOpacity={0.8}
                                onPress={() => setCreateModalVisible(true)}
                            >
                                <IntervalLottie source={require('../../assets/adicionar.json')} size={20} interval={4000} />
                                <Text style={styles.emptyButtonText}>
                                    Nova Caixinha
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                )}
            </View>

            <HoldDeletePill
                visible={!!holdingItem}
                onComplete={() => {
                    if (holdingItem) {
                        ignorePressRef.current = true;
                        handleRequestDelete(holdingItem);
                    }
                }}
            />

            <DeleteConfirmationModal
                visible={deleteModalVisible}
                onCancel={() => setDeleteModalVisible(false)}
                onConfirm={handleConfirmDelete}
                title={`Excluir ${investmentToDelete?.name}?`}
                confirmText="Excluir"
                cancelText="Cancelar"
            />

            <InvestmentModal
                visible={createModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onSave={handleCreateInvestment}
            />

            {selectedInvestment && (
                <InvestmentDetailsModal
                    visible={detailsModalVisible}
                    onClose={() => {
                        setDetailsModalVisible(false);
                        // Limpar selectedInvestment após a animação de fechamento
                        setTimeout(() => setSelectedInvestment(null), 350);
                    }}
                    onSaveMovement={handleUpdateBalance}
                    onDeleteRequest={() => {
                        // Close details modal first
                        setDetailsModalVisible(false);
                        // Open delete confirmation manually
                        handleRequestDelete(selectedInvestment);
                    }}
                    onEditRequest={() => {
                        setDetailsModalVisible(false);
                        setTimeout(() => {
                            setEditModalVisible(true);
                        }, 300);
                    }}
                    onExtractRequest={() => {
                        setDetailsModalVisible(false);
                        setTimeout(() => {
                            setStatementModalVisible(true);
                        }, 300);
                    }}
                    investmentName={selectedInvestment.name}
                    currentAmount={selectedInvestment.currentAmount}
                />
            )}

            {selectedInvestment && (
                <InvestmentStatementModal
                    visible={statementModalVisible}
                    onClose={() => {
                        setStatementModalVisible(false);
                        setSelectedInvestment(null);
                    }}
                    investmentId={selectedInvestment.id}
                    investmentName={selectedInvestment.name}
                />
            )}

            {/* Modal de Edição */}
            {selectedInvestment && (
                <InvestmentModal
                    visible={editModalVisible}
                    onClose={() => {
                        setEditModalVisible(false);
                        setSelectedInvestment(null);
                    }}
                    onSave={handleEditInvestment}
                    title="Editar Caixinha"
                    initialData={{
                        name: selectedInvestment.name,
                        targetAmount: selectedInvestment.targetAmount,
                        deadline: selectedInvestment.deadline
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    contentWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    listContainer: {
        paddingTop: 0,
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#888',
        fontSize: 14,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        zIndex: 10,
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
    // Card Styles
    cardContainer: {
        marginBottom: 16,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: '#141414',
    },
    cardContent: {
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#D97757',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#909090',
    },
    amountContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    amountLabel: {
        fontSize: 12,
        color: '#909090',
        marginBottom: 4,
    },
    currentAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    targetAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#909090',
    },
    progressContainer: {
        marginTop: 4,
        gap: 6,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressTextLeft: {
        fontSize: 10,
        color: '#909090',
        fontWeight: '500',
    },
    progressTextRight: {
        fontSize: 10,
        color: '#909090',
        fontWeight: '500',
    },
    progressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    // Empty State Styles
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    emptyIconWrapper: {
        marginBottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFF',
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: '#888',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    emptyButton: {
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
    emptyButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    // Open Finance Pill Styles
    openFinancePill: {
        backgroundColor: 'rgba(4, 211, 97, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(4, 211, 97, 0.3)',
    },
    openFinancePillText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#04D361',
        letterSpacing: 0.3,
    },
    // Hold Pill Styles
    holdPillContainer: {
        position: 'absolute',
        top: 110,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        elevation: 50,
    },
    holdPill: {
        backgroundColor: '#1E1E1E',
        borderRadius: 14,
        height: 28, // Ultra compact
        width: 120, // Very small width
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    holdPillFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#FF4C4C',
        zIndex: 0,
        borderRadius: 14, // Match parent
    },
    holdPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        zIndex: 1,
    },
    holdPillTimer: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        padding: 0,
        margin: 0,
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
});
