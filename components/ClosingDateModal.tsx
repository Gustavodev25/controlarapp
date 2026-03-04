import { FileText, Info, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ModalPadrao } from './ui/ModalPadrao';

export interface ClosingDateItem {
    id: string; // e.g. referenceMonth
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
    bankName?: string;
    onRefreshBank?: () => Promise<void>;
    originalCloseDate?: string | null;
    originalDueDate?: string | null;
}

export function ClosingDateModal({
    visible,
    onClose,
    onSave,
    items,
    hasBankData,
    bankName,
    onRefreshBank,
    originalCloseDate,
    originalDueDate
}: ClosingDateModalProps) {
    const [days, setDays] = useState<Record<string, string>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);

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
                        updates.push({ id: item.id, exactDate: newDate });
                    }
                }
            }
        });

        await onSave(updates);
        onClose();
    };

    const handleDayChange = (id: string, text: string) => {
        setDays(prev => ({ ...prev, [id]: text.replace(/\D/g, '') }));
    };

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Editar fechamento"
            headerRight={
                !!onRefreshBank && (
                    <TouchableOpacity
                        onPress={async () => {
                            setIsRefreshing(true);
                            if (onRefreshBank) await onRefreshBank();
                            setIsRefreshing(false);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                        disabled={isRefreshing}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <RefreshCw size={14} color="#0A84FF" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#0A84FF', fontSize: 13, fontWeight: '500' }}>
                            {isRefreshing ? 'Buscando...' : 'Buscar'}
                        </Text>
                    </TouchableOpacity>
                )
            }
        >
            <View style={styles.container}>
                <Text style={styles.closingModalSubtitle}>
                    Defina o dia exato do fechamento para as faturas abaixo.
                </Text>

                <View style={styles.infoBox}>
                    <Info size={16} color="#8E8E93" style={{ marginRight: 8, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
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

                <View style={styles.sectionCard}>
                    {items.map((item, index) => (
                        <View key={item.id}>
                            <View style={styles.itemContainer}>
                                <View style={styles.itemIconContainer}>
                                    <FileText size={20} color="#E0E0E0" />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={styles.itemTitle}>{item.label}</Text>
                                            {item.subLabel ? (
                                                <Text style={styles.itemSubLabel}>{item.subLabel}</Text>
                                            ) : null}
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ color: '#909090', fontSize: 16, marginRight: 8 }}>Dia</Text>
                                            <TextInput
                                                style={styles.inputRight}
                                                value={days[item.id] || ''}
                                                onChangeText={(text) => handleDayChange(item.id, text)}
                                                placeholder="Ex: 25"
                                                placeholderTextColor="#555"
                                                keyboardType="numeric"
                                                textAlign="right"
                                                maxLength={2}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>
                            {index < items.length - 1 && <View style={styles.itemSeparator} />}
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.closingModalSaveButton}
                    onPress={handleSave}
                    activeOpacity={0.85}
                >
                    <Text style={styles.closingModalSaveButtonText}>Salvar</Text>
                </TouchableOpacity>
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    closingModalSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left',
        lineHeight: 20,
        marginBottom: 4,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: -4,
        marginBottom: 8,
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
    itemSubLabel: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
    itemSeparator: {
        height: 1,
        backgroundColor: '#2A2A2A',
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 16,
        minWidth: 40,
        padding: 0,
        fontWeight: '600',
    },
    closingModalSaveButton: {
        backgroundColor: '#D97757',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8
    },
    closingModalSaveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

