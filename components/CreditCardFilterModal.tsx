import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { Calendar, Save, Search, Trash2, X } from 'lucide-react-native';
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

export interface FilterState {
    search: string;
    categories: string[];
    startDate: string;
    endDate: string;
    year: string;
}

interface CreditCardFilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    initialFilters: FilterState;
    categories: string[]; // List of available category keys
    getCategoryName: (key?: string) => string;
    years: string[]; // List of available years
}

export function CreditCardFilterModal({
    visible,
    onClose,
    onApply,
    initialFilters,
    categories,
    getCategoryName,
    years
}: CreditCardFilterModalProps) {
    const [filters, setFilters] = useState<FilterState>(initialFilters);

    useEffect(() => {
        if (visible) {
            setFilters(initialFilters);
        }
    }, [visible, initialFilters]);

    const handleDateChange = (text: string, field: 'startDate' | 'endDate') => {
        let cleaned = text.replace(/\D/g, '');
        if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

        let formatted = cleaned;
        if (cleaned.length >= 3) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
        }
        if (cleaned.length >= 5) {
            formatted = `${formatted.slice(0, 5)}/${cleaned.slice(4)}`;
        }

        setFilters(prev => ({ ...prev, [field]: formatted }));
    };

    const toggleYear = (y: string) => {
        setFilters(prev => ({
            ...prev,
            year: prev.year === y ? '' : y
        }));
    };

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            categories: [],
            startDate: '',
            endDate: '',
            year: ''
        });
    };

    const toggleCategory = (cat: string) => {
        setFilters(prev => {
            const exists = prev.categories.includes(cat);
            return {
                ...prev,
                categories: exists
                    ? prev.categories.filter(c => c !== cat)
                    : [...prev.categories, cat]
            };
        });
    };

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Pesquisar transação"
            titleAlign="start"
            maxHeightRatio={0.9}
            bodyStyle={styles.container}
            footer={(
                <TouchableOpacity onPress={handleApply} style={styles.footerButton}>
                    <Save size={18} color="#FFFFFF" />
                    <Text style={styles.footerButtonText}>Salvar</Text>
                </TouchableOpacity>
            )}
        >

                            {/* Search Bar */}
                            <Text style={styles.sectionHeader}>BUSCAR</Text>
                            <View style={styles.sectionCard}>
                                <View style={styles.inputRow}>
                                    <View style={styles.itemIconContainer}>
                                        <Search size={20} color="#E0E0E0" />
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        value={filters.search}
                                        onChangeText={(t) => setFilters(prev => ({ ...prev, search: t }))}
                                        placeholder="Descrição da compra..."
                                        placeholderTextColor="#666"
                                    />
                                    {filters.search.length > 0 && (
                                        <TouchableOpacity onPress={() => setFilters(prev => ({ ...prev, search: '' }))} style={{ marginRight: 16 }}>
                                            <X size={16} color="#666" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Categories */}
                            <Text style={styles.sectionHeader}>CATEGORIA</Text>
                            <View style={styles.sectionCard}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.scrollContainer}
                                >
                                    {categories.map((cat) => {
                                        const isSelected = filters.categories.includes(cat);
                                        return (
                                            <Pressable
                                                key={cat}
                                                style={[styles.chip, isSelected && styles.chipSelected]}
                                                onPress={() => toggleCategory(cat)}
                                            >
                                                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                                    {getCategoryName(cat)}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Date Range */}
                            <Text style={styles.sectionHeader}>PERÍODO</Text>
                            <View style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center' }]}>
                                <View style={styles.dateInputContainer}>
                                    <View style={[styles.itemIconContainer, { marginLeft: 16, marginRight: 10, width: 28, height: 28 }]}>
                                        <Calendar size={16} color="#E0E0E0" />
                                    </View>
                                    <TextInput
                                        style={[styles.input, { marginRight: 0, fontSize: 15 }]}
                                        value={filters.startDate}
                                        onChangeText={(t) => handleDateChange(t, 'startDate')}
                                        placeholder="Início"
                                        placeholderTextColor="#666"
                                        keyboardType="numeric"
                                        maxLength={10}
                                    />
                                </View>
                                <View style={styles.verticalDivider} />
                                <View style={styles.dateInputContainer}>
                                    <View style={[styles.itemIconContainer, { marginLeft: 10, marginRight: 10, width: 28, height: 28 }]}>
                                        <Calendar size={16} color="#E0E0E0" />
                                    </View>
                                    <TextInput
                                        style={[styles.input, { marginRight: 16, fontSize: 15 }]}
                                        value={filters.endDate}
                                        onChangeText={(t) => handleDateChange(t, 'endDate')}
                                        placeholder="Fim"
                                        placeholderTextColor="#666"
                                        keyboardType="numeric"
                                        maxLength={10}
                                    />
                                </View>
                            </View>

                            {/* Year */}
                            <Text style={styles.sectionHeader}>ANO</Text>
                            <View style={styles.sectionCard}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.scrollContainer}
                                >
                                    {years.map((y) => {
                                        const isSelected = filters.year === y;
                                        return (
                                            <Pressable
                                                key={y}
                                                style={[styles.chip, isSelected && styles.chipSelected]}
                                                onPress={() => toggleYear(y)}
                                            >
                                                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                                    {y}
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

        </ModalPadrao>
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
    container: {
        padding: 20,
        paddingBottom: 40,
    },
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
        height: 56,
    },
    itemIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginLeft: 16,
    },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
        height: '100%',
        marginRight: 16
    },
    scrollContainer: {
        gap: 8,
        padding: 16
    },
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
    dateInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
    },
    verticalDivider: {
        width: 1,
        height: '40%',
        backgroundColor: '#333'
    },

    footerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#D97757',
        borderRadius: 14,
        minHeight: 50,
    },
    footerButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700'
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
