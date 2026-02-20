import BottomSheet from '@/components/templates/bottom-sheet';
import { BottomSheetMethods } from '@/components/templates/bottom-sheet/types';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { Banknote, Bell, Calendar, DollarSign, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
}

export function ProjectionsModal({ visible, onClose, currentSettings, onSave, salaryPreview, valePreview }: ProjectionsModalProps) {
    // Local state for form
    const [includeSalary, setIncludeSalary] = useState(false);
    const [includeVale, setIncludeVale] = useState(false);
    const [includeReminders, setIncludeReminders] = useState(false);
    const [includeSubscriptions, setIncludeSubscriptions] = useState(false);

    const sheetRef = React.useRef<BottomSheetMethods>(null);

    const [isModalMounted, setIsModalMounted] = useState(false);

    // Initialize state from props when modal opens
    useEffect(() => {
        if (visible) {
            setIsModalMounted(true);
            setIncludeSalary(currentSettings.includeSalary);
            setIncludeVale(currentSettings.includeVale);
            setIncludeReminders(currentSettings.includeReminders);
            setIncludeSubscriptions(currentSettings.includeSubscriptions);
            // Request animation frame gives Modal time to mount before animating
            requestAnimationFrame(() => {
                sheetRef.current?.snapToIndex(0);
            });
        } else if (isModalMounted) {
            sheetRef.current?.close();
        }
    }, [visible, currentSettings]);

    const handleBottomSheetClose = () => {
        setIsModalMounted(false);
        onClose();
    };

    const handleSave = () => {
        onSave({
            includeSalary,
            includeVale,
            includeReminders,
            includeSubscriptions
        });
        sheetRef.current?.close();
    };

    return (
        <Modal visible={isModalMounted} transparent animationType="none" statusBarTranslucent hardwareAccelerated>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    ref={sheetRef}
                    snapPoints={["80%", "95%"]}
                    backgroundColor="#141414"
                    backdropOpacity={0.6}
                    borderRadius={24}
                    onClose={handleBottomSheetClose}
                >
                    <View style={[styles.header, { paddingHorizontal: 20, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A2A', backgroundColor: '#141414', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 }]}>
                        <Text style={styles.title}>Configurar Previsões</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <TouchableOpacity onPress={handleSave}>
                                <Text style={styles.headerSaveText}>Salvar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => sheetRef.current?.close()}>
                                <X size={20} color="#909090" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                        <Text style={styles.description}>
                            Simule seu saldo futuro incluindo previsões de renda e gastos recorrentes.
                        </Text>

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
                                <View style={styles.itemSeparator} />
                            </View>

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
                                <View style={styles.itemSeparator} />
                            </View>

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

                    </ScrollView>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
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
        gap: 20,
        paddingBottom: 40,
        padding: 20,
    },
    description: {
        color: '#909090',
        fontSize: 14,
        textAlign: 'justify',
        marginBottom: 4
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
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative'
    },
    itemIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
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
        color: '#909090',
        marginTop: 2,
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
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
    headerSaveText: {
        color: '#d97757',
        fontWeight: '600',
        fontSize: 16
    },
    itemPreview: {
        fontSize: 14,
        color: '#909090',
        marginTop: 4,
        fontWeight: '500'
    }
});
