import { UniversalBackground } from '@/components/UniversalBackground';
import { BottomModal } from '@/components/ui/BottomModal';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { databaseService } from '@/services/firebase';
import { Stack, useRouter } from 'expo-router';
import {
    Banknote,
    Calendar,
    ChevronRight,
    CreditCard,
    DollarSign,
    Percent,
    Plus,
    Trash2,
    Wallet
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    calculateFinancials,
    Discount,
    parseCurrency,
    parseNumber
} from '@/utils/financial-math';

// --- Utilities ---

const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatInputCurrency = (value: string): string => {
    const num = value.replace(/\D/g, '');
    if (!num) return '';
    return (parseInt(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- Custom Hook (Logic) ---

const useFinancialCalculations = (
    baseSalary: string,
    isSalaryExempt: boolean,
    hasAdvance: boolean,
    advanceType: 'percentage' | 'fixed',
    advanceValue: string,
    otherDiscounts: Discount[]
) => {
    return useMemo(() => {
        const salary = parseCurrency(baseSalary);

        let advVal = 0;
        if (advanceType === 'percentage') {
            advVal = parseNumber(advanceValue);
        } else {
            advVal = parseCurrency(advanceValue);
        }

        return calculateFinancials(
            salary,
            isSalaryExempt,
            hasAdvance,
            advanceType,
            advVal,
            otherDiscounts
        );
    }, [baseSalary, isSalaryExempt, hasAdvance, advanceType, advanceValue, otherDiscounts]);
};

// --- Helper Components ---

const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

interface ListRowProps {
    icon: React.ElementType;
    title: string;
    rightComponent?: React.ReactNode;
    subtitle?: string;
    onPress?: () => void;
    showDivider?: boolean;
    isLast?: boolean;
    color?: string;
}

const ListRow = ({ icon: Icon, title, subtitle, rightComponent, onPress, showDivider = true, isLast = false, color = '#E0E0E0' }: ListRowProps) => (
    <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!onPress}
    >
        <View style={styles.itemIconContainer}>
            <Icon size={20} color={color} />
        </View>
        <View style={styles.itemRightContainer}>
            <View style={styles.itemContent}>
                <View>
                    <Text style={styles.itemTitle}>{title}</Text>
                    {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
                </View>
                {rightComponent}
            </View>
        </View>
        {!isLast && showDivider && <View style={styles.itemSeparator} />}
    </TouchableOpacity>
);

const InputRow = ({
    icon: Icon,
    title,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    isLast = false,
    formatCurrency = false
}: {
    icon: React.ElementType,
    title: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
    keyboardType?: any,
    isLast?: boolean,
    formatCurrency?: boolean
}) => (
    <View style={styles.itemContainer}>
        <View style={styles.itemIconContainer}>
            <Icon size={20} color="#E0E0E0" />
        </View>
        <View style={styles.itemRightContainer}>
            <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{title}</Text>
                <TextInput
                    style={styles.inputRight}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#555"
                    keyboardType={keyboardType}
                    textAlign="right"
                />
            </View>
        </View>
        {!isLast && <View style={styles.itemSeparator} />}
    </View>
);

const SmoothTabs = ({
    options,
    value,
    onChange,
    style
}: {
    options: { label: string, value: string }[],
    value: string,
    onChange: (val: string) => void,
    style?: any
}) => {
    const activeIndex = options.findIndex(o => o.value === value);
    const indicatorPosition = useSharedValue(activeIndex);

    useEffect(() => {
        indicatorPosition.value = withTiming(activeIndex, { duration: 250 });
    }, [activeIndex]);

    const indicatorStyle = useAnimatedStyle(() => {
        return {
            left: `${indicatorPosition.value * 50}%`,
        };
    });

    return (
        <View style={[{
            backgroundColor: '#1E1E1E',
            borderRadius: 12,
            padding: 4,
            height: 48,
            width: '100%',
        }, style]}>
            <View style={{ flex: 1, flexDirection: 'row', position: 'relative' }}>
                <Animated.View style={[
                    {
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '50%',
                        backgroundColor: '#352520', // Brownish/Orange dark tint
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#4d302a'
                    },
                    indicatorStyle
                ]} />
                {options.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
                        onPress={() => onChange(option.value)}
                        activeOpacity={0.8}
                    >
                        <Text style={{
                            color: value === option.value ? '#d97757' : '#666',
                            fontWeight: value === option.value ? '700' : '600',
                            fontSize: 14
                        }}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// --- Main Component ---

export default function FinancialSettingsScreen() {
    const router = useRouter();
    const { user, profile, refreshProfile } = useAuthContext();
    const { showSuccess, showError } = useToast();
    const insets = useSafeAreaInsets();

    // State - Income
    const [baseSalary, setBaseSalary] = useState('');
    const [paydayType, setPaydayType] = useState<'5th_business' | 'last_business' | 'last_month' | 'manual'>('5th_business');
    const [paydayDate, setPaydayDate] = useState('1');
    const [isSalaryExempt, setIsSalaryExempt] = useState(false);

    // State - Advance
    const [hasAdvance, setHasAdvance] = useState(false);
    const [advanceType, setAdvanceType] = useState<'percentage' | 'fixed'>('percentage');
    const [advanceValue, setAdvanceValue] = useState('');
    const [advanceDay, setAdvanceDay] = useState('20');
    const [isAdvanceExempt, setIsAdvanceExempt] = useState(false);

    // State - Discounts
    const [otherDiscounts, setOtherDiscounts] = useState<Discount[]>([]);
    const [showDiscountModal, setShowDiscountModal] = useState(false);

    // State - Modals & Pickers
    const [showPaydayModal, setShowPaydayModal] = useState(false);

    // State - New Discount
    const [newDiscountName, setNewDiscountName] = useState('');
    const [newDiscountValue, setNewDiscountValue] = useState('');
    const [newDiscountType, setNewDiscountType] = useState<'fixed' | 'percentage'>('fixed');

    const [isSaving, setIsSaving] = useState(false);

    const calculations = useFinancialCalculations(
        baseSalary,
        isSalaryExempt,
        hasAdvance,
        advanceType,
        advanceValue,
        otherDiscounts
    );

    // Load Data
    useEffect(() => {
        if (user) {
            refreshProfile();
        }
    }, [user]);

    useEffect(() => {
        if (!profile) return;
        const profileData = profile as any;
        const nestedProfile = profileData.profile || {};
        const financialSource = profileData.financial ?? nestedProfile.financial;

        // New format is canonical and must be preferred over legacy duplicated fields.
        if (financialSource) {
            const f = financialSource as any;
            if (f.salary) {
                if (f.salary.base !== undefined) setBaseSalary(Number(f.salary.base || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
                if (f.salary.payday) setPaydayType(f.salary.payday as any);
                if (f.salary.paydayDate) setPaydayDate(f.salary.paydayDate.toString());
                if (f.salary.isExempt !== undefined) setIsSalaryExempt(!!f.salary.isExempt);
            }
            if (f.advance) {
                if (f.advance.enabled !== undefined) setHasAdvance(!!f.advance.enabled);
                if (f.advance.type) setAdvanceType(f.advance.type as any);
                if (f.advance.value !== undefined) {
                    const advanceNumeric = Number(f.advance.value || 0);
                    setAdvanceValue(f.advance.type === 'percentage'
                        ? advanceNumeric.toString().replace('.', ',')
                        : advanceNumeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
                }
                if (f.advance.day) setAdvanceDay(f.advance.day.toString());
                if (f.advance.isExempt !== undefined) setIsAdvanceExempt(!!f.advance.isExempt);
            }
            if (f.discounts && Array.isArray(f.discounts)) {
                setOtherDiscounts(f.discounts.map((d: any) => ({
                    ...d,
                    value: d.type === 'fixed'
                        ? Number(d.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : Number(d.value || 0).toString().replace('.', ',')
                } as any)));
            }
            return;
        }

        const legacyProfile = { ...nestedProfile, ...profileData } as any;
        if (legacyProfile.baseSalary !== undefined) {
            if (legacyProfile.baseSalary) setBaseSalary(Number(legacyProfile.baseSalary || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
            if (legacyProfile.salaryPaymentDay) { setPaydayType('manual'); setPaydayDate(legacyProfile.salaryPaymentDay.toString()); }
            if (legacyProfile.salaryExemptFromDiscounts !== undefined) setIsSalaryExempt(!!legacyProfile.salaryExemptFromDiscounts);
            if (legacyProfile.salaryAdvancePercent > 0 || legacyProfile.salaryAdvanceValue > 0) {
                setHasAdvance(true);
                if (legacyProfile.salaryAdvancePercent > 0) { setAdvanceType('percentage'); setAdvanceValue(legacyProfile.salaryAdvancePercent.toString().replace('.', ',')); }
                else if (legacyProfile.salaryAdvanceValue > 0) { setAdvanceType('fixed'); setAdvanceValue(Number(legacyProfile.salaryAdvanceValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })); }
                if (legacyProfile.salaryAdvanceDay) setAdvanceDay(legacyProfile.salaryAdvanceDay.toString());
            }
        }
    }, [profile]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const financialData = {
                salary: {
                    base: parseCurrency(baseSalary),
                    payday: paydayType,
                    paydayDate: paydayType === 'manual' ? parseInt(paydayDate) : null,
                    isExempt: isSalaryExempt
                },
                advance: {
                    enabled: hasAdvance,
                    type: advanceType,
                    value: advanceType === 'fixed' ? parseCurrency(advanceValue) : parseNumber(advanceValue),
                    day: parseInt(advanceDay),
                    isExempt: isAdvanceExempt
                },
                discounts: otherDiscounts.map(d => ({
                    id: d.id,
                    name: d.name,
                    value: d.type === 'fixed' ? parseCurrency(d.value) : parseNumber(d.value),
                    type: d.type
                }))
            };

            const legacyProfileData = {
                baseSalary: parseCurrency(baseSalary),
                salaryPaymentDay: paydayType === 'manual' ? parseInt(paydayDate) : 0,
                salaryExemptFromDiscounts: isSalaryExempt,
                salaryAdvanceDay: hasAdvance ? parseInt(advanceDay) : 0,
                salaryAdvancePercent: hasAdvance && advanceType === 'percentage' ? parseNumber(advanceValue) : 0,
                salaryAdvanceValue: hasAdvance && advanceType === 'fixed' ? parseCurrency(advanceValue) : 0,
            };

            const result = await databaseService.setUserProfile(user.uid, {
                financial: financialData,
                'profile.baseSalary': legacyProfileData.baseSalary,
                'profile.salaryPaymentDay': legacyProfileData.salaryPaymentDay,
                'profile.salaryExemptFromDiscounts': legacyProfileData.salaryExemptFromDiscounts,
                'profile.salaryAdvanceDay': legacyProfileData.salaryAdvanceDay,
                'profile.salaryAdvancePercent': legacyProfileData.salaryAdvancePercent,
                'profile.salaryAdvanceValue': legacyProfileData.salaryAdvanceValue,
            });

            if (!result.success) throw new Error(result.error || 'Falha ao salvar');
            showSuccess('Configurações salvas com sucesso!');
            await refreshProfile();
            router.back();
        } catch (error: any) {
            showError(`Erro ao salvar: ${error.message || error}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddDiscount = () => {
        if (!newDiscountName || !newDiscountValue) return;
        setOtherDiscounts(prev => [
            ...prev,
            { id: Math.random().toString(), name: newDiscountName, value: newDiscountValue, type: newDiscountType }
        ]);
        setNewDiscountName('');
        setNewDiscountValue('');
        setShowDiscountModal(false);
    };

    const getPaydayLabel = () => {
        switch (paydayType) {
            case '5th_business': return '5º Dia Útil';
            case 'last_business': return 'Último Dia Útil';
            case 'last_month': return 'Último Dia do Mês';
            case 'manual': return `Dia ` + paydayDate;
            default: return 'Selecionar';
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
                <UniversalBackground
                    backgroundColor="#0C0C0C"
                    glowSize={350}
                    height={280}
                    showParticles={true}
                    particleCount={15}
                />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1, zIndex: 5 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.backButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Financeiro</Text>

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={isSaving}
                            style={styles.headerSaveButton}
                        >
                            <Text style={[styles.headerSaveText, isSaving && { opacity: 0.5 }]}>
                                {isSaving ? 'Salvando...' : 'Salvar'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* 1. Renda Mensal */}
                    <SectionHeader title="RENDA MENSAL" />
                    <View style={styles.sectionCard}>
                        {/* Salário */}
                        <InputRow
                            icon={DollarSign}
                            title="Salário Base"
                            value={baseSalary}
                            onChangeText={(t) => setBaseSalary(formatInputCurrency(t))}
                            placeholder="R$ 0,00"
                            keyboardType="numeric"
                        />

                        {/* Dia Pagamento */}
                        <ListRow
                            icon={Calendar}
                            title="Dia do Pagamento"
                            rightComponent={
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.valueText}>{getPaydayLabel()}</Text>
                                    <ChevronRight size={20} color="#666" />
                                </View>
                            }
                            onPress={() => setShowPaydayModal(true)}
                        />

                        {/* Isenção */}
                        <ListRow
                            icon={Banknote}
                            title="Isenção de Impostos"
                            isLast={true}
                            rightComponent={
                                <ModernSwitch
                                    value={isSalaryExempt}
                                    onValueChange={setIsSalaryExempt}
                                    activeColor="#d97757"
                                    width={46}
                                    height={26}
                                />
                            }
                            onPress={() => setIsSalaryExempt(!isSalaryExempt)}
                        />
                    </View>

                    <Text style={styles.sectionFooterText}>
                        Ative a isenção caso receba o valor bruto sem descontos (ex: PJ, MEI).
                    </Text>

                    {/* 2. Adiantamento */}
                    <SectionHeader title="ADIANTAMENTO (VALE)" />
                    <View style={styles.sectionCard}>
                        <ListRow
                            icon={Wallet}
                            title="Recebo Adiantamento"
                            isLast={!hasAdvance}
                            rightComponent={
                                <ModernSwitch
                                    value={hasAdvance}
                                    onValueChange={setHasAdvance}
                                    activeColor="#d97757"
                                    width={46}
                                    height={26}
                                />
                            }
                            onPress={() => setHasAdvance(!hasAdvance)}
                        />

                        {hasAdvance && (
                            <>
                                {/* Type Selector - Inline */}
                                <View style={styles.inlinePadding}>
                                    <SmoothTabs
                                        options={[
                                            { label: '% do Salário', value: 'percentage' },
                                            { label: 'Valor Fixo', value: 'fixed' }
                                        ]}
                                        value={advanceType}
                                        onChange={(v) => setAdvanceType(v as any)}
                                    />
                                </View>

                                <InputRow
                                    icon={advanceType === 'percentage' ? Percent : DollarSign}
                                    title={advanceType === 'percentage' ? "Porcentagem" : "Valor"}
                                    value={advanceValue}
                                    onChangeText={(t) => advanceType === 'percentage' ? setAdvanceValue(t) : setAdvanceValue(formatInputCurrency(t))}
                                    placeholder={advanceType === 'percentage' ? "Ex: 40" : "R$ 0,00"}
                                    keyboardType="numeric"
                                />

                                <InputRow
                                    icon={Calendar}
                                    title="Dia do Recebimento"
                                    value={advanceDay}
                                    onChangeText={setAdvanceDay}
                                    placeholder="Ex: 20"
                                    keyboardType="numeric"
                                    isLast={true}
                                />
                            </>
                        )}
                    </View>

                    {/* 3. Descontos */}
                    <SectionHeader title="OUTROS DESCONTOS" />
                    <View style={styles.sectionCard}>
                        <ListRow
                            icon={Plus}
                            title="Adicionar Desconto"
                            color="#d97757"
                            onPress={() => setShowDiscountModal(true)}
                            rightComponent={<ChevronRight size={20} color="#666" />}
                            isLast={otherDiscounts.length === 0}
                        />

                        {otherDiscounts.map((discount, index) => (
                            <ListRow
                                key={discount.id}
                                icon={CreditCard}
                                title={discount.name}
                                subtitle={discount.type === 'fixed'
                                    ? discount.value
                                    : `${discount.value}% (${formatCurrency(calculations.grossSalary * (parseFloat(discount.value.replace(',', '.')) / 100))})`
                                }
                                showDivider={index !== otherDiscounts.length - 1}
                                isLast={index === otherDiscounts.length - 1}
                                rightComponent={
                                    <TouchableOpacity onPress={(e) => {
                                        e.stopPropagation();
                                        setOtherDiscounts(prev => prev.filter(d => d.id !== discount.id));
                                    }}>
                                        <Trash2 size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                }
                            />
                        ))}
                    </View>

                    {/* 4. Resumo */}
                    <SectionHeader title="PROJEÇÃO MENSAL" />
                    <View style={styles.sectionCard}>
                        <View style={styles.cardPadding}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Salário Bruto</Text>
                                <Text style={styles.summaryValuePositive}>{formatCurrency(calculations.grossSalary)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>INSS</Text>
                                <Text style={styles.summaryValueNegative}>- {formatCurrency(calculations.inss)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>IRRF</Text>
                                <Text style={styles.summaryValueNegative}>- {formatCurrency(calculations.irrf)}</Text>
                            </View>
                            {hasAdvance && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Adiantamento</Text>
                                    <Text style={styles.summaryValueNegative}>- {formatCurrency(calculations.advance)}</Text>
                                </View>
                            )}
                            {calculations.otherDiscountsTotal > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Outros</Text>
                                    <Text style={styles.summaryValueNegative}>- {formatCurrency(calculations.otherDiscountsTotal)}</Text>
                                </View>
                            )}

                            <View style={styles.summaryDivider} />

                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Líquido Estimado</Text>
                                <Text style={styles.totalValue}>{formatCurrency(calculations.netSalary)}</Text>
                            </View>
                        </View>
                    </View>



                </ScrollView>
            </KeyboardAvoidingView>

            {/* Discount Modal */}
            <BottomModal
                visible={showDiscountModal}
                onClose={() => setShowDiscountModal(false)}
                title="Novo Desconto"
                height="auto"
                rightElement={
                    <TouchableOpacity onPress={handleAddDiscount} style={styles.headerSaveButton}>
                        <Text style={styles.headerSaveText}>Adicionar</Text>
                    </TouchableOpacity>
                }
            >
                <View style={{ gap: 20 }}>
                    <View>
                        <Text style={styles.modalLabel}>NOME DO DESCONTO</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newDiscountName}
                            onChangeText={setNewDiscountName}
                            placeholder="Ex: Plano de Saúde"
                            placeholderTextColor="#555"
                        />
                    </View>

                    <SmoothTabs
                        value={newDiscountType}
                        onChange={(v) => setNewDiscountType(v as any)}
                        options={[
                            { label: 'Valor (R$)', value: 'fixed' },
                            { label: 'Porcentagem (%)', value: 'percentage' }
                        ]}
                    />

                    <View>
                        <Text style={styles.modalLabel}>
                            {newDiscountType === 'fixed' ? 'VALOR A DESCONTAR' : 'PORCENTAGEM DO DESCONTO'}
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newDiscountValue}
                            onChangeText={(t) => newDiscountType === 'percentage' ? setNewDiscountValue(t) : setNewDiscountValue(formatInputCurrency(t))}
                            keyboardType="numeric"
                            placeholder={newDiscountType === 'percentage' ? "Ex: 5" : "R$ 0,00"}
                            placeholderTextColor="#555"
                        />
                    </View>

                </View>
            </BottomModal>

            {/* Payday Modal */}
            <BottomModal
                visible={showPaydayModal}
                onClose={() => setShowPaydayModal(false)}
                title="Dia do Pagamento"
                height="auto"
                rightElement={
                    paydayType === 'manual' ? (
                        <TouchableOpacity onPress={() => setShowPaydayModal(false)} style={styles.headerSaveButton}>
                            <Text style={styles.headerSaveText}>Confirmar</Text>
                        </TouchableOpacity>
                    ) : null
                }
            >
                <View style={{ gap: 0, backgroundColor: '#1A1A1A', borderRadius: 16, overflow: 'hidden' }}>
                    {[
                        { label: '5º Dia Útil', value: '5th_business' },
                        { label: 'Último Dia Útil', value: 'last_business' },
                        { label: 'Último Dia do Mês', value: 'last_month' },
                        { label: 'Dia Fixo (Manual)', value: 'manual' }
                    ].map((opt, index, arr) => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[
                                styles.modalOption,
                                {
                                    borderBottomWidth: index === arr.length - 1 ? 0 : 1,
                                    borderBottomColor: '#333',
                                    paddingVertical: 16,
                                    paddingHorizontal: 16
                                }
                            ]}
                            onPress={() => {
                                setPaydayType(opt.value as any);
                                if (opt.value !== 'manual') {
                                    setShowPaydayModal(false);
                                }
                            }}
                        >
                            <Text style={[
                                styles.modalOptionText,
                                paydayType === opt.value && styles.modalOptionTextSelected
                            ]}>{opt.label}</Text>
                            {paydayType === opt.value && <View style={styles.checkCircle}><View style={styles.checkInner} /></View>}
                        </TouchableOpacity>
                    ))}
                </View>

                {paydayType === 'manual' && (
                    <Animated.View entering={FadeIn} style={{ marginTop: 24 }}>
                        <Text style={styles.modalLabel}>DIA DO MÊS</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={paydayDate}
                            onChangeText={setPaydayDate}
                            placeholder="Dia do mês (1-31)"
                            placeholderTextColor="#555"
                            keyboardType="numeric"
                            maxLength={2}
                            autoFocus={true}
                        />
                    </Animated.View>
                )}
            </BottomModal>

        </View>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0C0C0C' },
    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { fontSize: 20, fontWeight: '600', color: '#E0E0E0' },
    headerSaveButton: { padding: 8 },
    headerSaveText: { color: '#d97757', fontWeight: '600', fontSize: 16 },
    scrollContent: { paddingBottom: 40, paddingHorizontal: 20 },

    // Check Circle
    checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d97757', justifyContent: 'center', alignItems: 'center' },
    checkInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d97757' },

    // Section
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },
    sectionFooterText: {
        fontSize: 12,
        color: '#666',
        marginTop: 8,
        marginLeft: 16,
        lineHeight: 16
    },
    cardPadding: { padding: 16 },

    // List Items
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
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#2A2A2A',
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
    valueText: {
        fontSize: 16,
        color: '#8E8E93',
        marginRight: 8
    },
    inputRight: {
        fontSize: 16,
        color: '#FFFFFF',
        textAlign: 'right',
        minWidth: 100,
        padding: 0
    },

    inlinePadding: { padding: 16, paddingBottom: 0 },

    // Summary
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    summaryLabel: { color: '#888', fontSize: 14 },
    summaryValuePositive: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
    summaryValueNegative: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
    summaryDivider: { height: 1, backgroundColor: '#333', marginVertical: 12 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
    totalValue: { color: '#d97757', fontSize: 20, fontWeight: 'bold' },

    // Modals
    modalInput: {
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#262626'
    },
    modalLabel: {
        color: '#909090',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    actionButton: {
        backgroundColor: '#d97757',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16
    },

    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalOptionSelected: { backgroundColor: '#252525' },
    modalOptionText: { fontSize: 16, color: '#ccc' },
    modalOptionTextSelected: { color: '#fff', fontWeight: '600' },
});
