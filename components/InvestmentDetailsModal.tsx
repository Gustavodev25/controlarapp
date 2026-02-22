import { BottomModal } from '@/components/ui/BottomModal';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { ArrowLeftRight, ArrowUpCircle, DollarSign, List, Pencil, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface InvestmentDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    onSaveMovement: (amount: number, type: 'deposit' | 'withdraw') => void;
    onDeleteRequest: () => void;
    onEditRequest: () => void;
    onExtractRequest: () => void;
    investmentName: string;
    currentAmount: number;
}

export function InvestmentDetailsModal({
    visible,
    onClose,
    onSaveMovement,
    onDeleteRequest,
    onEditRequest,
    onExtractRequest,
    investmentName,
    currentAmount
}: InvestmentDetailsModalProps) {
    const [view, setView] = useState<'menu' | 'movement'>('menu');
    const [amountStr, setAmountStr] = useState('');
    const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');

    // Animation shared value (0 for deposit, 1 for withdraw)
    const rotation = useSharedValue(0);

    // Update rotation when type changes
    useEffect(() => {
        rotation.value = withSpring(type === 'deposit' ? 0 : 180, {
            damping: 15,
            stiffness: 120
        });
    }, [type]);

    // Animated style for the icon
    const animatedIconStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }]
        };
    });

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setView('menu');
            setAmountStr('');
            setType('deposit');
            rotation.value = 0;
        } else {
            // Dismiss keyboard when modal closes
            Keyboard.dismiss();
        }
    }, [visible]);

    const handleSave = () => {
        const rawAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0');
        if (rawAmount <= 0) return;

        // Validation for withdrawal
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

    // Render Menu Options
    if (view === 'menu') {
        return (
            <BottomModal
                visible={visible}
                onClose={onClose}
                title={investmentName}
                height="auto"
            >
                <View style={styles.container}>
                    <View style={styles.sectionCard}>
                        {/* Extrato */}
                        <TouchableOpacity style={styles.itemContainer} onPress={onExtractRequest}>
                            <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                                <List size={20} color="#0A84FF" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Extrato</Text>
                                </View>
                            </View>
                            <View style={styles.itemSeparator} />
                        </TouchableOpacity>

                        {/* Movimentar */}
                        <TouchableOpacity style={styles.itemContainer} onPress={() => setView('movement')}>
                            <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(4, 211, 97, 0.15)' }]}>
                                <ArrowLeftRight size={20} color="#04D361" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Movimentar</Text>
                                </View>
                            </View>
                            <View style={styles.itemSeparator} />
                        </TouchableOpacity>

                        {/* Editar */}
                        <TouchableOpacity style={styles.itemContainer} onPress={onEditRequest}>
                            <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
                                <Pencil size={20} color="#FF9F0A" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Editar</Text>
                                </View>
                            </View>
                            <View style={styles.itemSeparator} />
                        </TouchableOpacity>

                        {/* Excluir */}
                        {/* Delete Tutorial (Static) */}
                        <View style={styles.itemContainer}>
                            <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                                <Trash2 size={20} color="#808080" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemTitle, { color: '#808080', fontSize: 13 }]}>
                                        Segure o card por 5 segundos para excluir
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </BottomModal>
        );
    }

    // Render Movement Form
    return (
        <BottomModal
            visible={visible}
            onClose={() => {
                Keyboard.dismiss();
                setView('menu');
            }}
            title={type === 'deposit' ? 'Guardar Dinheiro' : 'Resgatar Dinheiro'}
            height={500}
        >
            <ScrollView
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.container}>
                    <View style={styles.sectionCard}>
                        {/* Valor */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <DollarSign size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
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
                            </View>
                            <View style={styles.itemSeparator} />
                        </View>

                        {/* Tipo de Operação */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <Animated.View style={animatedIconStyle}>
                                    <ArrowUpCircle
                                        size={20}
                                        color={type === 'deposit' ? "#04D361" : "#FF4C4C"}
                                    />
                                </Animated.View>
                            </View>
                            <View style={styles.itemRightContainer}>
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
                        </View>
                    </View>

                    {/* Botão Salvar */}
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            (!amountStr) && { opacity: 0.5 }
                        ]}
                        onPress={handleSave}
                        disabled={!amountStr}
                    >
                        <Text style={styles.saveButtonText}>Confirmar</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </BottomModal>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 20,
    },
    // Form Styles
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
        paddingVertical: 14,
        paddingHorizontal: 16,
        position: 'relative',
        backgroundColor: '#1A1A1A',
    },
    itemIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
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
        fontSize: 15,
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
    saveButton: {
        backgroundColor: '#D97757',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
