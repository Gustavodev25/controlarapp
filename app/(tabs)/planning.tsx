import { InvestmentDetailsModal } from '@/components/InvestmentDetailsModal';
import { InvestmentModal } from '@/components/InvestmentModal';
import { InvestmentStatementModal } from '@/components/InvestmentStatementModal';

import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { UniversalBackground } from '@/components/UniversalBackground';
import { MorphTouchable } from '@/components/ui/MorphTouchable';
import { useAuthContext } from '@/contexts/AuthContext';
import { databaseService } from '@/services/firebase';
import { MoreVertical, Plus } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Easing as RNEasing, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-gesture-handler'; // Ensure TextInput is available or use standard RN
import Animated, { Easing, FadeInUp, runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const HEADER_CONTROL_HEIGHT = 36;


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

const InvestmentActionDropdown = ({
    visible,
    onExtract,
    onMove,
    onEdit,
    onDelete,
}: {
    visible: boolean;
    onExtract: () => void;
    onMove: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) => {
    const sheetOpacity = useRef(new NativeAnimated.Value(0)).current;
    const sheetScaleX = useRef(new NativeAnimated.Value(0.955)).current;
    const sheetScaleY = useRef(new NativeAnimated.Value(0.935)).current;
    const sheetY = useRef(new NativeAnimated.Value(-10)).current;
    const contentOpacity = useRef(new NativeAnimated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            sheetOpacity.setValue(0);
            sheetScaleX.setValue(0.955);
            sheetScaleY.setValue(0.935);
            sheetY.setValue(-10);
            contentOpacity.setValue(0);

            NativeAnimated.parallel([
                NativeAnimated.timing(sheetOpacity, { toValue: 1, duration: 170, easing: RNEasing.out(RNEasing.quad), useNativeDriver: false }),
                NativeAnimated.spring(sheetY, { toValue: 0, damping: 18, stiffness: 235, mass: 0.78, useNativeDriver: false }),
                NativeAnimated.sequence([
                    NativeAnimated.timing(sheetScaleX, { toValue: 1.018, duration: 165, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: false }),
                    NativeAnimated.spring(sheetScaleX, { toValue: 1, damping: 13, stiffness: 190, mass: 0.62, useNativeDriver: false }),
                ]),
                NativeAnimated.sequence([
                    NativeAnimated.timing(sheetScaleY, { toValue: 1.012, duration: 185, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: false }),
                    NativeAnimated.spring(sheetScaleY, { toValue: 1, damping: 13, stiffness: 185, mass: 0.62, useNativeDriver: false }),
                ]),
                NativeAnimated.timing(contentOpacity, { toValue: 1, duration: 260, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: false }),
            ]).start();
        } else {
            NativeAnimated.parallel([
                NativeAnimated.timing(sheetOpacity, { toValue: 0, duration: 130, easing: RNEasing.out(RNEasing.quad), useNativeDriver: false }),
                NativeAnimated.timing(contentOpacity, { toValue: 0, duration: 110, easing: RNEasing.out(RNEasing.quad), useNativeDriver: false }),
                NativeAnimated.timing(sheetScaleX, { toValue: 0.955, duration: 170, easing: RNEasing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }),
                NativeAnimated.timing(sheetScaleY, { toValue: 0.935, duration: 180, easing: RNEasing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }),
                NativeAnimated.timing(sheetY, { toValue: -10, duration: 180, easing: RNEasing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }),
            ]).start();
        }
    }, [visible]);

    return (
        <NativeAnimated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[
                styles.investmentDropdown,
                {
                    opacity: sheetOpacity,
                    transform: [
                        { translateY: sheetY },
                        { scaleX: sheetScaleX },
                        { scaleY: sheetScaleY },
                    ],
                },
            ]}
        >
            <BlurView
                intensity={16}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={{ width: '100%' }}
            >
                <View style={styles.investmentDropdownOverlay} />
                <NativeAnimated.View style={[styles.investmentDropdownContent, { opacity: contentOpacity }]}>
                    <MorphTouchable radius={12} style={styles.investmentDropdownItem} onPress={onExtract}>
                        <Text style={styles.investmentDropdownText}>Extrato</Text>
                    </MorphTouchable>
                    <View style={styles.investmentDropdownDivider} />
                    <MorphTouchable radius={12} style={styles.investmentDropdownItem} onPress={onMove}>
                        <Text style={styles.investmentDropdownText}>Movimentar</Text>
                    </MorphTouchable>
                    <View style={styles.investmentDropdownDivider} />
                    <MorphTouchable radius={12} style={styles.investmentDropdownItem} onPress={onEdit}>
                        <Text style={styles.investmentDropdownText}>Editar</Text>
                    </MorphTouchable>
                    <View style={styles.investmentDropdownDivider} />
                    <MorphTouchable radius={12} style={styles.investmentDropdownItem} onPress={onDelete}>
                        <Text style={styles.investmentDropdownTextDestructive}>Excluir</Text>
                    </MorphTouchable>
                </NativeAnimated.View>
            </BlurView>
        </NativeAnimated.View>
    );
};

