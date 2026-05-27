import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { AuthButton } from '@/components/ui/AuthButton';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    onSave: (settings: ProjectionSettings) => Promise<void> | void;
    salaryPreview: number;
    valePreview: number;
    includeOpenFinance: boolean;
    onToggleOpenFinance: (value: boolean) => Promise<void> | void;
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
    const [includeSalary, setIncludeSalary] = useState(false);
    const [includeVale, setIncludeVale] = useState(false);
    const [includeReminders, setIncludeReminders] = useState(false);
    const [includeSubscriptions, setIncludeSubscriptions] = useState(false);
    const [localOpenFinance, setLocalOpenFinance] = useState(false);

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
        onClose();

        Promise.resolve(onSave({
            includeSalary,
            includeVale,
            includeReminders,
            includeSubscriptions
        })).catch((error) => {
            console.error('Error saving projections:', error);
        });

        if (localOpenFinance !== includeOpenFinance) {
            Promise.resolve(onToggleOpenFinance(localOpenFinance)).catch((error) => {
                console.error('Error saving open finance toggle:', error);
            });
        }
    };

    const Footer = () => (
        <AuthButton
            title="Salvar Alterações"
            onPress={handleSave}
        />
    );

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Previsões"
            titleAlign="start"
            footer={<Footer />}
        >
            <View style={styles.container}>
                <Text style={styles.description}>
                    Ajuste quais dados devem compor sua projeção de saldo futuro.
                </Text>

                <Text style={styles.sectionTitle}>INTEGRAÇÃO</Text>
                <View style={styles.groupCard}>
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Contas Bancárias</Text>
                            <Text style={styles.itemSubtitle}>Transações automáticas</Text>
                        </View>
                        <ModernSwitch
                            value={localOpenFinance}
                            onValueChange={setLocalOpenFinance}
                        />
                    </View>
                </View>

                <Text style={styles.sectionTitle}>RENDA ESTIMADA</Text>
                <View style={styles.groupCard}>
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Salário Mensal</Text>
                            <Text style={[styles.itemPreview, salaryPreview <= 0 && styles.itemPreviewMuted]}>
                                {salaryPreview > 0
                                    ? `R$ ${salaryPreview.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : 'Não configurado'}
                            </Text>
                        </View>
                        <ModernSwitch
                            value={includeSalary}
                            onValueChange={setIncludeSalary}
                            disabled={salaryPreview <= 0}
                        />
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Vale / Adiantamento</Text>
                            <Text style={[styles.itemPreview, valePreview <= 0 && styles.itemPreviewMuted]}>
                                {valePreview > 0
                                    ? `R$ ${valePreview.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : 'Não configurado'}
                            </Text>
                        </View>
                        <ModernSwitch
                            value={includeVale}
                            onValueChange={setIncludeVale}
                            disabled={valePreview <= 0}
                        />
                    </View>
                </View>

                <Text style={styles.sectionTitle}>GASTOS RECORRENTES</Text>
                <View style={styles.groupCard}>
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Lembretes Pendentes</Text>
                        </View>
                        <ModernSwitch
                            value={includeReminders}
                            onValueChange={setIncludeReminders}
                        />
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Assinaturas</Text>
                        </View>
                        <ModernSwitch
                            value={includeSubscriptions}
                            onValueChange={setIncludeSubscriptions}
                        />
                    </View>
                </View>
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 12,
        paddingBottom: 0,
    },
    description: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 24,
        lineHeight: 18,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        marginLeft: 0,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    groupCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        marginBottom: 24,
        overflow: 'hidden',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
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
    itemPreview: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 1,
    },
    itemPreviewMuted: {
        color: '#5A5A5E',
        fontStyle: 'italic',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
        marginLeft: 0,
    },
});

