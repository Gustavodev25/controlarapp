import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { Wallet } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Configurações de Renda"
        >
            <View style={styles.container}>
                <View style={styles.sectionCard}>
                    <View style={styles.itemContainer}>
                        <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(4, 211, 97, 0.15)' }]}>
                            <Wallet size={20} color="#04D361" />
                        </View>
                        <View style={styles.itemContent}>
                            <View style={{ flex: 1, paddingRight: 16 }}>
                                <Text style={styles.itemTitle}>Transações de Contas Bancárias</Text>
                                <Text style={styles.itemSubtitle}>
                                    Incluir dados da transação da conta corrente das Contas Bancárias nos cálculos de Receitas e Despesas.
                                </Text>
                            </View>
                            <ModernSwitch
                                value={includeOpenFinance}
                                onValueChange={onToggleOpenFinance}
                                activeColor="#d97757"
                            />
                        </View>
                    </View>
                </View>
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 20,
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
    itemIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemContent: {
        flex: 1,
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
        color: '#8E8E93',
        marginTop: 2,
        lineHeight: 16
    },
});
