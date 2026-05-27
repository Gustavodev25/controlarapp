import { UniversalBackground } from '@/components/UniversalBackground';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { databaseService } from '@/services/firebase';
import { safeBack } from '@/utils/navigation';
import { Stack, useRouter } from 'expo-router';
import {
    ChevronRight,
    Info,
    Trash2,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    title: string;
    rightComponent?: React.ReactNode;
    subtitle?: string;
    onPress?: () => void;
    showDivider?: boolean;
    isLast?: boolean;
}

const ListRow = ({ title, subtitle, rightComponent, onPress, showDivider = true, isLast = false }: ListRowProps) => (
    <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!onPress}
    >
        <View style={styles.itemLeft}>
            <Text style={styles.itemTitle}>{title}</Text>
            {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
        </View>
        {rightComponent}
        {!isLast && showDivider && <View style={styles.itemSeparator} />}
    </TouchableOpacity>
);

const InputRow = ({
    title,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    isLast = false,
}: {
    title: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
    keyboardType?: any,
    isLast?: boolean,
    formatCurrency?: boolean
}) => (
    <View style={styles.itemContainer}>
        <Text style={styles.itemTitle}>{title}</Text>
        <TextInput
            style={styles.inputRight}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#444"
            keyboardType={keyboardType}
            textAlign="right"
        />
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
            backgroundColor: '#161616',
            borderRadius: 10,
            padding: 3,
            height: 42,
            width: '100%',
        }, style]}>
            <View style={{ flex: 1, flexDirection: 'row', position: 'relative' }}>
                <Animated.View style={[
                    {
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '50%',
                        backgroundColor: '#222',
                        borderRadius: 8,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: '#2A2A2A',
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
                            color: value === option.value ? '#E8E8EA' : '#555',
                            fontWeight: value === option.value ? '500' : '400',
                            fontSize: 13,
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

    const originalSnapshot = useRef<string>('');

    const currentSnapshot = JSON.stringify({
        baseSalary, paydayType, paydayDate, isSalaryExempt,
        hasAdvance, advanceType, advanceValue, advanceDay, isAdvanceExempt,
        otherDiscounts: otherDiscounts.map(d => ({ id: d.id, name: d.name, value: d.value, type: d.type }))
    });

    const hasChanges = originalSnapshot.current !== '' && currentSnapshot !== originalSnapshot.current;

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
            setTimeout(() => {
                originalSnapshot.current = JSON.stringify({
                    baseSalary: f.salary?.base !== undefined ? Number(f.salary.base || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
                    paydayType: f.salary?.payday || '5th_business',
                    paydayDate: f.salary?.paydayDate?.toString() || '1',
                    isSalaryExempt: !!f.salary?.isExempt,
                    hasAdvance: !!f.advance?.enabled,
                    advanceType: f.advance?.type || 'percentage',
                    advanceValue: f.advance?.value !== undefined ? (f.advance.type === 'percentage' ? Number(f.advance.value || 0).toString().replace('.', ',') : Number(f.advance.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })) : '',
                    advanceDay: f.advance?.day?.toString() || '20',
                    isAdvanceExempt: !!f.advance?.isExempt,
                    otherDiscounts: (f.discounts || []).map((d: any) => ({ id: d.id, name: d.name, value: d.type === 'fixed' ? Number(d.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : Number(d.value || 0).toString().replace('.', ','), type: d.type }))
                });
            }, 0);
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
            originalSnapshot.current = currentSnapshot;
            await refreshProfile();
            safeBack(router);
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
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
                <UniversalBackground backgroundColor="#0C0C0C" glowSize={350} height={280} />
            </View>

            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => safeBack(router)}
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ChevronRight size={24} color="#E0E0E0" style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Financeiro</Text>
                    <View style={styles.headerSpacer} />
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: hasChanges ? 100 : 40 }]}
                    showsVerticalScrollIndicator={false}
                >

                    {/* 1. Renda Mensal */}
                    <SectionHeader title="RENDA MENSAL" />
                    <View style={styles.sectionCard}>
                        {/* Salário */}
                        <InputRow
                            title="Salário Base"
                            value={baseSalary}
                            onChangeText={(t) => setBaseSalary(formatInputCurrency(t))}
                            placeholder="R$ 0,00"
                            keyboardType="numeric"
                        />

                        {/* Dia Pagamento */}
                        <ListRow
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
                            title="Isenção de Impostos"
                            isLast={true}
                            rightComponent={
                                <ModernSwitch
                                    value={isSalaryExempt}
                                    onValueChange={setIsSalaryExempt}
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
                            title="Recebo Adiantamento"
                            isLast={!hasAdvance}
                            rightComponent={
                                <ModernSwitch
                                    value={hasAdvance}
                                    onValueChange={setHasAdvance}
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
                                    title={advanceType === 'percentage' ? "Porcentagem" : "Valor"}
                                    value={advanceValue}
                                    onChangeText={(t) => advanceType === 'percentage' ? setAdvanceValue(t) : setAdvanceValue(formatInputCurrency(t))}
                                    placeholder={advanceType === 'percentage' ? "Ex: 40" : "R$ 0,00"}
                                    keyboardType="numeric"
                                />

                                <InputRow
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
                            title="Adicionar Desconto"
                            onPress={() => setShowDiscountModal(true)}
                            rightComponent={<ChevronRight size={20} color="#666" />}
                            isLast={otherDiscounts.length === 0}
                        />

                        {otherDiscounts.map((discount, index) => (
                            <ListRow
                                key={discount.id}
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
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Salário Bruto</Text>
                            <Text style={styles.summaryValue}>{formatCurrency(calculations.grossSalary)}</Text>
                        </View>
                        <View style={styles.itemSeparator} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>INSS</Text>
                            <Text style={styles.summaryValue}>- {formatCurrency(calculations.inss)}</Text>
                        </View>
                        <View style={styles.itemSeparator} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>IRRF</Text>
                            <Text style={styles.summaryValue}>- {formatCurrency(calculations.irrf)}</Text>
                        </View>
                        {hasAdvance && <>
                            <View style={styles.itemSeparator} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Adiantamento</Text>
                                <Text style={styles.summaryValue}>- {formatCurrency(calculations.advance)}</Text>
                            </View>
                        </>}
                        {calculations.otherDiscountsTotal > 0 && <>
                            <View style={styles.itemSeparator} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Outros descontos</Text>
                                <Text style={styles.summaryValue}>- {formatCurrency(calculations.otherDiscountsTotal)}</Text>
                            </View>
                        </>}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Líquido Estimado</Text>
                            <Text style={styles.totalValue}>{formatCurrency(calculations.netSalary)}</Text>
                        </View>
                    </View>



                </ScrollView>

                {hasChanges && (
                    <View style={[styles.saveContainer, { paddingBottom: insets.bottom + 16 }]}>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={isSaving}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.saveButtonText}>
                                {isSaving ? 'Salvando...' : 'Salvar alterações'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Discount Modal */}
            <ModalPadrao
                visible={showDiscountModal}
                onClose={() => setShowDiscountModal(false)}
                title="Novo Desconto"
            >
                <View style={{ gap: 16 }}>
                    <Text style={styles.modalSubtitle}>
                        Informe os detalhes do novo desconto que será aplicado ao seu salário.
                    </Text>

                    <View style={styles.sectionCard}>
                        <View style={styles.itemContainer}>
                            <Text style={styles.itemTitle}>Nome</Text>
                            <TextInput
                                style={styles.inputRight}
                                value={newDiscountName}
                                onChangeText={setNewDiscountName}
                                placeholder="Ex: Plano de Saúde"
                                placeholderTextColor="#444"
                                textAlign="right"
                            />
                            <View style={styles.itemSeparator} />
                        </View>

                        <View style={[styles.itemContainer, { paddingVertical: 10 }]}>
                            <SmoothTabs
                                value={newDiscountType}
                                onChange={(v) => setNewDiscountType(v as any)}
                                options={[
                                    { label: 'Valor (R$)', value: 'fixed' },
                                    { label: 'Porcentagem (%)', value: 'percentage' }
                                ]}
                            />
                            <View style={styles.itemSeparator} />
                        </View>

                        <View style={styles.itemContainer}>
                            <Text style={styles.itemTitle}>
                                {newDiscountType === 'fixed' ? 'Valor' : 'Porcentagem'}
                            </Text>
                            <TextInput
                                style={styles.inputRight}
                                value={newDiscountValue}
                                onChangeText={(t) => newDiscountType === 'percentage' ? setNewDiscountValue(t) : setNewDiscountValue(formatInputCurrency(t))}
                                keyboardType="numeric"
                                placeholder={newDiscountType === 'percentage' ? "Ex: 5" : "R$ 0,00"}
                                placeholderTextColor="#444"
                                textAlign="right"
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.modalSaveButton}
                        onPress={handleAddDiscount}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.modalSaveButtonText}>Adicionar Desconto</Text>
                    </TouchableOpacity>
                </View>
            </ModalPadrao>

            {/* Payday Modal */}
            <ModalPadrao
                visible={showPaydayModal}
                onClose={() => setShowPaydayModal(false)}
                title="Dia do Pagamento"
                headerRight={null}
            >
                <View style={{ gap: 16 }}>
                    <Text style={styles.modalSubtitle}>
                        Escolha como o sistema deve projetar o dia do seu pagamento mensalmente.
                    </Text>

                    <View style={styles.sectionCard}>
                        {[
                            { label: '5º Dia Útil', value: '5th_business' },
                            { label: 'Último Dia Útil', value: 'last_business' },
                            { label: 'Último Dia do Mês', value: 'last_month' },
                            { label: 'Dia Fixo (Manual)', value: 'manual' }
                        ].map((opt, index, arr) => (
                            <View key={opt.value}>
                                <TouchableOpacity
                                    style={[
                                        styles.itemContainer,
                                        paydayType === opt.value && { backgroundColor: 'rgba(217,119,87,0.04)' }
                                    ]}
                                    onPress={() => {
                                        setPaydayType(opt.value as any);
                                        if (opt.value !== 'manual') setTimeout(() => setShowPaydayModal(false), 200);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.itemTitle, paydayType === opt.value && { color: '#d97757' }]}>
                                        {opt.label}
                                    </Text>
                                    {paydayType === opt.value && <View style={styles.checkCircle}><View style={styles.checkInner} /></View>}
                                    {index < arr.length - 1 && <View style={styles.itemSeparator} />}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    {paydayType === 'manual' && (
                        <Animated.View entering={FadeIn} style={{ gap: 16 }}>
                            <View style={styles.infoBox}>
                                <Info size={16} color="#8E8E93" style={{ marginRight: 8, marginTop: 2 }} />
                                <Text style={styles.infoBoxText}>
                                    O dia fixo ignora finais de semana e feriados, projetando sempre no dia escolhido.
                                </Text>
                            </View>

                            <View style={styles.sectionCard}>
                                <View style={styles.itemContainer}>
                                    <Text style={styles.itemTitle}>Dia do Mês</Text>
                                    <TextInput
                                        style={styles.inputRight}
                                        value={paydayDate}
                                        onChangeText={setPaydayDate}
                                        placeholder="1-31"
                                        placeholderTextColor="#444"
                                        keyboardType="numeric"
                                        maxLength={2}
                                        textAlign="right"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.modalSaveButton}
                                onPress={() => setShowPaydayModal(false)}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.modalSaveButtonText}>Confirmar Dia Fixo</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </View>
            </ModalPadrao>

        </View>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0C0C0C' },
    // Header
    headerWrapper: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        paddingHorizontal: 20,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#E8E8EA', textAlign: 'center' },
    headerSpacer: { width: 40, height: 40 },
    scrollContent: { paddingHorizontal: 20 },
    saveContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: 'rgba(12,12,12,0.85)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    saveButton: {
        backgroundColor: '#d97757',
        borderRadius: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Check Circle
    checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d97757', justifyContent: 'center', alignItems: 'center' },
    checkInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d97757' },

    // Section
    sectionHeader: {
        fontSize: 11,
        fontWeight: '500',
        color: '#555',
        marginTop: 28,
        marginBottom: 8,
        marginLeft: 2,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#111111',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1A1A1A',
        overflow: 'hidden',
    },
    sectionFooterText: {
        fontSize: 12,
        color: '#444',
        marginTop: 6,
        marginLeft: 2,
        lineHeight: 16,
    },
    cardPadding: { padding: 16 },

    // List Items
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 52,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#111111',
        position: 'relative',
    },
    itemLeft: {
        flex: 1,
        paddingRight: 12,
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#1A1A1A',
    },
    itemTitle: {
        fontSize: 16,
        color: '#E8E8EA',
        fontWeight: '400',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#555',
        marginTop: 2,
    },
    valueText: {
        fontSize: 15,
        color: '#8E8E93',
        marginRight: 4,
    },
    inputRight: {
        fontSize: 15,
        color: '#8E8E93',
        textAlign: 'right',
        minWidth: 100,
        padding: 0,
        flex: 1,
    },

    inlinePadding: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },

    // Summary
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        position: 'relative',
    },
    summaryLabel: { color: '#666', fontSize: 14 },
    summaryValue: { color: '#888', fontSize: 14 },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginTop: 2,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#1A1A1A',
    },
    totalLabel: { color: '#E8E8EA', fontSize: 15 },
    totalValue: { color: '#d97757', fontSize: 18, fontWeight: '600' },

    modalSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        lineHeight: 20,
        marginBottom: 4,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoBoxText: {
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
        flex: 1,
    },
    modalSaveButton: {
        backgroundColor: '#D97757',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8
    },
    modalSaveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
