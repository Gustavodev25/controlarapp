import { ModalPadrao } from '@/components/ui/ModalPadrao';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface InvestmentModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (data: { name: string; targetAmount: number; deadline?: string }) => void;
    title?: string;
    initialData?: {
        name: string;
        targetAmount: number;
        deadline?: string;
    } | null;
    loading?: boolean;
}

export function InvestmentModal({ visible, onClose, onSave, title, initialData, loading }: InvestmentModalProps) {
    const [nameInput, setName] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [dateStr, setDateStr] = useState('');

    useEffect(() => {
        if (visible) {
            if (initialData) {
                setName(initialData.name);
                const formattedAmount = initialData.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                setAmountStr(formattedAmount);

                let formattedDate = '';
                if (initialData.deadline) {
                    if (initialData.deadline.includes('-')) {
                        const [year, month, day] = initialData.deadline.split('-');
                        formattedDate = `${day}/${month}/${year}`;
                    } else {
                        formattedDate = initialData.deadline;
                    }
                }
                setDateStr(formattedDate);
            } else {
                setName('');
                setAmountStr('');
                setDateStr('');
            }
        }
    }, [visible, initialData]);

    const handleSave = () => {
        const rawAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0');
        if (!nameInput || rawAmount <= 0) return;

        let formattedDeadline = undefined;
        if (dateStr.length === 10) {
            const [day, month, year] = dateStr.split('/');
            formattedDeadline = `${year}-${month}-${day}`;
        }

        onSave({ name: nameInput, targetAmount: rawAmount, deadline: formattedDeadline });
        onClose();
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

    const handleChangeDate = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        let formatted = cleaned;
        if (cleaned.length > 2) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
        }
        if (cleaned.length > 4) {
            formatted = `${formatted.slice(0, 5)}/${formatted.slice(5, 9)}`;
        }
        if (formatted.length > 10) formatted = formatted.slice(0, 10);
        setDateStr(formatted);
    };

    const isSaveDisabled = !nameInput || !amountStr || loading;

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title={title || "Nova Caixinha"}
            titleAlign="start"
            footer={
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaveDisabled}
                    style={[styles.footerButton, isSaveDisabled && styles.footerButtonDisabled]}
                >
                    <Text style={styles.footerButtonText}>{loading ? 'Salvando...' : 'Salvar'}</Text>
                </TouchableOpacity>
            }
        >
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.groupCard}>
                    {/* Nome */}
                    <View style={styles.itemContent}>
                        <Text style={styles.itemTitle}>Nome</Text>
                        <TextInput
                            style={styles.inputRight}
                            value={nameInput}
                            onChangeText={setName}
                            placeholder="Ex: Reserva de Emergência"
                            placeholderTextColor="#555"
                            textAlign="right"
                        />
                    </View>
                    <View style={styles.separator} />

                    {/* Meta */}
                    <View style={styles.itemContent}>
                        <Text style={styles.itemTitle}>Meta</Text>
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
                    <View style={styles.separator} />

                    {/* Prazo */}
                    <View style={styles.itemContent}>
                        <Text style={styles.itemTitle}>Prazo</Text>
                        <TextInput
                            style={styles.inputRight}
                            value={dateStr}
                            onChangeText={handleChangeDate}
                            placeholder="DD/MM/AAAA (opcional)"
                            placeholderTextColor="#555"
                            keyboardType="numeric"
                            textAlign="right"
                            maxLength={10}
                        />
                    </View>
                </View>
            </ScrollView>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        paddingBottom: 20,
    },
    groupCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        overflow: 'hidden',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    itemTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '400',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
        marginLeft: 16,
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 16,
        minWidth: 120,
        padding: 0,
        textAlign: 'right',
    },
    footerButton: {
        backgroundColor: '#D97757',
        borderRadius: 14,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerButtonDisabled: {
        opacity: 0.5,
    },
    footerButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
});
