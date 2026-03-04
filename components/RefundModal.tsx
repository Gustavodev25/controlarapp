import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { formatCurrency } from '@/services/invoiceBuilder';
import { AlertCircle, RotateCcw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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

    useEffect(() => {
        if (visible) {
            setRefundType('total');
            setCustomValue('');
            setError('');
            setLoading(false);
        }
    }, [visible]);

    const formatInputValue = (text: string) => {
        let cleaned = text.replace(/\D/g, '');
        let value = parseInt(cleaned) || 0;
        let formatted = (value / 100).toFixed(2).replace('.', ',');
        return formatted;
    };

    const handleValueChange = (text: string) => {
        const formatted = formatInputValue(text);
        setCustomValue(formatted);
        setError('');
    };

    const parseCustomValue = (): number => {
        if (!customValue) return 0;
        const value = parseFloat(customValue.replace(',', '.'));
        return isNaN(value) ? 0 : value;
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

            if (refundAmount > transaction.amount) {
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
        >
            <View style={styles.modalContent}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                <Text style={styles.subtitle}>
                    Selecione como deseja realizar o estorno desta transação.
                </Text>

                <View style={styles.infoBox}>
                    <RotateCcw size={16} color="#4ADE80" style={{ marginRight: 8, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoBoxText}>
                            Você está estornando: <Text style={styles.boldText}>{transaction.description}</Text> no valor de <Text style={styles.boldText}>{formatCurrency(transaction.amount)}</Text>.
                        </Text>
                    </View>
                </View>

                <View style={styles.sectionCard}>
                    <TouchableOpacity
                        style={styles.itemContainer}
                        onPress={() => setRefundType('total')}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.radioOuter,
                            refundType === 'total' && styles.radioOuterSelected
                        ]}>
                            {refundType === 'total' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={styles.itemTitle}>Valor total</Text>
                            <Text style={styles.itemSubLabel}>
                                Estornar {formatCurrency(transaction.amount)}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.itemSeparator} />

                    <TouchableOpacity
                        style={styles.itemContainer}
                        onPress={() => setRefundType('custom')}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.radioOuter,
                            refundType === 'custom' && styles.radioOuterSelected
                        ]}>
                            {refundType === 'custom' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.itemContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>Valor personalizado</Text>
                                    <Text style={styles.itemSubLabel}>
                                        Escolha um valor de estorno parcial
                                    </Text>
                                </View>
                                {refundType === 'custom' && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                                        <Text style={{ color: '#909090', fontSize: 16, marginRight: 8 }}>R$</Text>
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
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {error ? (
                    <View style={styles.errorContainer}>
                        <AlertCircle size={16} color="#FF453A" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                </ScrollView>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleConfirm}
                    activeOpacity={0.85}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.saveButtonText}>Estornar</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    modalContent: {
        gap: 8,
    },
    container: {
        gap: 16,
    },
    subtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left',
        lineHeight: 20,
        marginBottom: 4,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: -4,
        marginBottom: 8,
    },
    infoBoxText: {
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
    },
    boldText: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#1A1A1A',
    },
    itemContent: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    itemSubLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
    itemSeparator: {
        height: 1,
        backgroundColor: '#2A2A2A',
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#555',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    radioOuterSelected: {
        borderColor: '#4ADE80'
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4ADE80'
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 16,
        minWidth: 60,
        padding: 0,
        fontWeight: '600',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        padding: 12,
        borderRadius: 10,
        gap: 8
    },
    errorText: {
        fontSize: 13,
        color: '#FF453A',
        flex: 1
    },
    saveButton: {
        backgroundColor: '#D97757',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

