import type { ProjectionSettings } from '@/components/ProjectionsModal';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Transaction } from '@/services/invoiceBuilder';
import { extractMonthKey } from '@/utils/monthWindow';
import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { formatCurrencyAmount } from './types';

interface SaldoContaProps {
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
  onProjectionsPress: () => void;
  animateValues?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface MorphTouchableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

function MorphTouchable({
  children,
  style,
  radius = 12,
  onPressIn,
  onPressOut,
  ...props
}: MorphTouchableProps) {
  const pressProgress = useSharedValue(0);
  const morphProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const pressed = pressProgress.value;
    const morph = morphProgress.value;

    return {
      borderRadius: radius + morph * 3 - pressed * 0.8,
      transform: [
        { translateY: pressed * 1.2 },
        { scaleX: 1 + morph * 0.01 - pressed * 0.01 },
        { scaleY: 1 + morph * 0.014 + pressed * 0.006 },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const pressed = pressProgress.value;
    const morph = morphProgress.value;

    return {
      transform: [
        { scaleX: 1 + morph * 0.004 - pressed * 0.003 },
        { scaleY: 1 - morph * 0.003 + pressed * 0.003 },
      ],
    };
  });

  return (
    <AnimatedTouchableOpacity
      {...props}
      activeOpacity={1}
      onPressIn={(event) => {
        pressProgress.value = withSpring(1, {
          damping: 16,
          stiffness: 250,
          mass: 0.42,
        });

        morphProgress.value = withSpring(1, {
          damping: 13,
          stiffness: 190,
          mass: 0.48,
        });

        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressProgress.value = withSpring(0, {
          damping: 15,
          stiffness: 215,
          mass: 0.45,
        });

        morphProgress.value = withSpring(0, {
          damping: 11,
          stiffness: 145,
          mass: 0.52,
        });

        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      <Animated.View style={contentStyle}>
        {children}
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
}

const SaldoConta = React.memo(({
  isValuesVisible,
  setIsValuesVisible,
  isLoading = false,
  selectedMonthKey,
  checkingTransactions,
  bankAccountData,
  selectedCreditExpenseTotal,
  projectionSettings,
  onProjectionsPress,
  salaryPreview,
  valePreview,
  recurrences,
  includeOpenFinance,
  animateValues = true
}: SaldoContaProps) => {
  const cardMorph = useSharedValue(0);

  const { saldo, totalReceitas, totalDespesas } = useMemo(() => {
    const incomeTxs = includeOpenFinance
      ? checkingTransactions.filter(
        tx => tx.type === 'income' && tx.date && extractMonthKey(tx.date) === selectedMonthKey
      )
      : [];

    const incomeTotal = incomeTxs.reduce((sum, tx) => sum + tx.amount, 0);

    let projectedIncome = 0;
    let projectedExpense = 0;

    if (projectionSettings.includeSalary) {
      projectedIncome += Math.max(0, salaryPreview);
    }

    if (projectionSettings.includeVale) {
      projectedIncome += Math.max(0, valePreview);
    }

    const [yearStr, monthStr] = selectedMonthKey.split('-');
    const selectedMonthNum = Number(monthStr);
    const zeroPaddedMonthKey = `${yearStr}-${String(selectedMonthNum).padStart(2, '0')}`;
    const simpleMonthKey = `${yearStr}-${selectedMonthNum}`;

    const pendingReminders = recurrences.filter(r => {
      if (r.type !== 'reminder' || r.status === 'paid') return false;

      const itemMonthKey = extractMonthKey(r.dueDate);
      if (!itemMonthKey) return false;
      return itemMonthKey <= selectedMonthKey;
    });

    const expenseReminders = pendingReminders.filter(r => r.transactionType !== 'income');
    const incomeReminders = pendingReminders.filter(r => r.transactionType === 'income');

    if (projectionSettings.includeReminders) {
      projectedExpense += expenseReminders.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      projectedIncome += incomeReminders.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    }

    const pendingSubs = recurrences.filter(r => {
      if (r.type !== 'subscription') return false;

      const startMonthKey = extractMonthKey(r.dueDate);
      if (!startMonthKey) return false;

      // Don't project before the subscription's first month
      if (startMonthKey > selectedMonthKey) return false;

      // Don't project on or after cancellation month
      if (r.cancellationDate) {
        const cancelMonthKey = extractMonthKey(r.cancellationDate);
        if (cancelMonthKey && cancelMonthKey <= selectedMonthKey) return false;
      }

      const isPaid = Array.isArray(r.paidMonths)
        && r.paidMonths.some((m: string) => m === zeroPaddedMonthKey || m === simpleMonthKey);
      if (isPaid) return false;

      if (r.frequency === 'monthly') return true;

      if (r.frequency === 'yearly') {
        const dueMonth = Number(r.dueDate.split('-')[1]);
        return dueMonth === selectedMonthNum;
      }

      return false;
    });

    const expenseSubs = pendingSubs.filter(r => r.transactionType !== 'income');
    const incomeSubs = pendingSubs.filter(r => r.transactionType === 'income');

    if (projectionSettings.includeSubscriptions) {
      projectedExpense += expenseSubs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      projectedIncome += incomeSubs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    }

    const calculatedTotalReceitas = (bankAccountData.totalBalance || 0) + incomeTotal + projectedIncome;

    const expenseTxs = includeOpenFinance
      ? checkingTransactions.filter(
        tx => tx.type === 'expense' && tx.date && extractMonthKey(tx.date) === selectedMonthKey
      )
      : [];

    const expenseChecking = expenseTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const calculatedTotalDespesas = expenseChecking + selectedCreditExpenseTotal + projectedExpense;
    const calculatedSaldo = calculatedTotalReceitas - calculatedTotalDespesas;

    return {
      saldo: calculatedSaldo,
      totalReceitas: calculatedTotalReceitas,
      totalDespesas: calculatedTotalDespesas,
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

  useEffect(() => {
    cardMorph.value = 0;
    cardMorph.value = withSequence(
      withTiming(1, { duration: 145 }),
      withSpring(0, {
        damping: 11,
        stiffness: 145,
        mass: 0.58,
      })
    );
  }, [
    saldo,
    totalReceitas,
    totalDespesas,
    isValuesVisible,
    cardMorph,
  ]);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const morph = cardMorph.value;

    return {
      borderRadius: 24 + morph * 5,
      transform: [
        { translateY: -morph * 1.2 },
        { scaleX: 1 + morph * 0.01 },
        { scaleY: 1 - morph * 0.004 },
      ],
    };
  });

  const cardContentAnimatedStyle = useAnimatedStyle(() => {
    const morph = cardMorph.value;

    return {
      transform: [
        { translateY: -morph * 0.6 },
        { scaleX: 1 + morph * 0.004 },
        { scaleY: 1 - morph * 0.003 },
      ],
    };
  });

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Saldo da conta
        </Text>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={onProjectionsPress}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={16} color="#606060" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.incomeCard, cardAnimatedStyle]}>
        {isLoading ? (
          <View>
            <Skeleton width={180} height={36} style={{ marginBottom: 16 }} />

            <View style={styles.loadingBottomRow}>
              <View>
                <Skeleton width={60} height={12} style={{ marginBottom: 6 }} />
                <Skeleton width={80} height={18} />
              </View>

              <View>
                <Skeleton width={60} height={12} style={{ marginBottom: 6 }} />
                <Skeleton width={80} height={18} />
              </View>
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.cardContent, cardContentAnimatedStyle]}>
            <View style={styles.balanceRow}>
              <View style={styles.balanceAmountRow}>
                <Text
                  style={[
                    styles.balanceCurrency,
                    { color: saldo >= 0 ? '#FFFFFF' : '#FA5C5C' }
                  ]}
                >
                  {saldo < 0 ? '-R$ ' : 'R$ '}
                </Text>

                {isValuesVisible ? (
                  <Text
                    style={[
                      styles.balanceAmount,
                      { color: saldo >= 0 ? '#FFFFFF' : '#FA5C5C' }
                    ]}
                  >
                    {formatCurrencyAmount(saldo)}
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.balanceAmountHidden,
                      { color: saldo >= 0 ? '#FFFFFF' : '#FA5C5C' }
                    ]}
                  >
                    ••••
                  </Text>
                )}
              </View>

              <MorphTouchable
                radius={12}
                style={styles.eyeButton}
                onPress={() => setIsValuesVisible(!isValuesVisible)}
              >
                {isValuesVisible ? (
                  <Eye size={18} color="#444444" />
                ) : (
                  <EyeOff size={18} color="#444444" />
                )}
              </MorphTouchable>
            </View>

            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>
                  Receitas
                </Text>

                <View style={styles.summaryAmountRow}>
                  <Text style={styles.summaryCurrency}>
                    R$
                  </Text>

                  {isValuesVisible ? (
                    <Text style={styles.summaryAmount}>
                      {formatCurrencyAmount(totalReceitas)}
                    </Text>
                  ) : (
                    <Text style={styles.summaryAmountHidden}>
                      ••••
                    </Text>
                  )}
                </View>
              </View>

              <View>
                <Text style={styles.summaryLabel}>
                  Despesas
                </Text>

                <View style={styles.summaryAmountRow}>
                  <Text style={styles.summaryCurrency}>
                    R$
                  </Text>

                  {isValuesVisible ? (
                    <Text style={styles.summaryAmount}>
                      {formatCurrencyAmount(totalDespesas)}
                    </Text>
                  ) : (
                    <Text style={styles.summaryAmountHidden}>
                      ••••
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 12,
  },

  headerTitle: {
    fontSize: 16,
    fontFamily: 'AROneSans_400Regular',
    color: '#909090',
    marginLeft: 4,
  },

  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#161616',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222222',
  },

  incomeCard: {
    marginTop: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#111111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#161616',
    height: 120,
    justifyContent: 'center',
    overflow: 'hidden',
  },

  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },

  loadingBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  balanceRow: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  balanceAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  balanceCurrency: {
    fontSize: 28,
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: -0.5,
  },

  balanceAmount: {
    fontSize: 28,
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: -0.5,
  },

  balanceAmountHidden: {
    fontSize: 28,
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: -0.5,
    paddingTop: 4,
  },

  eyeButton: {
    padding: 8,
    borderRadius: 12,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  summaryLabel: {
    fontSize: 13,
    color: '#808080',
    fontFamily: 'AROneSans_400Regular',
    marginBottom: 4,
  },

  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryCurrency: {
    fontSize: 16,
    color: '#E0E0E0',
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: -0.5,
  },

  summaryAmount: {
    fontSize: 16,
    color: '#E0E0E0',
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: -0.5,
  },

  summaryAmountHidden: {
    fontSize: 16,
    color: '#E0E0E0',
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: -0.5,
    paddingTop: 4,
  },
});

SaldoConta.displayName = 'SaldoConta';

export default SaldoConta;