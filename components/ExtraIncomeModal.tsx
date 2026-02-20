import { BottomModal } from '@/components/ui/BottomModal';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { Banknote, DollarSign, FileText } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ExtraIncomeModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (data: { description: string; amount: number; deductTax: boolean; netAmount: number }) => void;
}

export function ExtraIncomeModal({ visible, onClose, onSave }: ExtraIncomeModalProps) {
    const [description, setDescription] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [deductTax, setDeductTax] = useState(false);
    const [netAmount, setNetAmount] = useState(0);

    // Reset form when modal opens
    useEffect(() => {
        if (visible) {
            setDescription('');
            setAmountStr('');
            setDeductTax(false);
        }
    }, [visible]);

    // Calculate preview
    useEffect(() => {
        const rawAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0');

        let calculated = rawAmount;
        if (deductTax) {
            // Estimativa de impostos (~6%)
            const TAX_RATE = 0.06;
            calculated = rawAmount * (1 - TAX_RATE);
        }

        setNetAmount(calculated);
    }, [amountStr, deductTax]);

    const handleSave = () => {
        const rawAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0');
        if (rawAmount <= 0) return;

        onSave({
            description,
            amount: rawAmount,
            deductTax,
            netAmount
        });
        onClose();
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatInputCurrency = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (!numbers) return '';
        const amount = parseInt(numbers) / 100;
        return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    };

    const handleChangeAmount = (text: string) => {
        setAmountStr(formatInputCurrency(text));
    };

    return (
        <BottomModal
            visible={visible}
            onClose={onClose}
            title="Novo Extra"
            height="auto"
            rightElement={
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!amountStr || parseFloat(amountStr.replace(',', '.') || '0') <= 0 || !description}
                    style={{ opacity: (!amountStr || parseFloat(amountStr.replace(',', '.') || '0') <= 0 || !description) ? 0.5 : 1 }}
                >
                    <Text style={styles.headerSaveText}>Adicionar</Text>
                </TouchableOpacity>
            }
        >
            <View style={styles.container}>

                {/* Section Card */}
                <View style={styles.sectionCard}>
                    {/* Descrição */}
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <FileText size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemRightContainer}>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Descrição</Text>
                                <TextInput
                                    style={styles.inputRight}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Ex: Freela"
                                    placeholderTextColor="#555"
                                    textAlign="right"
                                />
                            </View>
                        </View>
                        <View style={styles.itemSeparator} />
                    </View>

                    {/* Valor Recebido */}
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <DollarSign size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemRightContainer}>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>Valor Recebido</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: amountStr ? '#FFFFFF' : '#555', fontSize: 16, marginRight: 4 }}>R$</Text>
                                    <TextInput
                                        style={styles.inputRight}
                                        value={amountStr}
                                        onChangeText={handleChangeAmount}
                                        placeholder="0,00"
                                        placeholderTextColor="#555"
                                        keyboardType="numeric"
                                        textAlign="right"
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={styles.itemSeparator} />
                    </View>

                    {/* Deduzir Impostos */}
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <Banknote size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemRightContainer}>
                            <View style={styles.itemContent}>
                                <View>
                                    <Text style={styles.itemTitle}>Deduzir Impostos</Text>
                                    <Text style={styles.itemSubtitle}>Estimativa auto (~6%)</Text>
                                </View>
                                <ModernSwitch
                                    value={deductTax}
                                    onValueChange={setDeductTax}
                                    activeColor="#d97757"
                                    width={46}
                                    height={26}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Preview Section - Similar to Settings Summary */}
                <View style={styles.sectionCard}>
                    <View style={styles.cardPadding}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Valor Bruto</Text>
                            <Text style={styles.summaryValuePositive}>
                                {amountStr ? `R$ ${amountStr}` : 'R$ 0,00'}
                            </Text>
                        </View>

                        {deductTax && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Dedução Impostos</Text>
                                <Text style={styles.summaryValueNegative}>
                                    - {formatCurrency(parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0') * 0.06)}
                                </Text>
                            </View>
                        )}

                        <View style={styles.summaryDivider} />

                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>LÍQUIDO ESTIMADO</Text>
                            <Text style={styles.totalValue}>{formatCurrency(netAmount)}</Text>
                        </View>
                    </View>
                </View>

            </View>
        </BottomModal >
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 20,
    },
    // Card Styles matching FinancialSettingsScreen
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },

    // Item/Row Styles
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        position: 'relative', // For separator absolute positioning if needed, though usually it's just a view at bottom
    },
    itemIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemRightContainer: {
        flex: 1,
    },
    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#2A2A2A',
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 16,
        minWidth: 100,
        padding: 0,
    },

    // Summary/Preview Styles
    cardPadding: {
        padding: 20,
        gap: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        color: '#909090',
    },
    summaryValuePositive: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    summaryValueNegative: {
        fontSize: 14,
        color: '#FF6B6B',
        fontWeight: '500',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 4,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#909090',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#d97757', // Premium Orange/Brand color
    },
    headerSaveText: {
        color: '#d97757',
        fontWeight: '600',
        fontSize: 16
    },
});
