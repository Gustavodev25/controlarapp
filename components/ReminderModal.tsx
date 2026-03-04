import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { useCategories } from '@/hooks/use-categories';
import { ArrowDownCircle, ArrowUpCircle, Calendar, DollarSign, FileText, Repeat, Search, Tag } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ReminderModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (data: { title: string; amount: number; date: string; frequency: 'monthly' | 'yearly'; cancellationReminder?: boolean; type: 'income' | 'expense'; category: string }) => void;
    title?: string;
    mode?: 'subscriptions' | 'reminders';
    initialData?: {
        title: string;
        amount: number;
        date: string;
        frequency: 'monthly' | 'yearly';
        cancellationDate?: string;
        transactionType?: 'income' | 'expense';
        category?: string;
    } | null;
}

export function ReminderModal({ visible, onClose, onSave, title, initialData, mode = 'reminders' }: ReminderModalProps) {
    const { categories: categoryGroups } = useCategories();
    const [titleInput, setTitle] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [dateStr, setDateStr] = useState('');
    const [isYearly, setIsYearly] = useState(false);
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [category, setCategory] = useState('Outros');
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');

    const allCategories = useMemo(() => {
        return categoryGroups.flatMap(group => group.items);
    }, [categoryGroups]);

    const filteredCategories = useMemo(() => {
        if (!categorySearch) return allCategories;
        return allCategories.filter(cat =>
            cat.label.toLowerCase().includes(categorySearch.toLowerCase())
        );
    }, [allCategories, categorySearch]);

    // Reset or Populate form when modal opens
    useEffect(() => {
        if (visible) {
            if (initialData) {
                setTitle(initialData.title);
                // Format amount to BRL string
                const formattedAmount = initialData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                setAmountStr(formattedAmount);

                // Format date YYYY-MM-DD to DD/MM/YYYY
                let formattedDate = initialData.date;
                if (initialData.date.includes('-')) {
                    const parts = initialData.date.split('-');
                    if (parts.length === 3) {
                        const year = parts[0].trim();
                        const month = parts[1].trim();
                        const day = parts[2].trim();
                        formattedDate = `${day}/${month}/${year}`;
                    }
                }
                setDateStr(formattedDate);


                setIsYearly(initialData.frequency === 'yearly');
                // Assume default expense if not provided in initialData
                setType(initialData.transactionType || 'expense');
                setCategory(initialData.category || 'Outros');
            } else {
                setTitle('');
                setAmountStr('');
                setDateStr('');
                setIsYearly(false);
                setType('expense');
                setCategory('Outros');
            }
            setShowCategoryPicker(false);
            setCategorySearch('');
        }
    }, [visible, initialData]);

    const handleSave = () => {
        const rawAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0');
        if (!titleInput || rawAmount <= 0 || !dateStr) return;

        onSave({
            title: titleInput,
            amount: rawAmount,
            date: dateStr, // In a real app, parsing this to a Date object or ISO string would be better
            frequency: isYearly ? 'yearly' : 'monthly',
            type: mode === 'subscriptions' ? 'expense' : type,
            category: category
        });
        onClose();
    };

    const formatInputCurrency = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (!numbers) return '';
        const amount = parseInt(numbers) / 100;
        return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    };

    const handleChangeAmount = (text: string) => {
        setAmountStr(formatInputCurrency(text));
    };

    // Simple date formatter (DD/MM/YYYY)
    const handleChangeDate = (text: string) => {
        // Se o usuário estiver apagando, permitimos que ele apague livremente
        if (text.length < dateStr.length) {
            setDateStr(text);
            return;
        }

        // Remove non-numeric characters
        const cleaned = text.replace(/\D/g, '');
        let formatted = cleaned;

        if (cleaned.length > 2) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
        }
        if (cleaned.length > 4) {
            formatted = `${formatted}/${cleaned.slice(4, 8)}`;
        }

        // Limit length
        if (formatted.length > 10) formatted = formatted.slice(0, 10);

        setDateStr(formatted);
    };



    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title={title || (initialData ? `Editar ${mode === 'subscriptions' ? 'Assinatura' : 'Lembrete'}` : `Nova ${mode === 'subscriptions' ? 'Assinatura' : 'Lembrete'}`)}
            headerRight={null}
        >
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <Text style={styles.reminderModalSubtitle}>
                        Defina os detalhes do seu {mode === 'subscriptions' ? 'assinatura' : 'lembrete'} abaixo.
                    </Text>

                    <View style={styles.sectionCard}>
                        {/* Natureza (Income/Expense) - Hidden for subscriptions */}
                        {mode === 'reminders' && (
                            <>
                                <View style={styles.itemContainer}>
                                    <View style={styles.itemIconContainer}>
                                        {type === 'expense' ? (
                                            <ArrowDownCircle size={20} color="#FF453A" />
                                        ) : (
                                            <ArrowUpCircle size={20} color="#04D361" />
                                        )}
                                    </View>
                                    <View style={styles.itemRightContainer}>
                                        <View style={styles.itemContent}>
                                            <Text style={styles.itemTitle}>Natureza</Text>
                                            <View style={styles.typeToggleContainer}>
                                                <TouchableOpacity
                                                    onPress={() => setType('expense')}
                                                    style={[
                                                        styles.typeButton,
                                                        type === 'expense' && styles.typeButtonActiveExpense
                                                    ]}
                                                >
                                                    <Text style={[
                                                        styles.typeButtonText,
                                                        type === 'expense' && styles.typeButtonTextActive
                                                    ]}>Despesa</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => setType('income')}
                                                    style={[
                                                        styles.typeButton,
                                                        type === 'income' && styles.typeButtonActiveIncome
                                                    ]}
                                                >
                                                    <Text style={[
                                                        styles.typeButtonText,
                                                        type === 'income' && styles.typeButtonTextActive
                                                    ]}>Receita</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.itemSeparator} />
                            </>
                        )}

                        {/* Título */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <FileText size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Título</Text>
                                    <TextInput
                                        style={styles.inputRight}
                                        value={titleInput}
                                        onChangeText={setTitle}
                                        placeholder="Ex: Aluguel"
                                        placeholderTextColor="#555"
                                        textAlign="right"
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={styles.itemSeparator} />

                        {/* Valor */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <DollarSign size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Valor</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ color: amountStr ? '#FFFFFF' : '#555', fontSize: 16, marginRight: 4 }}>R$</Text>
                                        <TextInput
                                            style={styles.inputRight}
                                            value={amountStr}
                                            onChangeText={handleChangeAmount}
                                            placeholder="0,00"
                                            placeholderTextColor="#555"
                                            keyboardType="numeric"
                                            textAlign="right"
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View style={styles.itemSeparator} />

                        {/* Data */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <Calendar size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Vencimento</Text>
                                    <TextInput
                                        style={styles.inputRight}
                                        value={dateStr}
                                        onChangeText={handleChangeDate}
                                        placeholder="DD/MM/AAAA"
                                        placeholderTextColor="#555"
                                        keyboardType="numeric"
                                        textAlign="right"
                                        maxLength={10}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={styles.itemSeparator} />

                        {/* Categoria */}
                        <View style={styles.itemContainer}>
                            <View style={styles.itemIconContainer}>
                                <Tag size={20} color="#E0E0E0" />
                            </View>
                            <View style={styles.itemRightContainer}>
                                <View style={styles.itemContent}>
                                    <Text style={styles.itemTitle}>Categoria</Text>
                                    <TouchableOpacity onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                                        <Text style={[styles.inputRight, { color: '#D97757', fontWeight: '600' }]}>
                                            {category}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                        {(mode === 'subscriptions' || showCategoryPicker) && <View style={styles.itemSeparator} />}

                        {/* Category Picker (Inline) */}
                        {showCategoryPicker && (
                            <View style={{ backgroundColor: '#1A1A1A', paddingBottom: 16 }}>
                                {/* Search Input */}
                                <View style={styles.categorySearchContainer}>
                                    <Search size={16} color="#666" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={styles.categorySearchInput}
                                        placeholder="Buscar categoria..."
                                        placeholderTextColor="#666"
                                        value={categorySearch}
                                        onChangeText={setCategorySearch}
                                    />
                                </View>

                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                                >
                                    {filteredCategories.map((cat) => (
                                        <TouchableOpacity
                                            key={cat.key}
                                            style={[
                                                styles.categoryChip,
                                                category === cat.label && styles.categoryChipSelected
                                            ]}
                                            onPress={() => {
                                                setCategory(cat.label);
                                                setShowCategoryPicker(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.categoryChipText,
                                                category === cat.label && styles.categoryChipTextSelected
                                            ]}>
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                {mode === 'subscriptions' && showCategoryPicker && <View style={styles.itemSeparator} />}
                            </View>
                        )}


                        {/* Frequência - Only for subscriptions */}
                        {mode === 'subscriptions' && (
                            <View style={styles.itemContainer}>
                                <View style={styles.itemIconContainer}>
                                    <Repeat size={20} color="#E0E0E0" />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <View>
                                            <Text style={styles.itemTitle}>Frequência</Text>
                                            <Text style={styles.itemSubtitle}>{isYearly ? 'Anual' : 'Mensal'}</Text>
                                        </View>
                                        <ModernSwitch
                                            value={isYearly}
                                            onValueChange={setIsYearly}
                                            activeColor="#d97757"
                                            width={46}
                                            height={26}
                                        />
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            (!titleInput || !amountStr || dateStr.length < 10) && { opacity: 0.5 }
                        ]}
                        onPress={handleSave}
                        disabled={!titleInput || !amountStr || dateStr.length < 10}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.saveButtonText}>Salvar</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    reminderModalSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left',
        lineHeight: 20,
        marginBottom: 4,
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
    itemSubtitle: {
        fontSize: 12,
        color: '#909090',
        marginTop: 2,
    },
    itemSeparator: {
        height: 1,
        backgroundColor: '#2A2A2A',
    },
    inputRight: {
        color: '#FFFFFF',
        fontSize: 16,
        minWidth: 100,
        padding: 0,
    },
    headerSaveText: {
        color: '#d97757',
        fontWeight: '600',
        fontSize: 16
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#252525',
        borderWidth: 1,
        borderColor: '#333',
    },
    categoryChipSelected: {
        backgroundColor: 'rgba(217, 119, 87, 0.2)',
        borderColor: '#d97757',
    },
    categoryChipText: {
        color: '#909090',
        fontSize: 13,
        fontWeight: '500',
    },
    categoryChipTextSelected: {
        color: '#d97757',
        fontWeight: '600',
    },
    categorySearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 8,
    },
    categorySearchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 14,
        padding: 0,
    },
    typeToggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#252525',
        borderRadius: 8,
        padding: 2,
    },
    typeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    typeButtonActiveExpense: {
        backgroundColor: 'rgba(255, 69, 58, 0.2)',
    },
    typeButtonActiveIncome: {
        backgroundColor: 'rgba(4, 211, 97, 0.2)',
    },
    typeButtonText: {
        fontSize: 13,
        color: '#888',
        fontWeight: '500',
    },
    typeButtonTextActive: {
        color: '#FFF',
        fontWeight: '700',
    },
});
