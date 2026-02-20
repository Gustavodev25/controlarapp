import { BottomModal } from '@/components/ui/BottomModal';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { useCategories } from '@/hooks/use-categories';
import { ArrowDownCircle, ArrowUpCircle, Calendar, CalendarX, DollarSign, FileText, Repeat, Search, Tag } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ReminderModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (data: { title: string; amount: number; date: string; frequency: 'monthly' | 'yearly'; cancellationReminder?: boolean; type: 'income' | 'expense'; category: string }) => void;
    title?: string;
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

export function ReminderModal({ visible, onClose, onSave, title, initialData }: ReminderModalProps) {
    const { categories: categoryGroups } = useCategories();
    const [titleInput, setTitle] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [dateStr, setDateStr] = useState('');
    const [wantsCancellationReminder, setWantsCancellationReminder] = useState(false);
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
                    const [year, month, day] = initialData.date.split('-');
                    formattedDate = `${day}/${month}/${year}`;
                }
                setDateStr(formattedDate);

                // Set toggle based on existence of cancellationDate
                if (initialData.cancellationDate) {
                    setWantsCancellationReminder(true);
                } else {
                    setWantsCancellationReminder(false);
                }

                setIsYearly(initialData.frequency === 'yearly');
                // Assume default expense if not provided in initialData
                setType(initialData.transactionType || 'expense');
                setCategory(initialData.category || 'Outros');
            } else {
                setTitle('');
                setAmountStr('');
                setDateStr('');
                setWantsCancellationReminder(false);
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
            cancellationReminder: wantsCancellationReminder,
            type: type,
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
        // Remove non-numeric characters
        const cleaned = text.replace(/\D/g, '');
        let formatted = cleaned;
        if (cleaned.length > 2) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
        }
        if (cleaned.length > 4) {
            formatted = `${formatted.slice(0, 5)}/${formatted.slice(5, 9)}`;
        }
        // Limit length
        if (formatted.length > 10) formatted = formatted.slice(0, 10);

        setDateStr(formatted);
    };



    return (
        <BottomModal
            visible={visible}
            onClose={onClose}
            title={title || "Novo Lembrete"}
            height="auto"
            rightElement={
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!titleInput || !amountStr || dateStr.length < 10}
                    style={{ opacity: (!titleInput || !amountStr || dateStr.length < 10) ? 0.5 : 1 }}
                >
                    <Text style={styles.headerSaveText}>Salvar</Text>
                </TouchableOpacity>
            }
        >
            <View style={styles.container}>

                {/* Section Card */}
                <View style={styles.sectionCard}>
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
                        <View style={styles.itemSeparator} />
                    </View>

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
                        <View style={styles.itemSeparator} />
                    </View>

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
                        <View style={styles.itemSeparator} />
                    </View>

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
                        {!showCategoryPicker && <View style={styles.itemSeparator} />}
                    </View>

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
                            <View style={styles.itemSeparator} />
                        </View>
                    )}

                    {/* Data de Cancelamento */}
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            <CalendarX size={20} color="#E0E0E0" />
                        </View>
                        <View style={styles.itemRightContainer}>
                            <View style={styles.itemContent}>
                                <View>
                                    <Text style={styles.itemTitle}>Lembrar de cancelar</Text>
                                    <Text style={styles.itemSubtitle}>Avisa 2 dias antes</Text>
                                </View>
                                <ModernSwitch
                                    value={wantsCancellationReminder}
                                    onValueChange={setWantsCancellationReminder}
                                    activeColor="#d97757"
                                    width={46}
                                    height={26}
                                />
                            </View>
                        </View>
                        <View style={styles.itemSeparator} />
                    </View>

                    {/* Tipo (Removido por solicitação: Lembretes sempre serão despesas) */}
                    {/* 
                    <View style={styles.itemContainer}>
                        <View style={styles.itemIconContainer}>
                            {type === 'income' ? (
                                <ArrowUpCircle size={20} color="#E0E0E0" />
                            ) : (
                                <ArrowDownCircle size={20} color="#E0E0E0" />
                            )}
                        </View>
                        <View style={styles.itemRightContainer}>
                            <View style={styles.itemContent}>
                                <View>
                                    <Text style={styles.itemTitle}>Tipo</Text>
                                    <Text style={styles.itemSubtitle}>{type === 'income' ? 'Receita' : 'Despesa'}</Text>
                                </View>
                                <ModernSwitch
                                    value={type === 'income'}
                                    onValueChange={(val) => setType(val ? 'income' : 'expense')}
                                    activeColor="#04D361"
                                    width={46}
                                    height={26}
                                />
                            </View>
                        </View>
                        <View style={styles.itemSeparator} />
                    </View> 
                    */}

                    {/* Frequência */}
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
                </View>

            </View>
        </BottomModal >
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 20,
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
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
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
});
