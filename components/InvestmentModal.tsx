import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { Calendar, DollarSign, FileText } from 'lucide-react-native';
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

    // Reset or Populate form when modal opens
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

        onSave({
            name: nameInput,
            targetAmount: rawAmount,
            deadline: formattedDeadline
        });
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

    // Simple date formatter (DD/MM/YYYY)
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

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title={title || "Nova Caixinha"}
            headerRight={
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!nameInput || !amountStr || loading}
                    style={{ opacity: (!nameInput || !amountStr || loading) ? 0.5 : 1 }}
                >
                    <Text style={styles.headerSaveText}>{loading ? 'Salvando...' : 'Salvar'}</Text>
                </TouchableOpacity>
            }
        >
            <ScrollView 
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.container}>
                    <View style={styles.sectionCard}>
                        {/* Nome */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <FileText size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
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
                            </View>
                            <View style={styles.itemSeparator} />
                        </View>

                        {/* Valor Alvo */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <DollarSign size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
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
                            </View>
                            <View style={styles.itemSeparator} />
                        </View>

                        {/* Data Limite */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <Calendar size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Prazo (Opcional)</Text>
                                    <TextInput
                                        style={styles.inputRight}
                                        value={dateStr}
                                        onChangeText={handleChangeDate}
                                        placeholder="DD/MM/AAAA"
                                        placeholderTextColor="#555"
                                        keyboardType="numeric"
                                        textAlign="right"
                                        maxLength={10}
                                    />
                                </View>
                            </View>
                        </View>
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
    container: {
        gap: 20,
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
        position: 'relative',
        backgroundColor: '#1A1A1A',
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
    headerSaveText: {
        color: '#d97757',
        fontWeight: '600',
        fontSize: 16
    },
});
