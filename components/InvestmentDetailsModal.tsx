import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import React, { useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface InvestmentDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    onSaveMovement: (amount: number, type: 'deposit' | 'withdraw') => void;
    onDeleteRequest: () => void;
    onEditRequest: () => void;
    onExtractRequest: () => void;
    investmentName: string;
    currentAmount: number;
    initialView?: 'menu' | 'movement';
}

export function InvestmentDetailsModal({
    visible,
    onClose,
    onSaveMovement,
    onDeleteRequest,
    onEditRequest,
    onExtractRequest,
    investmentName,
    currentAmount,
    initialView = 'menu',
}: InvestmentDetailsModalProps) {
    const [view, setView] = useState<'menu' | 'movement'>(initialView);
    const [amountStr, setAmountStr] = useState('');
    const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');

    useEffect(() => {
        if (visible) {
            setView(initialView);
            setAmountStr('');
            setType('deposit');
        } else {
            Keyboard.dismiss();
        }
    }, [visible]);

    const handleSave = () => {
        const rawAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0');
        if (rawAmount <= 0) return;

        if (type === 'withdraw' && rawAmount > currentAmount) {
            alert('Saldo insuficiente para retirar este valor.');
            return;
        }

        Keyboard.dismiss();
        onSaveMovement(rawAmount, type);
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

    // Menu view
    if (view === 'menu') {
        const titleComponent = investmentName.includes(' • ') ? (
            <View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>
                    {investmentName.split(' • ')[0]}
                </Text>
                <Text style={{ fontSize: 13, color: '#909090', marginTop: 2 }}>
                    {investmentName.split(' • ')[1]}
                </Text>
            </View>
        ) : (
            investmentName
        );

        return (
            <ModalPadrao
                visible={visible}
                onClose={onClose}
                title={titleComponent}
                titleAlign="start"
            >
                <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                    <View style={styles.groupCard}>
                        <TouchableOpacity style={styles.itemContent} onPress={onExtractRequest}>
                            <Text style={styles.itemTitle}>Extrato</Text>
                        </TouchableOpacity>
                        <View style={styles.separator} />

                        <TouchableOpacity style={styles.itemContent} onPress={() => setView('movement')}>
                            <Text style={styles.itemTitle}>Movimentar</Text>
                        </TouchableOpacity>
                        <View style={styles.separator} />

                        <TouchableOpacity style={styles.itemContent} onPress={onEditRequest}>
                            <Text style={styles.itemTitle}>Editar</Text>
                        </TouchableOpacity>
                        <View style={styles.separator} />

                        <View style={styles.itemContent}>
                            <Text style={styles.itemHint}>
                                Segure o card por 5 segundos para excluir
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </ModalPadrao>
        );
    }

    // Movement form view
    return (
        <ModalPadrao
            visible={visible}
            onClose={() => {
                Keyboard.dismiss();
                onClose();
            }}
            title={type === 'deposit' ? 'Guardar Dinheiro' : 'Resgatar Dinheiro'}
            titleAlign="start"
            footer={
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!amountStr}
                    style={[styles.saveButton, !amountStr && styles.saveButtonDisabled]}
                >
                    <Text style={styles.saveButtonText}>Confirmar</Text>
                </TouchableOpacity>
            }
        >
            <ScrollView
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.groupCard}>
                    {/* Valor */}
                    <View style={styles.itemContent}>
                        <Text style={styles.itemTitle}>Valor</Text>
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
                                autoFocus
                            />
                        </View>
                    </View>
                    <View style={styles.separator} />

                    {/* Operação */}
                    <View style={styles.itemContent}>
                        <View>
                            <Text style={styles.itemTitle}>Operação</Text>
                            <Text style={[styles.itemSubtitle, { color: type === 'deposit' ? '#04D361' : '#FF4C4C' }]}>
                                {type === 'deposit' ? 'Guardar dinheiro' : 'Resgatar dinheiro'}
                            </Text>
                        </View>
                        <ModernSwitch
                            value={type === 'deposit'}
                            onValueChange={(val) => setType(val ? 'deposit' : 'withdraw')}
                            activeColor="#04D361"
                            width={46}
                            height={26}
                        />
                    </View>
                </View>
            </ScrollView>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
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
    itemSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 1,
    },
    itemHint: {
        fontSize: 13,
        color: '#8E8E93',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
        marginLeft: 16,
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 16,
        minWidth: 100,
        padding: 0,
        textAlign: 'right',
    },
    saveButton: {
        backgroundColor: '#D97757',
        borderRadius: 14,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
