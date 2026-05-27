import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthButton } from './ui/AuthButton';
import { ModalPadrao } from './ui/ModalPadrao';

export interface ClosingDateItem {
    id: string;
    monthKey?: string; // e.g. referenceMonth (YYYY-MM)
    label: string;
    subLabel?: string;
    currentDate: string;
}

interface ClosingDateModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (updates: { id: string, exactDate: string }[]) => Promise<void>;
    items: ClosingDateItem[];
    hasBankData?: boolean;
    onRefreshBank?: () => Promise<void> | void;
    bankName?: string;
    originalCloseDate?: string | null;
    originalDueDate?: string | null;
}

export function ClosingDateModal({
    visible,
    onClose,
    onSave,
    items,
    bankName,
    originalCloseDate,
    originalDueDate
}: ClosingDateModalProps) {
    const [days, setDays] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);


    useEffect(() => {
        if (visible) {
            const initialDays: Record<string, string> = {};
            items.forEach(item => {
                if (item.currentDate) {
                    const parts = item.currentDate.split('-');
                    if (parts.length === 3) {
                        initialDays[item.id] = parts[2];
                    }
                }
            });
            setDays(initialDays);
            setIsSaving(false);
        }
    }, [visible, items]);

    const handleSave = async () => {
        const updates: { id: string, exactDate: string }[] = [];

        items.forEach(item => {
            const dayValue = days[item.id];
            if (dayValue) {
                const d = parseInt(dayValue, 10);
                if (!isNaN(d) && d >= 1 && d <= 31) {
                    const parts = item.currentDate.split('-');
                    if (parts.length === 3) {
                        const newDate = `${parts[0]}-${parts[1]}-${String(d).padStart(2, '0')}`;
                        updates.push({ id: item.monthKey || item.id, exactDate: newDate });
                    }
                }
            }
        });

        setIsSaving(true);
        try {
            await onSave(updates);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const handleDayChange = (id: string, text: string) => {
        setDays(prev => ({ ...prev, [id]: text.replace(/\D/g, '') }));
    };

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Editar fechamento"
            titleAlign="start"
            footer={
                <AuthButton
                    title="Salvar"
                    onPress={handleSave}
                    isLoading={isSaving}
                />
            }
        >
            <View style={styles.container}>
                <Text style={styles.closingModalSubtitle}>
                    Defina o dia exato do fechamento para as faturas abaixo.
                </Text>

                <Text style={styles.sectionTitle}>ORIGEM DOS DADOS</Text>
                <View style={styles.groupCard}>
                    <View style={styles.infoContent}>
                        {originalCloseDate ? (
                            <Text style={styles.infoBoxText}>
                                Obtivemos o fechamento (<Text style={styles.boldDate}>{originalCloseDate}</Text>) e o vencimento (<Text style={styles.boldDate}>{originalDueDate || 'Não informado'}</Text>) enviados pelo seu banco {bankName ? `(${bankName})` : ''}.
                            </Text>
                        ) : originalDueDate ? (
                            <Text style={styles.infoBoxText}>
                                Obtivemos apenas o vencimento (<Text style={styles.boldDate}>{originalDueDate}</Text>). O seu banco {bankName ? `(${bankName}) ` : ''}não forneceu o fechamento. As datas foram projetadas e podem ser ajustadas manualmente.
                            </Text>
                        ) : (
                            <Text style={styles.infoBoxText}>
                                Não foi possível obter as datas originais do seu banco {bankName ? `(${bankName}) ` : ''}. Elas foram projetadas automaticamente e podem ser ajustadas.
                            </Text>
                        )}
                    </View>
                </View>

                <Text style={styles.sectionTitle}>FECHAMENTO</Text>
                <View style={styles.groupCard}>
                    {items.map((item, index) => (
                        <View key={item.id}>
                            <View style={styles.itemContent}>
                                <View style={styles.itemTextBlock}>
                                    <Text style={styles.itemTitle}>{item.label}</Text>
                                    {item.subLabel ? (
                                        <Text style={styles.itemSubLabel}>{item.subLabel}</Text>
                                    ) : null}
                                </View>

                                <View style={styles.dayInputGroup}>
                                    <Text style={styles.dayLabel}>Dia</Text>
                                    <TextInput
                                        style={styles.inputRight}
                                        value={days[item.id] || ''}
                                        onChangeText={(text) => handleDayChange(item.id, text)}
                                        placeholder="25"
                                        placeholderTextColor="#636366"
                                        keyboardType="numeric"
                                        textAlign="center"
                                        maxLength={2}
                                    />
                                </View>
                            </View>
                            {index < items.length - 1 && <View style={styles.itemSeparator} />}
                        </View>
                    ))}
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
    closingModalSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left',
        lineHeight: 18,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
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
    infoContent: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    infoBoxText: {
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
    },
    boldDate: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 60,
    },
    itemTextBlock: {
        flex: 1,
        marginRight: 12,
    },
    itemTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '400',
    },
    itemSubLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 1,
    },
    dayInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dayLabel: {
        color: '#8E8E93',
        fontSize: 15,
    },
    itemSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
        marginLeft: 16,
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 17,
        width: 44,
        height: 34,
        paddingVertical: 0,
        paddingHorizontal: 0,
        borderRadius: 8,
        backgroundColor: '#2C2C2E',
    },
});

