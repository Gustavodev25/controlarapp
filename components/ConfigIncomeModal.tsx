import BottomSheet from '@/components/templates/bottom-sheet';
import { BottomSheetMethods } from '@/components/templates/bottom-sheet/types';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface ConfigIncomeModalProps {
    visible: boolean;
    onClose: () => void;
    includeOpenFinance: boolean;
    onToggleOpenFinance: (value: boolean) => void;
}

export function ConfigIncomeModal({
    visible,
    onClose,
    includeOpenFinance,
    onToggleOpenFinance,
}: ConfigIncomeModalProps) {
    const sheetRef = React.useRef<BottomSheetMethods>(null);
    const [isModalMounted, setIsModalMounted] = useState(false);

    useEffect(() => {
        if (visible) {
            setIsModalMounted(true);
            requestAnimationFrame(() => {
                sheetRef.current?.snapToIndex(0);
            });
        } else if (isModalMounted) {
            sheetRef.current?.close();
        }
    }, [visible, isModalMounted]);

    const handleBottomSheetClose = () => {
        setIsModalMounted(false);
        onClose();
    };

    return (
        <Modal visible={isModalMounted} transparent animationType="none" statusBarTranslucent hardwareAccelerated>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    ref={sheetRef}
                    snapPoints={["35%", "45%"]}
                    backgroundColor="#141414"
                    backdropOpacity={0.6}
                    borderRadius={24}
                    onClose={handleBottomSheetClose}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Configurações de Renda</Text>
                        <TouchableOpacity onPress={() => sheetRef.current?.close()}>
                            <X size={20} color="#909090" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.configItemContainer}>
                            <View style={{ flex: 1, paddingRight: 16 }}>
                                <Text style={styles.configItemTitle}>Transações de Contas Bancárias</Text>
                                <Text style={styles.configItemSubtitle}>
                                    Incluir dados da transação da conta corrente das Contas Bancárias nos cálculos de Receitas e Despesas.
                                </Text>
                            </View>
                            <ModernSwitch
                                value={includeOpenFinance}
                                onValueChange={onToggleOpenFinance}
                                activeColor="#d97757"
                                width={50}
                                height={28}
                            />
                        </View>
                    </View>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        backgroundColor: '#141414',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    configItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1C1C1E',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    configItemTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    configItemSubtitle: {
        color: '#909090',
        fontSize: 13,
        lineHeight: 18,
    },
});
