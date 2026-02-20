import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { DetectedSubscription } from '@/services/subscriptionDetector';
import { getCategoryConfig } from '@/utils/categoryUtils';
import { BlurView } from 'expo-blur';
import { Check, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DetectedSubscriptionsModalProps {
    visible: boolean;
    subscriptions: DetectedSubscription[];
    onClose: () => void;
    onValidate: (subscription: DetectedSubscription) => void;
    onDismiss: (subscription: DetectedSubscription) => void;
}

const ConfidenceBadge = ({ confidence }: { confidence: 'high' | 'medium' | 'low' }) => {
    const config = {
        high: { label: 'Alta', color: '#04D361', bg: 'rgba(4, 211, 97, 0.1)' },
        medium: { label: 'Média', color: '#FFD60A', bg: 'rgba(255, 214, 10, 0.1)' },
        low: { label: 'Baixa', color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.1)' }
    };

    const { label, color, bg } = config[confidence];

    return (
        <View style={[styles.confidenceBadge, { backgroundColor: bg }]}>
            <Text style={[styles.confidenceText, { color }]}>{label}</Text>
        </View>
    );
};

const SubscriptionCard = ({
    subscription,
    onValidate,
    onDismiss,
    index
}: {
    subscription: DetectedSubscription;
    onValidate: () => void;
    onDismiss: () => void;
    index: number;
}) => {
    const [processing, setProcessing] = useState(false);
    const { icon: Icon, color, backgroundColor } = getCategoryConfig(subscription.category || 'Outros');

    const handleValidate = async () => {
        setProcessing(true);
        await onValidate();
    };

    const handleDismiss = async () => {
        setProcessing(true);
        await onDismiss();
    };

    return (
        <Animated.View
            entering={FadeIn.delay(index * 100)}
            exiting={FadeOut}
            style={styles.card}
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                    <View style={[styles.categoryIcon, { backgroundColor }]}>
                        <Icon size={16} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {subscription.name}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                            {subscription.occurrences} ocorrências • {subscription.frequency === 'monthly' ? 'Mensal' : 'Anual'}
                        </Text>
                    </View>
                </View>
                <ConfidenceBadge confidence={subscription.confidence} />
            </View>

            <View style={styles.cardBody}>
                <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Valor médio:</Text>
                    <Text style={styles.amountValue}>
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                        }).format(subscription.amount)}
                    </Text>
                </View>

                <View style={styles.categoryRow}>
                    <Text style={styles.categoryLabel}>Categoria:</Text>
                    <Text style={styles.categoryValue}>{subscription.category}</Text>
                </View>
            </View>

            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.dismissButton]}
                    onPress={handleDismiss}
                    disabled={processing}
                    activeOpacity={0.7}
                >
                    <X size={18} color="#FF453A" />
                    <Text style={[styles.actionButtonText, styles.dismissButtonText]}>
                        Desconsiderar
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.validateButton]}
                    onPress={handleValidate}
                    disabled={processing}
                    activeOpacity={0.7}
                >
                    <Check size={18} color="#FFF" />
                    <Text style={[styles.actionButtonText, styles.validateButtonText]}>
                        Validar
                    </Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

export const DetectedSubscriptionsModal: React.FC<DetectedSubscriptionsModalProps> = ({
    visible,
    subscriptions,
    onClose,
    onValidate,
    onDismiss
}) => {
    const [remainingSubscriptions, setRemainingSubscriptions] = useState(subscriptions);

    React.useEffect(() => {
        console.log('[DetectedSubscriptionsModal] Props changed:', { visible, subscriptionsCount: subscriptions.length });
        setRemainingSubscriptions(subscriptions);
    }, [subscriptions, visible]);

    const handleValidate = async (subscription: DetectedSubscription) => {
        console.log('[DetectedSubscriptionsModal] Validating:', subscription.name);
        await onValidate(subscription);
        setRemainingSubscriptions(prev => prev.filter(s => s.id !== subscription.id));
    };

    const handleDismiss = async (subscription: DetectedSubscription) => {
        console.log('[DetectedSubscriptionsModal] Dismissing:', subscription.name);
        await onDismiss(subscription);
        setRemainingSubscriptions(prev => prev.filter(s => s.id !== subscription.id));
    };

    const handleClose = () => {
        console.log('[DetectedSubscriptionsModal] Closing modal');
        if (remainingSubscriptions.length === 0) {
            onClose();
        } else {
            // Confirma se quer fechar sem validar todas
            onClose();
        }
    };

    console.log('[DetectedSubscriptionsModal] Rendering:', { visible, remainingCount: remainingSubscriptions.length });

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <BlurView intensity={20} tint="dark" style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View style={styles.headerIcon}>
                            <DelayedLoopLottie
                                source={require('@/assets/assinatura.json')}
                                style={{ width: 32, height: 32 }}
                                delay={5000}
                            />
                        </View>
                        <Text style={styles.title}>Assinaturas Detectadas</Text>
                        <Text style={styles.subtitle}>
                            Identificamos {remainingSubscriptions.length} possíve{remainingSubscriptions.length === 1 ? 'l' : 'is'} assinatura{remainingSubscriptions.length === 1 ? '' : 's'} nas suas transações bancárias
                        </Text>
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {remainingSubscriptions.length > 0 ? (
                            remainingSubscriptions.map((subscription, index) => (
                                <SubscriptionCard
                                    key={subscription.id}
                                    subscription={subscription}
                                    onValidate={() => handleValidate(subscription)}
                                    onDismiss={() => handleDismiss(subscription)}
                                    index={index}
                                />
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <DelayedLoopLottie
                                    source={require('@/assets/check.json')}
                                    style={{ width: 80, height: 80 }}
                                    delay={4000}
                                />
                                <Text style={styles.emptyTitle}>Tudo pronto!</Text>
                                <Text style={styles.emptyText}>
                                    Você revisou todas as assinaturas detectadas
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={handleClose}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.closeButtonText}>
                                {remainingSubscriptions.length > 0 ? 'Revisar Depois' : 'Fechar'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    container: {
        width: SCREEN_WIDTH - 40,
        maxHeight: '85%',
        backgroundColor: '#1A1A1A',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    header: {
        padding: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    headerIcon: {
        marginBottom: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#909090',
        textAlign: 'center',
        lineHeight: 20,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        gap: 16,
    },
    card: {
        backgroundColor: '#252525',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    categoryIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 12,
        color: '#909090',
    },
    confidenceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    confidenceText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    cardBody: {
        gap: 8,
        marginBottom: 16,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    amountLabel: {
        fontSize: 13,
        color: '#909090',
    },
    amountValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    categoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryLabel: {
        fontSize: 13,
        color: '#909090',
    },
    categoryValue: {
        fontSize: 13,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
    },
    dismissButton: {
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.3)',
    },
    validateButton: {
        backgroundColor: '#D97757',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    dismissButtonText: {
        color: '#FF453A',
    },
    validateButtonText: {
        color: '#FFFFFF',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#909090',
        textAlign: 'center',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#2A2A2A',
    },
    closeButton: {
        backgroundColor: '#2A2A2A',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
