import { useCategories } from '@/hooks/use-categories';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { InvoiceItem } from '@/services/invoiceBuilder';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
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
            title="Opções da Transação"
            titleAlign="start"
            maxHeightRatio={0.78}
        >
            <View style={styles.container}>
                <View style={styles.headerInfo}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>
                        {transaction.description}
                    </Text>
                    <Text style={styles.transactionSubtitle}>
                        {new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {getCategoryName(transaction.category)}
                    </Text>
                </View>

                {showMoveSection && (
                    <View>
                        <Text style={styles.sectionTitle}>FATURA</Text>
                        <View style={styles.sectionCard}>
                            {/* Renderiza até 2 opções de movimento relativo (prev/next) com labels customizados */}
                            {moveOptions?.map((opt, index) => (
                                <React.Fragment key={opt.target}>
                                    <TouchableOpacity
                                        style={[styles.itemContainer, !canMoveInvoice && styles.itemDisabled]}
                                        disabled={!canMoveInvoice}
                                        onPress={() => {
                                            if (!canMoveInvoice) return;
                                            onMoveInvoice(opt.target);
                                        }}
                                        activeOpacity={0.72}
                                    >
                                        <View style={styles.itemContent}>
                                            <Text style={styles.itemTitle}>{opt.label}</Text>
                                            {!!opt.date && <Text style={styles.itemSubtitle}>{opt.date}</Text>}
                                        </View>
                                    </TouchableOpacity>
                                    {index < (moveOptions?.length || 0) - 1 && <View style={styles.separator} />}
                                </React.Fragment>
                            ))}
                        </View>

                        {!canMoveInvoice && (
                            <Text style={styles.projectedHint}>
                                Transações projetadas sem parcelas não podem ser movidas.
                            </Text>
                        )}
                    </View>
                )}

                <Text style={styles.sectionTitle}>AÇÕES</Text>
                <View style={styles.sectionCard}>
                    {isRefund ? (
                        <TouchableOpacity
                            style={styles.itemContainer}
                            activeOpacity={0.72}
                            onPress={() => {
                                onDelete(transaction);
                                onClose();
                            }}
                        >
                            <View style={styles.itemContent}>
                                <Text style={[styles.itemTitle, { color: '#FF453A' }]}>Excluir transação</Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <>
                            {canRefund && (
                                <>
                                    <TouchableOpacity
                                        style={styles.itemContainer}
                                        activeOpacity={0.72}
                                        onPress={() => {
                                            if (onRefund) onRefund(transaction);
                                        }}
                                    >
                                        <View style={styles.itemContent}>
                                            <Text style={styles.itemTitle}>Estornar transação</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <View style={styles.separator} />
                                </>
                            )}

                            <TouchableOpacity
                                style={styles.itemContainer}
                                activeOpacity={0.72}
                                onPress={() => {
                                    if (onChangeCategory) onChangeCategory(transaction);
                                }}
                            >
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Mudar categoria</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.separator} />

                            <TouchableOpacity
                                style={styles.itemContainer}
                                activeOpacity={0.72}
                                onPress={() => {
                                    onDelete(transaction);
                                    onClose();
                                }}
                            >
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemTitle, { color: '#FF453A' }]}>Excluir transação</Text>
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
                    <IosCoreLoader fill={false} style={styles.loaderContainer} />
                </View>
            )}
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 12,
        paddingBottom: 0,
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
        backgroundColor: 'rgba(26, 26, 26, 0.8)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    headerInfo: {
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    transactionTitle: {
        fontSize: 17,
        fontWeight: '400',
        color: '#FFFFFF',
        marginBottom: 4,
        textAlign: 'left'
    },
    transactionSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        textAlign: 'left'
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    sectionCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 24,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    itemContent: {
        flex: 1,
        justifyContent: 'center',
    },
    itemTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '400',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 1,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
        width: '100%'
    },
    itemDisabled: {
        opacity: 0.45,
    },
    projectedHint: {
        marginTop: 8,
        color: '#8E8E93',
        fontSize: 12
    }
});

