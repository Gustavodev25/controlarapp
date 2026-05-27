import { AuthButton } from '@/components/ui/AuthButton';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export interface RecurrenceFilterState {
    search: string;
    status: string[];
    transactionType: string[];
}

interface RecurrenceFilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: RecurrenceFilterState) => void;
    initialFilters: RecurrenceFilterState;
}

export function RecurrenceFilterModal({
    visible,
    onClose,
    onApply,
    initialFilters
}: RecurrenceFilterModalProps) {
    const [filters, setFilters] = useState<RecurrenceFilterState>(initialFilters);

    useEffect(() => {
        if (visible) {
            setFilters(initialFilters);
        }
    }, [visible, initialFilters]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const clearFilters = () => {
        setFilters({ search: '', status: [], transactionType: [] });
    };

    const toggleStatus = (status: string) => {
        setFilters(prev => {
            const exists = prev.status.includes(status);
            return {
                ...prev,
                status: exists ? prev.status.filter(s => s !== status) : [...prev.status, status]
            };
        });
    };

    const toggleTransactionType = (type: string) => {
        setFilters(prev => {
            const exists = prev.transactionType.includes(type);
            return {
                ...prev,
                transactionType: exists ? prev.transactionType.filter(t => t !== type) : [...prev.transactionType, type]
            };
        });
    };

    const statusOptions = [
        { label: 'Pendente', value: 'pending' },
        { label: 'Feito', value: 'paid' },
        { label: 'Atrasado', value: 'overdue' }
    ];

    const transactionTypeOptions = [
        { label: 'A pagar', value: 'expense' },
        { label: 'A receber', value: 'income' }
    ];

    const Footer = () => (
        <AuthButton
            title="Aplicar Filtros"
            onPress={handleApply}
            isLoading={false}
        />
    );

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Filtrar"
            titleAlign="start"
            footer={<Footer />}
        >
            <View style={styles.container}>
                {/* Search */}
                <Text style={styles.sectionTitle}>BUSCAR</Text>
                <View style={styles.groupCard}>
                    <View style={styles.inputRow}>
                        <Search size={18} color="#8E8E93" style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.input}
                            value={filters.search}
                            onChangeText={(t) => setFilters(prev => ({ ...prev, search: t }))}
                            placeholder="Nome..."
                            placeholderTextColor="#6E6E73"
                        />
                        {filters.search.length > 0 && (
                            <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, search: '' }))}>
                                <X size={16} color="#8E8E93" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Status */}
                <Text style={styles.sectionTitle}>STATUS</Text>
                <View style={styles.groupCard}>
                    <View style={styles.chipsRow}>
                        {statusOptions.map((opt) => {
                            const isSelected = filters.status.includes(opt.value);
                            return (
                                <Pressable
                                    key={opt.value}
                                    style={[styles.chip, isSelected && styles.chipSelected]}
                                    onPress={() => toggleStatus(opt.value)}
                                >
                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                        {opt.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* Transaction Type */}
                <Text style={styles.sectionTitle}>TIPO</Text>
                <View style={styles.groupCard}>
                    <View style={styles.chipsRow}>
                        {transactionTypeOptions.map((opt) => {
                            const isSelected = filters.transactionType.includes(opt.value);
                            return (
                                <Pressable
                                    key={opt.value}
                                    style={[styles.chip, isSelected && styles.chipSelected]}
                                    onPress={() => toggleTransactionType(opt.value)}
                                >
                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                        {opt.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* Clear */}
                <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                    <Text style={styles.clearButtonText}>Limpar filtros</Text>
                </TouchableOpacity>
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 4,
        paddingBottom: 0,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6E6E73',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0,
    },
    groupCard: {
        backgroundColor: 'rgba(28, 28, 30, 0.82)',
        borderRadius: 18,
        marginBottom: 22,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(84, 84, 88, 0.34)',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 48,
    },
    input: {
        flex: 1,
        color: '#F5F5F7',
        fontSize: 16,
        fontWeight: '400',
        padding: 0,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 16,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(84,84,88,0.34)',
    },
    chipSelected: {
        backgroundColor: 'rgba(217, 119, 87, 0.16)',
        borderColor: '#d97757',
    },
    chipText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
    chipTextSelected: {
        color: '#d97757',
        fontWeight: '600',
    },
    clearButton: {
        alignItems: 'center',
        paddingVertical: 12,
        opacity: 0.6,
    },
    clearButtonText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
});
