import { BottomModal } from '@/components/ui/BottomModal';
import { InvoiceItem } from '@/services/invoiceBuilder';
import {
    ArrowLeft,
    ArrowRight,
    Calendar,
    RotateCcw,
    Trash2
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface TransactionOptionsModalProps {
    visible: boolean;
    onClose: () => void;
    transaction: InvoiceItem | null;
    onMoveInvoice: (target: 'prev' | 'next' | 'current' | 'custom', date?: string) => void;
    onDelete: (item: InvoiceItem) => void;
    onRefund?: (item: InvoiceItem) => void;
    currentClosingDate?: Date;
}

import { useCategories } from '@/hooks/use-categories';

export function TransactionOptionsModal({
    visible,
    onClose,
    transaction,
    onMoveInvoice,
    onDelete,
    onRefund,
    currentClosingDate
}: TransactionOptionsModalProps) {
    const { getCategoryName } = useCategories();
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [customDate, setCustomDate] = useState('');

    if (!transaction) return null;

    const isExpense = transaction.type === 'expense';
    const isPayment = transaction.isPayment;
    const isProjected = transaction.isProjected;
    const isRefund = transaction.isRefund;
    const canRefund = !isProjected && !isPayment && !isRefund && onRefund;
    const canMoveInvoice = !isProjected;

    const handleDateChange = (text: string) => {
        let cleaned = text.replace(/\D/g, '');
        if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

        let formatted = cleaned;
        if (cleaned.length >= 3) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
        }
        if (cleaned.length >= 5) {
            formatted = `${formatted.slice(0, 5)}/${cleaned.slice(4)}`;
        }
        setCustomDate(formatted);
    };

    const handleSaveCustomDate = () => {
        if (customDate.length === 10) {
            onMoveInvoice('custom', customDate);
            setShowCustomDate(false);
            setCustomDate('');
            onClose();
        }
    };

    return (
        <BottomModal
            visible={visible}
            onClose={() => {
                setShowCustomDate(false);
                onClose();
            }}
            title="Opções da Transação"
            height="auto"
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

                <Text style={styles.sectionHeader}>MOVER FATURA</Text>
                <View style={styles.sectionCard}>
                    <TouchableOpacity
                        style={styles.itemContainer}
                        disabled={!canMoveInvoice}
                        onPress={() => {
                            if (!canMoveInvoice) return;
                            onMoveInvoice('prev');
                            onClose();
                        }}
                    >
                        <View style={[styles.itemIconContainer, { backgroundColor: '#252525' }]}>
                            <ArrowLeft size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemTitle}>Mover para fatura anterior</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={styles.itemContainer}
                        disabled={!canMoveInvoice}
                        onPress={() => {
                            if (!canMoveInvoice) return;
                            onMoveInvoice('next');
                            onClose();
                        }}
                    >
                        <View style={[styles.itemIconContainer, { backgroundColor: '#252525' }]}>
                            <ArrowRight size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemTitle}>Mover para próxima fatura</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {showCustomDate ? (
                        <View style={styles.itemContainer}>
                            <View style={[styles.itemIconContainer, { backgroundColor: '#252525' }]}>
                                <Calendar size={20} color="#E0E0E0" />
                            </View>
                            <View style={[styles.itemContent, { paddingRight: 16 }]}>
                                <TextInput
                                    style={styles.input}
                                    value={customDate}
                                    onChangeText={handleDateChange}
                                    placeholder="DD/MM/AAAA"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    maxLength={10}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    style={[styles.saveButton, !canMoveInvoice && { opacity: 0.5 }]}
                                    disabled={!canMoveInvoice}
                                    onPress={handleSaveCustomDate}
                                >
                                    <Text style={styles.saveButtonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.itemContainer}
                            disabled={!canMoveInvoice}
                            onPress={() => {
                                if (!canMoveInvoice) return;
                                setShowCustomDate(true);
                            }}
                        >
                            <View style={[styles.itemIconContainer, { backgroundColor: '#252525' }]}>
                                <Calendar size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Alterar data manualmente</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {!canMoveInvoice && (
                    <Text style={styles.projectedHint}>
                        Transações projetadas não podem ser movidas.
                    </Text>
                )}

                <Text style={styles.sectionHeader}>AÇÕES</Text>
                <View style={styles.sectionCard}>
                    {canRefund && (
                        <>
                            <TouchableOpacity
                                style={styles.itemContainer}
                                onPress={() => {
                                    if (onRefund) onRefund(transaction);
                                    onClose();
                                }}
                            >
                                <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                                    <RotateCcw size={20} color="#4ADE80" />
                                </View>
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemTitle, { color: '#4ADE80' }]}>Estornar transação</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.separator} />
                        </>
                    )}

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
                            <Text style={[styles.itemTitle, { color: '#FF453A' }]}>Excluir transação</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </BottomModal>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 20
    },
    headerInfo: {
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 20
    },
    transactionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
        textAlign: 'center'
    },
    transactionSubtitle: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center'
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        marginBottom: 20
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        minHeight: 56,
    },
    itemIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 16,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 16,
        paddingVertical: 16,
    },
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: '#252525',
        width: '100%'
    },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
    },
    saveButton: {
        backgroundColor: '#D97757',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 10
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700'
    },
    projectedHint: {
        marginTop: -8,
        marginBottom: 16,
        marginHorizontal: 4,
        color: '#8E8E93',
        fontSize: 12
    }
});
