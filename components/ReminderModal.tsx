import { AuthButton } from '@/components/ui/AuthButton';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { useCategories } from '@/hooks/use-categories';
import { Search } from 'lucide-react-native';
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
    const { categories: categoryGroups, getCategoryName } = useCategories();
    const [titleInput, setTitle] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [dateStr, setDateStr] = useState('');
    const [isYearly, setIsYearly] = useState(false);
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [category, setCategory] = useState('');
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

    useEffect(() => {
        if (visible) {
            if (initialData) {
                setTitle(initialData.title);
                const formattedAmount = initialData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                setAmountStr(formattedAmount);

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
                setType(initialData.transactionType || 'expense');
                setCategory(initialData.category || '');
            } else {
                setTitle('');
                setAmountStr('');
                setDateStr('');
                setIsYearly(false);
                setType('expense');
                setCategory('');
            }

            if (mode === 'subscriptions' && !initialData) {
                const today = new Date();
                const d = String(today.getDate()).padStart(2, '0');
                const m = String(today.getMonth() + 1).padStart(2, '0');
                const y = today.getFullYear();
                setDateStr(`${d}/${m}/${y}`);
            }

            setShowCategoryPicker(false);
            setCategorySearch('');
        }
    }, [visible, initialData, mode]);

    const handleSave = () => {
        const rawAmount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.') || '0');
        if (!titleInput || rawAmount <= 0 || !dateStr) return;

        onSave({
            title: titleInput,
            amount: rawAmount,
            date: dateStr,
            frequency: isYearly ? 'yearly' : 'monthly',
            type,
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

    const handleChangeDate = (text: string) => {
        if (text.length < dateStr.length) {
            setDateStr(text);
            return;
        }

        const cleaned = text.replace(/\D/g, '');
        let formatted = cleaned;

        if (cleaned.length > 2) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
        }
        if (cleaned.length > 4) {
            formatted = `${formatted}/${cleaned.slice(4, 8)}`;
        }

        if (formatted.length > 10) formatted = formatted.slice(0, 10);
        setDateStr(formatted);
    };

    const isSaveDisabled = !titleInput || !amountStr || dateStr.length < 10;

    const Footer = () => (
        <AuthButton
            title="Salvar"
            onPress={handleSave}
            isLoading={false}
            disabled={isSaveDisabled}
        />
    );

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title={title || (initialData ? `Editar ${mode === 'subscriptions' ? 'Assinatura' : 'Lembrete'}` : `Nova ${mode === 'subscriptions' ? 'Assinatura' : 'Lembrete'}`)}
            titleAlign="start"
            presentation="center"
            showHandle={false}
            enableDragToClose={false}
            maxHeightRatio={0.86}
            footer={<Footer />}
        >
            <View style={styles.container}>
                <Text style={styles.sectionTitle}>INFORMAÇÕES</Text>
                <View style={styles.groupCard}>
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Natureza</Text>
                        </View>
                        <View style={styles.typeToggleContainer}>
                            <TouchableOpacity
                                onPress={() => setType('expense')}
                                style={[styles.typeButton, type === 'expense' && styles.typeButtonActiveExpense]}
                            >
                                <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActiveExpense]}>Despesa</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setType('income')}
                                style={[styles.typeButton, type === 'income' && styles.typeButtonActiveIncome]}
                            >
                                <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActiveIncome]}>Receita</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.separator} />

                    {/* Título */}
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Título</Text>
                        </View>
                        <TextInput
                            style={styles.inputRight}
                            value={titleInput}
                            onChangeText={setTitle}
                            placeholder="Ex: Aluguel"
                            placeholderTextColor="#6E6E73"
                            textAlign="right"
                        />
                    </View>
                    <View style={styles.separator} />

                    {/* Valor */}
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Valor</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: amountStr ? '#F5F5F7' : '#6E6E73', fontSize: 16, marginRight: 4 }}>R$</Text>
                            <TextInput
                                style={styles.inputRight}
                                value={amountStr}
                                onChangeText={handleChangeAmount}
                                placeholder="0,00"
                                placeholderTextColor="#6E6E73"
                                keyboardType="numeric"
                                textAlign="right"
                            />
                        </View>
                    </View>

                    {/* Vencimento - Hidden for subscriptions */}
                    {mode !== 'subscriptions' && (
                        <>
                            <View style={styles.separator} />
                            <View style={styles.itemContent}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>Vencimento</Text>
                                </View>
                                <TextInput
                                    style={styles.inputRight}
                                    value={dateStr}
                                    onChangeText={handleChangeDate}
                                    placeholder="DD/MM/AAAA"
                                    placeholderTextColor="#6E6E73"
                                    keyboardType="numeric"
                                    textAlign="right"
                                    maxLength={10}
                                />
                            </View>
                        </>
                    )}

                    {/* Categoria */}
                    <View style={styles.separator} />
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>Categoria</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                            <Text style={styles.categoryValue}>
                                {getCategoryName(category)}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Category Picker */}
                    {showCategoryPicker && (
                        <View style={{ backgroundColor: 'rgba(28,28,30,0.78)', paddingBottom: 16 }}>
                            <View style={styles.separator} />
                            <View style={styles.categorySearchContainer}>
                                <Search size={16} color="#8E8E93" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.categorySearchInput}
                                    placeholder="Buscar categoria..."
                                    placeholderTextColor="#6E6E73"
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
                                            category === cat.key && styles.categoryChipSelected
                                        ]}
                                        onPress={() => {
                                            setCategory(cat.key);
                                            setShowCategoryPicker(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.categoryChipText,
                                            category === cat.key && styles.categoryChipTextSelected
                                        ]}>
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Frequência - Only for subscriptions */}
                    {mode === 'subscriptions' && (
                        <>
                            <View style={styles.separator} />
                            <View style={styles.itemContent}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>Frequência</Text>
                                    <Text style={styles.itemSubtitle}>{isYearly ? 'Anual' : 'Mensal'}</Text>
                                </View>
                                <ModernSwitch
                                    value={isYearly}
                                    onValueChange={setIsYearly}
                                    width={46}
                                    height={26}
                                />
                            </View>
                        </>
                    )}
                </View>
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
        marginBottom: 24,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(84, 84, 88, 0.34)',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    itemTitle: {
        fontSize: 16,
        color: '#F5F5F7',
        fontWeight: '400',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 1,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(84, 84, 88, 0.34)',
    },
    inputRight: {
        color: '#F5F5F7',
        fontSize: 16,
        minWidth: 100,
        padding: 0,
    },
    categoryValue: {
        color: '#d97757',
        fontSize: 16,
        fontWeight: '600',
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(84,84,88,0.34)',
    },
    categoryChipSelected: {
        backgroundColor: 'rgba(217, 119, 87, 0.16)',
        borderColor: '#d97757',
    },
    categoryChipText: {
        color: '#A1A1A6',
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
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 12,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 12,
    },
    categorySearchInput: {
        flex: 1,
        color: '#F5F5F7',
        fontSize: 14,
        padding: 0,
    },
    typeToggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: 2,
    },
    typeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    typeButtonActiveExpense: {
        backgroundColor: 'rgba(255, 69, 58, 0.2)',
    },
    typeButtonActiveIncome: {
        backgroundColor: 'rgba(48, 209, 88, 0.18)',
    },
    typeButtonText: {
        fontSize: 13,
        color: '#8E8E93',
        fontWeight: '500',
    },
    typeButtonTextActiveExpense: {
        color: '#FF453A',
        fontWeight: '700',
    },
    typeButtonTextActiveIncome: {
        color: '#30D158',
        fontWeight: '700',
    },
});
