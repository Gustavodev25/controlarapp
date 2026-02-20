import { RollingCounter } from '@/components/organisms/rolling-counter';
import { ProjectionSettings } from '@/components/ProjectionsModal';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { Skeleton } from '@/components/ui/Skeleton';
import { Transaction } from '@/services/invoiceBuilder';
import { extractMonthKey } from '@/utils/monthWindow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface OverviewSectionProps {
  isValuesVisible: boolean;
  setIsValuesVisible: (visible: boolean) => void;
  isLoading?: boolean;
  selectedMonthKey: string;
  checkingTransactions: Transaction[];
  bankAccountData: { totalBalance: number };
  selectedCreditExpenseTotal: number;
  projectionSettings: ProjectionSettings;
  salaryPreview: number;
  valePreview: number;
  recurrences: any[];
  includeOpenFinance: boolean;
  onConfigPress: () => void;
  onProjectionsPress: () => void;
  onNewExtraPress: () => void;
}

const OverviewSection = React.memo(({
  isValuesVisible,
  setIsValuesVisible,
  isLoading = false,
  selectedMonthKey,
  checkingTransactions,
  bankAccountData,
  selectedCreditExpenseTotal,
  projectionSettings,
  onNewExtraPress,
  onConfigPress,
  onProjectionsPress,
  salaryPreview,
  valePreview,
  recurrences,
  includeOpenFinance
}: OverviewSectionProps) => {
  const { saldo, totalReceitas, totalDespesas } = useMemo(() => {
    // 1. Calculate Income (Receitas)
    const incomeTxs = includeOpenFinance
      ? checkingTransactions.filter(
        tx => tx.type === 'income' && tx.date && extractMonthKey(tx.date) === selectedMonthKey
      )
      : [];
    const incomeTotal = incomeTxs.reduce((sum, tx) => sum + tx.amount, 0);

    // Projections: Initialize Variables
    let projectedIncome = 0;
    let projectedExpense = 0;

    // Salary preview is already net of taxes/discounts and advance.
    if (projectionSettings.includeSalary) {
      projectedIncome += Math.max(0, salaryPreview);
    }
    // Vale is a separate toggle so users can project it independently.
    if (projectionSettings.includeVale) {
      projectedIncome += Math.max(0, valePreview);
    }

    // Reminders & Subscriptions
    if (projectionSettings.includeReminders) {
      const pendingReminders = recurrences.filter(r =>
        r.type === 'reminder' &&
        r.status !== 'paid' &&
        extractMonthKey(r.dueDate) === selectedMonthKey
      );

      const expenseReminders = pendingReminders.filter(r => r.transactionType !== 'income');
      const incomeReminders = pendingReminders.filter(r => r.transactionType === 'income');

      projectedExpense += expenseReminders.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      projectedIncome += incomeReminders.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    }

    if (projectionSettings.includeSubscriptions) {
      // Filter out subscriptions that are paid for the selected month
      const pendingSubs = recurrences.filter(r => {
        if (r.type !== 'subscription') return false;

        // Check if paid for this month
        const [year, month] = selectedMonthKey.split('-');
        const zeroPaddedMonthKey = `${year}-${month.padStart(2, '0')}`;
        const simpleMonthKey = `${year}-${Number(month)}`;

        const isPaid = r.paidMonths?.some((m: string) => m === zeroPaddedMonthKey || m === simpleMonthKey);
        if (isPaid) return false;

        // Check frequency and recurrence logic
        if (r.frequency === 'monthly') return true;

        if (r.frequency === 'yearly') {
          // Only include if the month matches due date month
          const dueMonth = r.dueDate.split('-')[1];
          return Number(dueMonth) === Number(month);
        }

        return false;
      });

      const expenseSubs = pendingSubs.filter(r => r.transactionType !== 'income');
      const incomeSubs = pendingSubs.filter(r => r.transactionType === 'income');

      projectedExpense += expenseSubs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      projectedIncome += incomeSubs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    }

    const calculatedTotalReceitas = (bankAccountData.totalBalance || 0) + incomeTotal + projectedIncome;

    // 2. Calculate Expenses (Despesas)
    const expenseTxs = includeOpenFinance
      ? checkingTransactions.filter(
        tx => tx.type === 'expense' && tx.date && extractMonthKey(tx.date) === selectedMonthKey
      )
      : [];
    const expenseChecking = expenseTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const calculatedTotalDespesas = expenseChecking + selectedCreditExpenseTotal + projectedExpense;

    // Saldo = Receitas - Despesas
    const calculatedSaldo = calculatedTotalReceitas - calculatedTotalDespesas;

    return {
      saldo: calculatedSaldo,
      totalReceitas: calculatedTotalReceitas,
      totalDespesas: calculatedTotalDespesas
    };
  }, [
    checkingTransactions,
    selectedMonthKey,
    includeOpenFinance,
    projectionSettings,
    salaryPreview,
    valePreview,
    bankAccountData.totalBalance,
    selectedCreditExpenseTotal,
    recurrences
  ]);


  const [shortcutsCollapsed, setShortcutsCollapsed] = useState(false);

  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('@shortcuts_collapsed');
        if (savedState !== null) {
          setShortcutsCollapsed(savedState === 'true');
        }
      } catch (e) {
        console.error('Failed to load shortcuts state.', e);
      }
    };
    loadState();
  }, []);

  const toggleShortcuts = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !shortcutsCollapsed;
    setShortcutsCollapsed(newState);
    try {
      await AsyncStorage.setItem('@shortcuts_collapsed', newState.toString());
    } catch (e) {
      console.error('Failed to save shortcuts state.', e);
    }
  };

  return (
    <View>
      {/* Header da Seção */}
      <View style={[styles.sectionHeader, { alignItems: 'center' }]}>
        <View>
          <Text style={styles.sectionTitle}>Visão Geral</Text>
          <Text style={styles.sectionSubtitle}>Resumo financeiro do mês</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onConfigPress}
          >
            <DelayedLoopLottie
              source={require('../../assets/engrenagem.json')}
              style={{ width: 20, height: 20 }}
              delay={5000}
              throttleMultiplier={1.15}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onProjectionsPress}
          >
            <DelayedLoopLottie
              source={require('../../assets/previsao.json')}
              style={{ width: 24, height: 24 }}
              delay={5000}
              throttleMultiplier={1.15}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Informações de Renda - Card Style */}
      <View style={[styles.incomeCard, { flexDirection: 'column', alignItems: 'stretch', padding: 16, backgroundColor: '#141414', borderRadius: 24, borderWidth: 1, borderColor: '#2A2A2A' }]}>

        {isLoading ? (
          <View>
            {/* Título "Saldo Estimado" */}
            <Skeleton width={100} height={14} style={{ marginBottom: 12 }} />

            {/* Valor Grande */}
            <Skeleton width={180} height={36} style={{ marginBottom: 20 }} />

            {/* Linha de Receitas/Despesas */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Skeleton width={80} height={18} />
                  <Skeleton width={22} height={22} borderRadius={11} />
                </View>
              </View>
              <View>
                <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Skeleton width={80} height={18} />
                  <Skeleton width={22} height={22} borderRadius={11} />
                </View>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* Top Section: Total Balance Label */}
            <View style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: '#A0A0A0', fontFamily: 'AROneSans_500Medium' }}>Saldo Estimado</Text>
            </View>



            {/* Main Balance Value with Eye Toggle */}
            <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  color: saldo >= 0 ? '#FFFFFF' : '#FA5C5C',
                  letterSpacing: -0.5
                }}>
                  {saldo < 0 ? '-R$ ' : 'R$ '}
                </Text>
                {isValuesVisible ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <RollingCounter
                      value={Math.abs(saldo)}
                      height={36}
                      width={20}
                      fontSize={32}
                      letterSpacing={-0.5}
                      color={saldo >= 0 ? '#FFFFFF' : '#FA5C5C'}
                    />
                    <Text style={{
                      fontSize: 32,
                      fontWeight: 'bold',
                      color: saldo >= 0 ? '#FFFFFF' : '#FA5C5C',
                      letterSpacing: -0.5,
                    }}>
                      ,{Math.abs(saldo).toFixed(2).slice(-2)}
                    </Text>
                  </View>
                ) : (
                  <Text style={{
                    fontSize: 32,
                    fontWeight: 'bold',
                    color: saldo >= 0 ? '#FFFFFF' : '#FA5C5C',
                    letterSpacing: -0.5,
                    paddingTop: 8,
                  }}>
                    ••••
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setIsValuesVisible(!isValuesVisible)} style={{ padding: 4, marginLeft: 8 }}>
                {isValuesVisible ? <Eye size={20} color="#909090" /> : <EyeOff size={20} color="#909090" />}
              </TouchableOpacity>
            </View>

            {/* Bottom Row: Income vs Expense */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>

              {/* Income (Receitas) */}
              <View>
                <Text style={{ fontSize: 13, color: '#909090', fontFamily: 'AROneSans_500Medium', marginBottom: 4 }}>Receitas</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, color: '#E0E0E0', fontWeight: 'bold', letterSpacing: -0.5 }}>
                      R$
                    </Text>
                    {isValuesVisible ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <RollingCounter
                          value={Math.abs(totalReceitas)}
                          height={20}
                          width={10}
                          fontSize={16}
                          letterSpacing={-0.5}
                          color="#E0E0E0"
                        />
                        <Text style={{ fontSize: 16, color: '#E0E0E0', fontWeight: 'bold', letterSpacing: -0.5 }}>
                          ,{Math.abs(totalReceitas).toFixed(2).slice(-2)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 16, color: '#E0E0E0', fontWeight: 'bold', letterSpacing: -0.5, paddingTop: 4 }}>
                        ••••
                      </Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: 'rgba(4, 211, 97, 0.15)', borderRadius: 12, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <DelayedLoopLottie
                      source={require('../../assets/receita.json')}
                      style={{ width: 16, height: 16 }}
                      throttleMultiplier={1.1}
                    />
                  </View>
                </View>
              </View>

              {/* Expense (Despesas) */}
              <View>
                <Text style={{ fontSize: 13, color: '#909090', fontFamily: 'AROneSans_500Medium', marginBottom: 4 }}>Despesas</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, color: '#E0E0E0', fontWeight: 'bold', letterSpacing: -0.5 }}>
                      R$
                    </Text>
                    {isValuesVisible ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <RollingCounter
                          value={Math.abs(totalDespesas)}
                          height={20}
                          width={10}
                          fontSize={16}
                          letterSpacing={-0.5}
                          color="#E0E0E0"
                        />
                        <Text style={{ fontSize: 16, color: '#E0E0E0', fontWeight: 'bold', letterSpacing: -0.5 }}>
                          ,{Math.abs(totalDespesas).toFixed(2).slice(-2)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 16, color: '#E0E0E0', fontWeight: 'bold', letterSpacing: -0.5, paddingTop: 4 }}>
                        ••••
                      </Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: 'rgba(255, 76, 76, 0.15)', borderRadius: 12, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                    <DelayedLoopLottie
                      source={require('../../assets/despesa.json')}
                      style={{ width: 16, height: 16 }}
                      throttleMultiplier={1.1}
                    />
                  </View>
                </View>
              </View>

            </View>
          </>
        )}
      </View >

      {/* Shortcuts Row */}
      <View style={{ marginTop: 24, marginBottom: 10 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleShortcuts}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: shortcutsCollapsed ? 0 : 16,
            paddingHorizontal: 4
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#909090', fontSize: 14, fontFamily: 'AROneSans_500Medium' }}>
              Atalhos
            </Text>
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 8
            }}>
              <Text style={{
                color: '#A0A0A0',
                fontSize: 10,
                fontFamily: 'AROneSans_500Medium'
              }}>
                Em breve
              </Text>
            </View>
          </View>
          {shortcutsCollapsed ? <ChevronDown size={20} color="#505050" /> : <ChevronUp size={20} color="#505050" />}
        </TouchableOpacity>

        {!shortcutsCollapsed && (
          <View>
            <View style={[styles.shortcutsContainer, { marginTop: 0, marginBottom: 0, opacity: 0.3 }]}>
              <View style={styles.shortcutItem}>
                <View style={styles.shortcutIconButton}>
                  <DelayedLoopLottie
                    source={require('../../assets/calendario.json')}
                    style={{ width: 28, height: 28 }}
                    delay={3000}
                    throttleMultiplier={1.2}
                  />
                </View>
                <Text style={styles.shortcutLabel}>Lançar</Text>
              </View>

              <View style={styles.shortcutItem}>
                <View style={styles.shortcutIconButton}>
                  <DelayedLoopLottie
                    source={require('../../assets/adicionar.json')}
                    style={{ width: 28, height: 28 }}
                    delay={3000}
                    throttleMultiplier={1.2}
                  />
                </View>
                <Text style={styles.shortcutLabel}>Novo Extra</Text>
              </View>

              <View style={styles.shortcutItem}>
                <View style={styles.shortcutIconButton}>
                  <DelayedLoopLottie
                    source={require('../../assets/calculadora.json')}
                    style={{ width: 28, height: 28 }}
                    delay={3000}
                    throttleMultiplier={1.2}
                  />
                </View>
                <Text style={styles.shortcutLabel}>Calc. CLT</Text>
              </View>

              <View style={styles.shortcutItem}>
                <View style={styles.shortcutIconButton}>
                  <DelayedLoopLottie
                    source={require('../../assets/relogio.json')}
                    style={{ width: 28, height: 28 }}
                    delay={3000}
                    throttleMultiplier={1.2}
                  />
                </View>
                <Text style={styles.shortcutLabel}>Hora Extra</Text>
              </View>
            </View>

            {/* Overlay already exists visually via opacity, but user asked for "Em breve" on top specifically before.
                With the new header indicator, the center overlay is redundant but emphasizes the state.
                I'll keep it as it's a "disabled" state visualization requested earlier.
            */}
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
              <View style={{
                backgroundColor: 'rgba(20, 20, 20, 0.8)',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5
              }}>
                <Text style={{ color: '#FFFFFF', fontFamily: 'AROneSans_500Medium', fontSize: 13 }}>Em breve</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#909090',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  incomeCard: {
    marginTop: 0,
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shortcutsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    marginBottom: 10,
  },
  shortcutItem: {
    alignItems: 'center',
    width: 70,
  },
  shortcutIconButton: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shortcutLabel: {
    fontSize: 12,
    color: '#909090',
    fontFamily: 'AROneSans_500Medium',
    textAlign: 'center',
  },
});

export default OverviewSection;
