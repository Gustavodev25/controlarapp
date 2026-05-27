import { AuthButton } from '@/components/ui/AuthButton';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { formatCurrency } from '@/services/invoiceBuilder';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface RefundTransaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    category?: string;
    type: 'income' | 'expense';
    cardId?: string;
    accountId?: string;
}

interface RefundModalProps {
    visible: boolean;
    onClose: () => void;
    transaction: RefundTransaction | null;
    onConfirm: (transaction: RefundTransaction, customAmount?: number) => Promise<void>;
}

type RefundType = 'total' | 'custom';

export function RefundModal({
    visible,
    onClose,
    transaction,
    onConfirm,
}: RefundModalProps) {
    const [refundType, setRefundType] = useState<RefundType>('total');
    const [customValue, setCustomValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const transactionAmount = Math.abs(transaction?.amount || 0);

    useEffect(() => {
        if (visible) {
            setRefundType('total');
            setCustomValue('');
            setError('');
            setLoading(false);
        }
    }, [visible]);

    const formatInputValue = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        const value = parseInt(cleaned, 10) || 0;
        return (value / 100).toFixed(2).replace('.', ',');
    };

    const handleValueChange = (text: string) => {
        setCustomValue(formatInputValue(text));
        setError('');
    };

    const parseCustomValue = (): number => {
        if (!customValue) return 0;
        const value = parseFloat(customValue.replace(',', '.'));
        return Number.isNaN(value) ? 0 : value;
    };

    const handleConfirm = async () => {
        if (!transaction) return;

        let refundAmount: number | undefined;

        if (refundType === 'custom') {
            refundAmount = parseCustomValue();

            if (refundAmount <= 0) {
                setError('Digite um valor maior que zero');
                return;
            }

            if (refundAmount > transactionAmount) {
                setError('O valor não pode ser maior que a transação original');
                return;
            }
        }

        setLoading(true);
        setError('');

        try {
            await onConfirm(transaction, refundType === 'custom' ? refundAmount : undefined);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Não foi possível registrar o estorno');
        } finally {
            setLoading(false);
        }
    };

    if (!transaction) return null;

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Estorno de Transação"
            titleAlign="start"
            maxHeightRatio={0.68}
            footer={(
                <AuthButton
                    title="Estornar"
                    onPress={handleConfirm}
                    isLoading={loading}
                />
            )}
        >
            <View style={styles.modalContent}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.subtitle}>
                        Escolha o valor que será lançado como estorno nesta fatura.
                    </Text>

                    <Text style={styles.sectionTitle}>TRANSAÇÃO</Text>
                    <View style={styles.groupCard}>
                        <View style={styles.itemContent}>
                            <View style={styles.itemTextBlock}>
                                <Text style={styles.itemTitle} numberOfLines={1}>{transaction.description}</Text>
                                <Text style={styles.itemSubLabel}>{formatCurrency(transactionAmount)}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>VALOR DO ESTORNO</Text>
                    <View style={styles.groupCard}>
                        <TouchableOpacity
                            style={styles.itemContainer}
                            onPress={() => setRefundType('total')}
                            activeOpacity={0.72}
                        >
                            <View style={styles.itemTextBlock}>
                                <Text style={styles.itemTitle}>Valor total</Text>
                                <Text style={styles.itemSubLabel}>
                                    Estornar {formatCurrency(transactionAmount)}
                                </Text>
                            </View>
                            <View style={[styles.selectionDot, refundType === 'total' && styles.selectionDotActive]} />
                        </TouchableOpacity>

                        <View style={styles.itemSeparator} />

                        <TouchableOpacity
                            style={styles.itemContainer}
                            onPress={() => setRefundType('custom')}
                            activeOpacity={0.72}
                        >
                            <View style={styles.itemTextBlock}>
                                <Text style={styles.itemTitle}>Valor personalizado</Text>
                                <Text style={styles.itemSubLabel}>Estorno parcial</Text>
                            </View>

                            {refundType === 'custom' ? (
                                <View style={styles.inputPill}>
                                    <Text style={styles.inputPrefix}>R$</Text>
                                    <TextInput
                                        style={styles.inputRight}
                                        value={customValue}
                                        onChangeText={handleValueChange}
                                        placeholder="0,00"
                                        placeholderTextColor="#555"
                                        keyboardType="numeric"
                                        textAlign="right"
                                        maxLength={12}
                                        autoFocus
                                    />
                                </View>
                            ) : (
                                <View style={styles.selectionDot} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    modalContent: {
        gap: 0,
    },
    container: {
        paddingTop: 12,
        paddingBottom: 0,
    },
    subtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left',
        lineHeight: 18,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    groupCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        marginBottom: 24,
        overflow: 'hidden',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    itemTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    itemTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '400',
    },
    itemSubLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 1,
    },
    itemSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
    },
    selectionDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#636366',
        marginLeft: 12,
    },
    selectionDotActive: {
        borderWidth: 5,
        borderColor: '#D97757',
    },
    inputPill: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        backgroundColor: '#111111',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        paddingHorizontal: 10,
        height: 36,
    },
    inputPrefix: {
        color: '#8E8E93',
        fontSize: 13,
        marginRight: 6,
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 15,
        minWidth: 58,
        padding: 0,
        fontWeight: '500',
    },
    errorContainer: {
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        padding: 12,
        borderRadius: 10,
        marginTop: -8,
    },
    errorText: {
        fontSize: 13,
        color: '#FF453A',
    },
});