const InvestmentCard = React.memo(({ item, index, isMenuOpen, onToggleMenu, onCloseMenu, onExtract, onMove, onEdit, onDelete, onHoldStart, onHoldEnd }: {
    item: Investment,
    index: number,
    isMenuOpen: boolean,
    onToggleMenu: () => void,
    onCloseMenu: () => void,
    onExtract: () => void,
    onMove: () => void,
    onEdit: () => void,
    onDelete: () => void,
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
            style={[animatedCardStyle, { marginBottom: 10 }]}
        >
            <MorphTouchable
                radius={16}
                onPress={onCloseMenu}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onLongPress={handleLongPress}
                delayLongPress={200}
                hitSlop={8}
                style={[styles.cardContainer, styles.cardContent]}
            >
                {/* Header: Name + Menu (zIndex 20 para o dropdown flutuar acima do conteúdo abaixo) */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {item.name.includes(' • ') ? (
                                <>
                                    {item.name.split(' • ')[0]}
                                    <Text style={styles.accountNumberText}> • {item.name.split(' • ')[1]}</Text>
                                </>
                            ) : (
                                item.name
                            )}
                        </Text>
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
                    <MorphTouchable radius={13} style={styles.cardMenuButton} onPress={onToggleMenu}>
                        <MoreVertical size={16} color="#A1A1A6" strokeWidth={2.4} />
                    </MorphTouchable>
                </View>

                <InvestmentActionDropdown
                    visible={isMenuOpen}
                    onExtract={() => { onCloseMenu(); onExtract(); }}
                    onMove={() => { onCloseMenu(); onMove(); }}
                    onEdit={() => { onCloseMenu(); onEdit(); }}
                    onDelete={() => { onCloseMenu(); onDelete(); }}
                />

                {/* Amounts */}
                <View style={styles.amountContainer}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.amountLabel}>{item.source === 'pluggy' ? 'Saldo Poupança' : 'Guardado'}</Text>
                        <Text style={[styles.currentAmount, item.source === 'pluggy' && { color: '#04D361' }]} numberOfLines={1} adjustsFontSizeToFit>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.currentAmount)}
                        </Text>
                    </View>
                    <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>
                        <Text style={styles.amountLabel}>Meta</Text>
                        <Text style={[styles.targetAmount, { textAlign: 'right' }]} numberOfLines={1}>
                            {item.targetAmount > 0
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.targetAmount)
                                : 'Sem meta'}
                        </Text>
                    </View>
                </View>

                {/* Footer: Progress Bar or Sync Info */}
                {item.source === 'pluggy' ? (
                    item.lastSyncedAt && (
                        <View style={{ marginTop: 4, borderTopWidth: 1, borderTopColor: '#252525', paddingTop: 8, marginHorizontal: -12, paddingHorizontal: 12 }}>
                            <Text style={[styles.amountLabel, { fontSize: 10, marginBottom: 0, textAlign: 'right' }]}>
                                Última atualização em {new Date(item.lastSyncedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    )
                ) : (
                    item.targetAmount > 0 && (
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
                    )
                )}
            </MorphTouchable>
        </Animated.View>
    );
});

InvestmentCard.displayName = 'InvestmentCard';

