import { BottomModal } from '@/components/ui/BottomModal';
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

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setRefundType('total');
            setCustomValue('');
            setError('');
            setLoading(false);
        }
    }, [visible]);

    // Format value for display (R$ X,XX)
    const formatInputValue = (text: string) => {
        // Remove non-numeric characters
        let cleaned = text.replace(/\D/g, '');

        // Convert to number (cents)
        let value = parseInt(cleaned) || 0;

        // Format as currency
        let formatted = (value / 100).toFixed(2).replace('.', ',');

        return formatted;
    };

    const handleValueChange = (text: string) => {
        const formatted = formatInputValue(text);
        setCustomValue(formatted);
        setError('');
    };

    // Parse the custom value to number
    const parseCustomValue = (): number => {
        if (!customValue) return 0;
        // Convert "123,45" to 123.45
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
        <BottomModal
            visible={visible}
            onClose={onClose}
            title="Estorno de Transação"
            height="auto"
            rightElement={
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={loading}
                    style={styles.headerConfirmButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#4ADE80" />
                    ) : (
                        <RotateCcw size={22} color="#4ADE80" />
                    )}
                </TouchableOpacity>
            }
        >
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                {/* Transaction Info */}
                <View style={styles.transactionInfo}>
                    <View style={styles.transactionIconContainer}>
                        <RotateCcw size={24} color="#4ADE80" />
                    </View>
                    <View style={styles.transactionDetails}>
                        <Text style={styles.transactionDescription} numberOfLines={2}>
                            {transaction.description}
                        </Text>
                        <Text style={styles.transactionAmount}>
                            Valor: {formatCurrency(transaction.amount)}
                        </Text>
                    </View>
                </View>

                {/* Refund Type Selection */}
                <Text style={styles.sectionHeader}>TIPO DE ESTORNO</Text>
                <View style={styles.sectionCard}>
                    {/* Total Value Option */}
                    <TouchableOpacity
                        style={styles.optionContainer}
                        onPress={() => setRefundType('total')}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.radioOuter,
                            refundType === 'total' && styles.radioOuterSelected
                        ]}>
                            {refundType === 'total' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.optionContent}>
                            <Text style={styles.optionTitle}>Valor total</Text>
                            <Text style={styles.optionSubtitle}>
                                Estornar {formatCurrency(transaction.amount)}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.optionDivider} />

                    {/* Custom Value Option */}
                    <TouchableOpacity
                        style={styles.optionContainer}
                        onPress={() => setRefundType('custom')}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.radioOuter,
                            refundType === 'custom' && styles.radioOuterSelected
                        ]}>
                            {refundType === 'custom' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.optionContent}>
                            <Text style={styles.optionTitle}>Valor personalizado</Text>
                            <Text style={styles.optionSubtitle}>
                                Escolha um valor de estorno parcial
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Custom Value Input */}
                    {refundType === 'custom' && (
                        <View style={styles.customInputContainer}>
                            <Text style={styles.currencyPrefix}>R$</Text>
                            <TextInput
                                style={styles.customInput}
                                value={customValue}
                                onChangeText={handleValueChange}
                                placeholder="0,00"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                maxLength={10}
                                autoFocus
                            />
                        </View>
                    )}
                </View>

                {/* Error Message */}
                {error ? (
                    <View style={styles.errorContainer}>
                        <AlertCircle size={16} color="#FF453A" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {/* Info Box */}
                <View style={styles.helpContainer}>
                    <View style={styles.helpHeaderRow}>
                        <AlertCircle size={18} color="#4ADE80" />
                        <Text style={styles.helpTitle}>O que vai acontecer?</Text>
                    </View>
                    <Text style={styles.helpText}>
                        Uma nova transação de <Text style={styles.helpTextBold}>crédito</Text> será
                        criada nesta fatura com o valor do estorno. A transação original será mantida.
                    </Text>
                </View>
            </ScrollView>
        </BottomModal>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 0
    },
    transactionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#252525'
    },
    transactionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    transactionDetails: {
        flex: 1
    },
    transactionDescription: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
        marginBottom: 4
    },
    transactionAmount: {
        fontSize: 14,
        color: '#888'
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
        backgroundColor: '#151515',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#252525',
        marginBottom: 16
    },
    optionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16
    },
    optionDivider: {
        height: 1,
        backgroundColor: '#252525',
        marginHorizontal: 0
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
    optionContent: {
        flex: 1
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFF'
    },
    optionSubtitle: {
        fontSize: 13,
        color: '#888',
        marginTop: 2
    },
    customInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 8
    },
    currencyPrefix: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4ADE80',
        marginRight: 8
    },
    customInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: '600',
        color: '#FFF',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#1A1A1A',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4ADE80'
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
        gap: 8
    },
    errorText: {
        fontSize: 13,
        color: '#FF453A',
        flex: 1
    },
    helpContainer: {
        backgroundColor: '#1A1A1A',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 0
    },
    helpHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    helpTitle: {
        fontSize: 14,
        color: '#4ADE80',
        fontWeight: '600'
    },
    helpText: {
        fontSize: 13,
        color: '#CCC',
        lineHeight: 18
    },
    helpTextBold: {
        fontWeight: '700',
        color: '#4ADE80'
    },
    headerConfirmButton: {
        padding: 4
    }
});
