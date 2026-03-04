import { useCategories } from '@/hooks/use-categories';
import { InvoiceItem } from '@/services/invoiceBuilder';
import { BlurView } from 'expo-blur';
import {
    ArrowLeft,
    ArrowRight,
    RotateCcw,
    Tag,
    Trash2
} from 'lucide-react-native';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ModalPadrao } from './ui/ModalPadrao';

interface TransactionOptionsModalProps {
    visible: boolean;
    onClose: () => void;
    transaction: InvoiceItem | null;
    onMoveInvoice: (target: 'prev' | 'next' | 'current' | 'custom', date?: string) => void;
    onDelete: (item: InvoiceItem) => void;
    onRefund?: (item: InvoiceItem) => void;
    currentClosingDate?: Date;
    moveOptions?: { target: 'prev' | 'next' | 'current' | 'custom'; label: string; date?: string; icon?: 'prev' | 'next' }[];
    onChangeCategory?: (item: InvoiceItem) => void;
    loading?: boolean;
}

export function TransactionOptionsModal({
    visible,
    onClose,
    transaction,
    onMoveInvoice,
    onDelete,
    onRefund,
    currentClosingDate,
    moveOptions,
    onChangeCategory,
    loading
}: TransactionOptionsModalProps) {
    const { getCategoryName } = useCategories();

    if (!transaction) return null;

    const isPayment = transaction.isPayment;
    const isProjected = transaction.isProjected;
    const isRefund = transaction.isRefund;
    const isInstallment = (transaction.totalInstallments ?? 0) > 1;
    const canRefund = !isProjected && !isPayment && !isRefund && onRefund;
    const canMoveInvoice = !isProjected || isInstallment;
    const showMoveSection = !isRefund;


    return (
        <ModalPadrao
            visible={visible}
            onClose={() => {
                onClose();
            }}
            title="OpÃ§Ãµes da TransaÃ§Ã£o"
        >
            <View style={styles.container}>
                <View style={styles.headerInfo}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>
                        {transaction.description}
                    </Text>
                    <Text style={styles.transactionSubtitle}>
                        {new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR')} â€¢ {getCategoryName(transaction.category)}
                    </Text>
                </View>

                {showMoveSection && (
                    <View style={styles.sectionWrapper}>
                        <View style={styles.sectionCard}>
                            <Text style={styles.cardTitle}>MOVER FATURA</Text>
                            {/* Renderiza atÃ© 2 opÃ§Ãµes de movimento relativo (prev/next) com labels customizados */}
                            {moveOptions?.map((opt, index) => (
                                <React.Fragment key={opt.target}>
                                    <TouchableOpacity
                                        style={styles.itemContainer}
                                        disabled={!canMoveInvoice}
                                        onPress={() => {
                                            if (!canMoveInvoice) return;
                                            onMoveInvoice(opt.target);
                                        }}
                                    >
                                        <View style={[styles.itemIconContainer, { backgroundColor: '#252525' }]}>
                                            {opt.icon === 'prev' ? <ArrowLeft size={20} color="#E0E0E0" /> : <ArrowRight size={20} color="#E0E0E0" />}
                                        </View>
                                        <View style={styles.itemContent}>
                                            <View>
                                                <Text style={styles.itemTitle}>{opt.label}</Text>
                                                {!!opt.date && <Text style={styles.itemSubtitle}>{opt.date}</Text>}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                    {index < (moveOptions?.length || 0) - 1 && <View style={styles.separator} />}
                                </React.Fragment>
                            ))}
                        </View>

                        {!canMoveInvoice && (
                            <Text style={styles.projectedHint}>
                                TransaÃ§Ãµes projetadas sem parcelas nÃ£o podem ser movidas.
                            </Text>
                        )}
                    </View>
                )}

                <View style={styles.sectionCard}>
                    <Text style={styles.cardTitle}>AÃ‡Ã•ES</Text>
                    {isRefund ? (
                        <TouchableOpacity
                            style={styles.itemContainer}
                            onPress={() => {
                                onDelete(transaction);
                                onClose();
                            }}
                        >
                            <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(255, 69, 58, 0.15)' }]}>
                                <Trash2 size={20} color="#FF453A" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={[styles.itemTitle, { color: '#FF453A' }]}>Excluir transaÃ§Ã£o</Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <>
                            {canRefund && (
                                <>
                                    <TouchableOpacity
                                        style={styles.itemContainer}
                                        onPress={() => {
                                            if (onRefund) onRefund(transaction);
                                        }}
                                    >
                                        <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                                            <RotateCcw size={20} color="#4ADE80" />
                                        </View>
                                        <View style={styles.itemContent}>
                                            <Text style={[styles.itemTitle, { color: '#4ADE80' }]}>Estornar transaÃ§Ã£o</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <View style={styles.separator} />
                                </>
                            )}

                            <TouchableOpacity
                                style={styles.itemContainer}
                                onPress={() => {
                                    if (onChangeCategory) onChangeCategory(transaction);
                                }}
                            >
                                <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(217, 119, 87, 0.15)' }]}>
                                    <Tag size={20} color="#D97757" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemTitle, { color: '#D97757' }]}>Mudar categoria</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.separator} />

                            <TouchableOpacity
                                style={styles.itemContainer}
                                onPress={() => {
                                    onDelete(transaction);
                                    onClose();
                                }}
                            >
                                <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(255, 69, 58, 0.15)' }]}>
                                    <Trash2 size={20} color="#FF453A" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemTitle, { color: '#FF453A' }]}>Excluir transaÃ§Ã£o</Text>
                                </View>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <BlurView
                        intensity={40}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#D97757" />
                        <Text style={styles.loadingText}>Processando...</Text>
                    </View>
                </View>
            )}
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 20,
        gap: 20
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 28,
        overflow: 'hidden',
        zIndex: 999
    },
    loaderContainer: {
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(26, 26, 26, 0.8)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    headerInfo: {
        alignItems: 'flex-start',
        marginBottom: 4,
        paddingHorizontal: 4
    },
    transactionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
        textAlign: 'left'
    },
    transactionSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left'
    },
    sectionWrapper: {
        gap: 8
    },
    cardTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#909090',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: 16,
        paddingBottom: 8
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
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
    itemContent: {
        flex: 1,
        justifyContent: 'center',
    },
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#909090',
        marginTop: 2,
    },
    separator: {
        height: 1,
        backgroundColor: '#2A2A2A',
        width: '100%'
    },
    projectedHint: {
        marginTop: -8,
        marginHorizontal: 4,
        color: '#8E8E93',
        fontSize: 12
    }
});