export default function PlanningScreen() {
    const { user } = useAuthContext();
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [detailsInitialView, setDetailsInitialView] = useState<'menu' | 'movement'>('menu');
    const [statementModalVisible, setStatementModalVisible] = useState(false);
    const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);

    // Delete Confirmation State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);

    // Hold Interaction State
    const [holdingItem, setHoldingItem] = useState<Investment | null>(null);
    const ignorePressRef = useRef(false);

    // Action menu (dropdown) state — lifted up so the open card can render above siblings
    const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = databaseService.onInvestmentsChange(user.uid, (data) => {
            setInvestments(data as Investment[]);
            setLoading(false);
        });

        // Trigger the migration logic inside getInvestments to sweep for missing connected accounts
        databaseService.getInvestments(user.uid).catch(console.error);

        return () => unsubscribe();
    }, [user]);

    const [isSaving, setIsSaving] = useState(false);

    const handleCreateInvestment = async (data: { name: string; targetAmount: number; deadline?: string }) => {
        if (!user || isSaving) return;

        setIsSaving(true);
        try {
            const result = await databaseService.addInvestment(user.uid, {
                name: data.name,
                targetAmount: data.targetAmount,
                currentAmount: 0.01, // Começa com 0.01 para ser visível no filtro de "apenas com movimentação"
                deadline: data.deadline,
                color: '#D97757', // Default color
                icon: 'caixinhasamarelo.json' // Default icon ref
            });

            if (result.success && result.id) {
                // Registrar essa pequena movimentação inicial
                await databaseService.addInvestmentTransaction(user.uid, result.id, {
                    amount: 0.01,
                    type: 'deposit',
                    date: new Date().toISOString(),
                });
            }

            setCreateModalVisible(false);
        } catch (error) {
            console.error('[Planning] Error creating investment:', error);
        } finally {
            setIsSaving(false);
        }
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

        // 2. Add Transaction History (subcoleção) + Transaction to main collection (sincronização Web/App)
        // Agora addInvestmentTransaction já cria automaticamente na coleção principal
        await databaseService.addInvestmentTransaction(user.uid, selectedInvestment.id, {
            amount: amount,
            type: type,
            date: new Date().toISOString(),
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
        if (!user || !selectedInvestment || isSaving) return;

        setIsSaving(true);
        try {
            await databaseService.updateInvestment(user.uid, selectedInvestment.id, {
                name: data.name,
                targetAmount: data.targetAmount,
                deadline: data.deadline || null
            });

            setEditModalVisible(false);
            setSelectedInvestment(null);
        } catch (error) {
            console.error('[Planning] Error updating investment:', error);
        } finally {
            setIsSaving(false);
        }
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
                    <View style={styles.headerTitleRow}>
                        <Image
                            source={require('../../assets/images/icon.png')}
                            style={styles.headerIcon}
                            resizeMode="contain"
                        />
                        <Text style={styles.screenHeader} numberOfLines={1}>
                            Patrimônio
                        </Text>
                    </View>

                    <MorphTouchable
                        radius={HEADER_CONTROL_HEIGHT / 2}
                        style={styles.headerButton}
                        onPress={() => setCreateModalVisible(true)}
                    >
                        <Plus size={17} color="#FFFFFF" strokeWidth={2.6} />
                        <Text style={styles.headerButtonText}>Criar</Text>
                    </MorphTouchable>
                </View>



                {loading ? (
                    <IosCoreLoader />
                ) : investments.length > 0 ? (
                    <FlatList
                        data={investments}
                        keyExtractor={(item) => item.id}
                        extraData={openMenuItemId}
                        CellRendererComponent={({ item, children, style, ...rest }: any) => {
                            const isOpen = openMenuItemId === item.id;
                            return (
                                <View
                                    {...rest}
                                    style={[style, isOpen && { zIndex: 100, elevation: 20 }]}
                                >
                                    {children}
                                </View>
                            );
                        }}
                        renderItem={({ item, index }) => (
                            <InvestmentCard
                                item={item}
                                index={index}
                                isMenuOpen={openMenuItemId === item.id}
                                onToggleMenu={() => setOpenMenuItemId((prev) => (prev === item.id ? null : item.id))}
                                onCloseMenu={() => setOpenMenuItemId(null)}
                                onExtract={() => {
                                    setSelectedInvestment(item);
                                    setStatementModalVisible(true);
                                }}
                                onMove={() => {
                                    setSelectedInvestment(item);
                                    setDetailsInitialView('movement');
                                    setDetailsModalVisible(true);
                                }}
                                onEdit={() => {
                                    setSelectedInvestment(item);
                                    setEditModalVisible(true);
                                }}
                                onDelete={() => handleRequestDelete(item)}
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
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconWrapper}>
                            <IntervalLottie
                                source={require('../../assets/caixinhas.json')}
                                size={48}
                                interval={3000}
                            />
                        </View>

                        <Text style={styles.emptyTitle}>
                            Nenhuma caixinha
                        </Text>

                        <Text style={styles.emptyText}>
                            Crie caixinhas para organizar seus objetivos financeiros.
                        </Text>
                    </View>
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
                loading={isSaving}
            />

            {selectedInvestment && (
                <InvestmentDetailsModal
                    visible={detailsModalVisible}
                    initialView={detailsInitialView}
                    onClose={() => {
                        setDetailsModalVisible(false);
                        setDetailsInitialView('menu');
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
                    loading={isSaving}
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
        paddingTop: 58,
        zIndex: 10,
    },
    listContainer: {
        paddingTop: 0,
        paddingHorizontal: 22,
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 22,
        marginBottom: 12,
        zIndex: 10,
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
    headerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#D97757',
        height: HEADER_CONTROL_HEIGHT,
        paddingHorizontal: 14,
        borderRadius: HEADER_CONTROL_HEIGHT / 2,
        gap: 6,
    },
    headerButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    // Card Styles
    cardContainer: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#252525',
        backgroundColor: '#101010',
    },
    cardContent: {
        padding: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
        position: 'relative',
        zIndex: 20,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#D97757',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 1,
    },
    accountNumberText: {
        fontSize: 11,
        fontWeight: '400',
        color: '#909090',
    },
    cardSubtitle: {
        fontSize: 10,
        color: '#909090',
    },
    amountContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 8,
    },
    amountLabel: {
        fontSize: 10,
        color: '#909090',
        marginBottom: 2,
    },
    currentAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    targetAmount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#909090',
    },
    progressContainer: {
        marginTop: 0,
        gap: 4,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressTextLeft: {
        fontSize: 9,
        color: '#909090',
        fontWeight: '500',
    },
    progressTextRight: {
        fontSize: 9,
        color: '#909090',
        fontWeight: '500',
    },
    progressBarBg: {
        width: '100%',
        height: 4,
        backgroundColor: '#252525',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    // Empty State Styles
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingBottom: 96,
        flex: 1,
    },
    emptyIconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#F5F5F7',
        marginTop: 8,
        marginBottom: 4,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#8E8E93',
        textAlign: 'center',
        maxWidth: 232,
        lineHeight: 18,
    },
    // Open Finance Pill Styles
    openFinancePill: {
        backgroundColor: 'rgba(4, 211, 97, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        alignSelf: 'flex-start',
        marginTop: 2,
        borderWidth: 1,
        borderColor: 'rgba(4, 211, 97, 0.3)',
    },
    openFinancePillText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#04D361',
        letterSpacing: 0.2,
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
        backgroundColor: '#101010',
        borderRadius: 14,
        height: 28, // Ultra compact
        width: 120, // Very small width
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#252525',
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
    cardMenuButton: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Dropdown do card de investimento
    investmentDropdown: {
        position: 'absolute',
        top: 44,
        right: 8,
        width: 160,
        zIndex: 1000,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.07)',
        overflow: 'hidden',
        borderRadius: 20,
        backgroundColor: 'rgba(17, 17, 17, 0.94)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 12,
    },
    investmentDropdownOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(17, 17, 17, 0.94)',
    },
    investmentDropdownContent: {
        paddingVertical: 4,
    },
    investmentDropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    investmentDropdownText: {
        color: '#E0E0E0',
        fontSize: 14,
        fontFamily: 'AROneSans_400Regular',
    },
    investmentDropdownTextDestructive: {
        color: '#FF6B6B',
        fontSize: 14,
        fontFamily: 'AROneSans_400Regular',
    },
    investmentDropdownDivider: {
        height: 1,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
});
