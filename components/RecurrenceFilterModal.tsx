import { BottomModal } from '@/components/ui/BottomModal';
import { Save, Search, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export interface RecurrenceFilterState {
    search: string;
    status: string[];
    frequency: string[];
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
        setFilters({
            search: '',
            status: [],
            frequency: []
        });
    };

    const toggleStatus = (status: string) => {
        setFilters(prev => {
            const exists = prev.status.includes(status);
            return {
                ...prev,
                status: exists
                    ? prev.status.filter(s => s !== status)
                    : [...prev.status, status]
            };
        });
    };

    const toggleFrequency = (freq: string) => {
        setFilters(prev => {
            const exists = prev.frequency.includes(freq);
            return {
                ...prev,
                frequency: exists
                    ? prev.frequency.filter(f => f !== freq)
                    : [...prev.frequency, freq]
            };
        });
    };

    const statusOptions = [
        { label: 'Pendente', value: 'pending' },
        { label: 'Pago', value: 'paid' },
        { label: 'Atrasado', value: 'overdue' }
    ];

    const frequencyOptions = [
        { label: 'Mensal', value: 'monthly' },
        { label: 'Anual', value: 'yearly' }
    ];

    return (
        <BottomModal
            visible={visible}
            onClose={onClose}
            title="Filtrar"
            height="auto"
            rightElement={
                <TouchableOpacity onPress={handleApply} style={styles.headerSaveButton}>
                    <Save size={18} color="#D97757" />
                    <Text style={styles.headerSaveText}>Salvar</Text>
                </TouchableOpacity>
            }
        >
            <View style={styles.container}>
                {/* Search Bar */}
                <Text style={styles.sectionHeader}>BUSCAR</Text>
                <View style={styles.sectionCard}>
                    <View style={styles.inputRow}>
                        <Search size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            value={filters.search}
                            onChangeText={(t) => setFilters(prev => ({ ...prev, search: t }))}
                            placeholder="Nome..."
                            placeholderTextColor="#666"
                        />
                        {filters.search.length > 0 && (
                            <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, search: '' }))}>
                                <X size={16} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Status */}
                <Text style={styles.sectionHeader}>STATUS</Text>
                <View style={styles.sectionCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
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
                    </ScrollView>
                </View>

                {/* Frequency */}
                <Text style={styles.sectionHeader}>FREQUÊNCIA</Text>
                <View style={styles.sectionCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
                        {frequencyOptions.map((opt) => {
                            const isSelected = filters.frequency.includes(opt.value);
                            return (
                                <Pressable
                                    key={opt.value}
                                    style={[styles.chip, isSelected && styles.chipSelected]}
                                    onPress={() => toggleFrequency(opt.value)}
                                >
                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                        {opt.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Clear Action */}
                <TouchableOpacity
                    style={styles.clearButtonSimple}
                    onPress={clearFilters}
                >
                    <Trash2 size={16} color="#666" />
                    <Text style={styles.clearButtonTextSimple}>Limpar Filtros</Text>
                </TouchableOpacity>
            </View>
        </BottomModal>
    );
}

const styles = StyleSheet.create({
    container: { paddingBottom: 20 },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginTop: 10,
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        marginBottom: 10
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 56
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
        height: '100%'
    },
    scrollContainer: { gap: 8, padding: 16 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#222',
        borderWidth: 1,
        borderColor: '#333'
    },
    chipSelected: {
        backgroundColor: '#D97757',
        borderColor: '#D97757'
    },
    chipText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500'
    },
    chipTextSelected: {
        color: '#FFF',
        fontWeight: '700'
    },
    headerSaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        paddingHorizontal: 8,
    },
    headerSaveText: {
        color: '#D97757',
        fontSize: 14,
        fontWeight: '600'
    },
    clearButtonSimple: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
        paddingVertical: 12,
        opacity: 0.8
    },
    clearButtonTextSimple: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500'
    }
});
