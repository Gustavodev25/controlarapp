import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { Banknote, Bell, Calendar, DollarSign, Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ProjectionSettings {
    includeSalary: boolean;
    includeVale: boolean;
    includeReminders: boolean;
    includeSubscriptions: boolean;
}

interface ProjectionsModalProps {
    visible: boolean;
    onClose: () => void;
    currentSettings: ProjectionSettings;
    onSave: (settings: ProjectionSettings) => void;
    salaryPreview: number;
    valePreview: number;
    includeOpenFinance: boolean;
    onToggleOpenFinance: (value: boolean) => void;
}

export function ProjectionsModal({
    visible,
    onClose,
    currentSettings,
    onSave,
    salaryPreview,
    valePreview,
    includeOpenFinance,
    onToggleOpenFinance
}: ProjectionsModalProps) {
    // Local state for form
    const [includeSalary, setIncludeSalary] = useState(false);
    const [includeVale, setIncludeVale] = useState(false);
    const [includeReminders, setIncludeReminders] = useState(false);
    const [includeSubscriptions, setIncludeSubscriptions] = useState(false);
    const [localOpenFinance, setLocalOpenFinance] = useState(false);

    // Initialize state from props when modal opens
    useEffect(() => {
        if (visible) {
            setIncludeSalary(currentSettings.includeSalary);
            setIncludeVale(currentSettings.includeVale);
            setIncludeReminders(currentSettings.includeReminders);
            setIncludeSubscriptions(currentSettings.includeSubscriptions);
            setLocalOpenFinance(includeOpenFinance);
        }
    }, [visible, currentSettings, includeOpenFinance]);

    const handleSave = () => {
        onSave({
            includeSalary,
            includeVale,
            includeReminders,
            includeSubscriptions
        });
        if (localOpenFinance !== includeOpenFinance) {
            onToggleOpenFinance(localOpenFinance);
        }
        onClose();
    };

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Configurar Previsões"
        >
            <ScrollView 
                style={{ maxHeight: SCREEN_HEIGHT * 0.65 }} 
                contentContainerStyle={styles.container} 
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                bounces={true}
            >
                <Text style={styles.description}>
                    Simule seu saldo futuro incluindo previsões de renda e gastos recorrentes.
                </Text>

                {/* Section: Integração */}
                <View style={styles.sectionCard}>
                    <Text style={styles.cardTitle}>Integração</Text>
                    <View style={styles.itemContainer}>
                        <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(4, 211, 97, 0.15)' }]}>
                            <Wallet size={20} color="#04D361" />
                        </View>
                        <View style={styles.itemContent}>
                            <View style={{ flex: 1, paddingRight: 16 }}>
                                <Text style={styles.itemTitle}>Contas Bancárias</Text>
                                <Text style={styles.itemSubtitle}>
                                    Incluir transações de contas conectadas
                                </Text>
                            </View>
                            <ModernSwitch
                                value={localOpenFinance}
                                onValueChange={setLocalOpenFinance}
                                activeColor="#d97757"
                            />
                        </View>
                    </View>
                </View>

                {/* Section: Renda Estimada */}
                <View style={styles.sectionCard}>
                    <Text style={styles.cardTitle}>Renda Estimada</Text>

                    {/* Salário */}
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <DollarSign size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemContent}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>Salário Mensal</Text>
                                <Text style={styles.itemPreview}>
                                    {salaryPreview > 0 ? `R$ ${salaryPreview.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não configurado'}
                                </Text>
                            </View>
                            <ModernSwitch
                                value={includeSalary}
                                onValueChange={setIncludeSalary}
                                activeColor="#d97757"
                            />
                        </View>
                    </View>
                    <View style={styles.itemSeparator} />

                    {/* Vale */}
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <Banknote size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemContent}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>Vale / Adiantamento</Text>
                                <Text style={styles.itemPreview}>
                                    {valePreview > 0 ? `R$ ${valePreview.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não configurado'}
                                </Text>
                            </View>
                            <ModernSwitch
                                value={includeVale}
                                onValueChange={setIncludeVale}
                                activeColor="#d97757"
                            />
                        </View>
                    </View>
                </View>

                {/* Section: Gastos Recorrentes */}
                <View style={styles.sectionCard}>
                    <Text style={styles.cardTitle}>Gastos Recorrentes</Text>

                    {/* Lembretes */}
                    <View style={styles.itemContainer}>
                        <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
                            <Bell size={20} color="#FF9F0A" />
                        </View>
                        <View style={styles.itemContent}>
                            <View>
                                <Text style={styles.itemTitle}>Lembretes Pendentes</Text>
                                <Text style={styles.itemSubtitle}>Incluir contas a pagar do mês</Text>
                            </View>
                            <ModernSwitch
                                value={includeReminders}
                                onValueChange={setIncludeReminders}
                                activeColor="#d97757"
                            />
                        </View>
                    </View>
                    <View style={styles.itemSeparator} />

                    {/* Assinaturas */}
                    <View style={styles.itemContainer}>
                        <View style={[styles.itemIconContainer, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                            <Calendar size={20} color="#0A84FF" />
                        </View>
                        <View style={styles.itemContent}>
                            <View>
                                <Text style={styles.itemTitle}>Assinaturas</Text>
                                <Text style={styles.itemSubtitle}>Incluir serviços mensais</Text>
                            </View>
                            <ModernSwitch
                                value={includeSubscriptions}
                                onValueChange={setIncludeSubscriptions}
                                activeColor="#d97757"
                            />
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    activeOpacity={0.85}
                >
                    <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>

            </ScrollView>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    header: {
        width: '100%',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    container: {
        gap: 16,
        paddingBottom: 20,
    },
    description: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left',
        lineHeight: 20,
        marginBottom: 4,
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },
    cardTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#909090',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: 16,
        paddingBottom: 8
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
    },
    itemSeparator: {
        height: 1,
        backgroundColor: '#2A2A2A',
    },
    input: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        minWidth: 100,
        padding: 0,
    },
    inputSmall: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        minWidth: 30,
        padding: 0,
        textAlign: 'center'
    },
    itemPreview: {
        fontSize: 14,
        color: '#909090',
        marginTop: 4,
        fontWeight: '500'
    },
    saveButton: {
        backgroundColor: '#D97757',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
