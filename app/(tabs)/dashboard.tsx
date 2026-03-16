import { AnimatedCurrency } from '@/components/AnimatedCurrency';
import { BalanceAccountsModal } from '@/components/BalanceAccountsModal';
import { ExtraIncomeModal } from '@/components/ExtraIncomeModal';
import { FinancialCalendar } from '@/components/FinancialCalendar';
import { ProjectionSettings, ProjectionsModal } from '@/components/ProjectionsModal';
import OverviewSection from '@/components/dashboard/OverviewSection';
import { RollingCounter } from '@/components/organisms/rolling-counter';
import Avvvatars from '@/components/ui/Avvvatars';

import { ConfigIncomeModal } from '@/components/ConfigIncomeModal';
import { UniversalBackground } from '@/components/UniversalBackground';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { StackCarousel, useStackCardStyle } from '@/components/ui/StackCarousel';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/use-categories';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { databaseService, db } from '@/services/firebase';
import { buildInvoices, buildInvoicesPluggyFirst, CreditCardAccount, parseDate, Transaction } from '@/services/invoiceBuilder';
import { notificationService } from '@/services/notifications';
import { queryCache } from '@/services/queryCache'; // New Cache Service
import { getDashboardLoadPlan } from '@/utils/dashboardDataPipeline';
import {
  calculateFinancials,
  Discount
} from '@/utils/financial-math';
import {
  clampMonth,
  extractMonthKey,
  getFirestoreMonthRange,
  getRecentMonthWindow,
  startOfMonth,
  toMonthKey
} from '@/utils/monthWindow';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { collection, DocumentData, getDocs, limit, orderBy, query, Query, QueryDocumentSnapshot, startAfter, where } from 'firebase/firestore';
import { Ban, ChevronLeft, ChevronRight, CreditCard, RotateCcw, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, InteractionManager, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { VictoryLabel, VictoryPie } from 'victory-native';



let hasPlayedOverviewGlowIntro = false;
type InvoicePeriod = 'past' | 'current' | 'next' | 'total_used' | 'none';
const INVOICE_PERIOD_VALUES: InvoicePeriod[] = ['past', 'current', 'next', 'total_used', 'none'];
const CREDIT_OVERVIEW_WINDOW_MONTHS = 24;
const CREDIT_OVERVIEW_BATCH_SIZE = 500;
const CREDIT_OVERVIEW_MAX_ITEMS_PER_CARD = 2000;

const isInvoicePeriod = (value: unknown): value is InvoicePeriod => (
  typeof value === 'string' && INVOICE_PERIOD_VALUES.includes(value as InvoicePeriod)
);

// Import NumberFlow for animated number transitions
const getInitials = (name?: string) => {
  if (!name) return 'U';
  const names = name.trim().split(' ');
  if (names.length === 0) return 'U';
  if (names.length === 1) {
    if (name.includes('@')) {
      // Is email, take first 2 chars
      return name.substring(0, 2).toUpperCase();
    }
    return names[0].substring(0, 2).toUpperCase();
  }
  return (names[0][0] + names[names.length - 1][0]).toUpperCase();
};

const getAvatarGradient = (name?: string): [string, string] => {
  if (!name) return ['#e0e0e0', '#f5f5f5'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  // Generate two pastel colors with slight hue shift for a pleasant gradient
  return [
    `hsl(${h}, 75%, 85%)`,
    `hsl(${(h + 40) % 360}, 75%, 80%)`
  ];
};

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeTransactionDateValue = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toLocalDateString(value);
  }

  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const parsed = (value as { toDate: () => Date }).toDate();
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
      return toLocalDateString(parsed);
    }
  }

  return '';
};

const normalizeCheckingTransactionType = (data: DocumentData): 'income' | 'expense' => {
  const explicitType = typeof data?.type === 'string' ? data.type.toLowerCase() : '';
  const pluggyType = typeof data?.pluggyRaw?.type === 'string' ? data.pluggyRaw.type.toLowerCase() : '';
  const rawAmount = Number(data?.pluggyRaw?.amount ?? data?.amount ?? 0);

  if (pluggyType === 'debit' || pluggyType === 'expense') return 'expense';
  if (pluggyType === 'credit' || pluggyType === 'income') return 'income';

  if (explicitType === 'expense' || explicitType === 'debit') return 'expense';
  if (explicitType === 'income' || explicitType === 'credit') return 'income';

  return rawAmount < 0 ? 'expense' : 'income';
};

const normalizeCreditTransactionType = (data: DocumentData): 'income' | 'expense' => {
  const explicitType = typeof data?.type === 'string' ? data.type.toLowerCase() : '';
  const pluggyType = typeof data?.pluggyRaw?.type === 'string' ? data.pluggyRaw.type.toLowerCase() : '';
  const rawAmount = Number(data?.pluggyRaw?.amount ?? data?.amount ?? 0);
  const isRefund = data?.isRefund === true || data?.category === 'Refund' || typeof data?.originalTransactionId === 'string';

  if (isRefund) return 'income';

  if (pluggyType === 'debit' || pluggyType === 'expense') return 'expense';
  if (pluggyType === 'credit' || pluggyType === 'income') return 'income';

  if (explicitType === 'expense' || explicitType === 'debit') return 'expense';
  if (explicitType === 'income' || explicitType === 'credit') {
    // Legacy docs may store regular purchases as "income" with positive amount.
    return rawAmount < 0 ? 'income' : 'expense';
  }

  // For credit cards, positive amounts are usually purchases and should increase the bill.
  return rawAmount < 0 ? 'income' : 'expense';
};


export default function DashboardScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuthContext();
  const { getCategoryName } = useCategories();
  const { budget, lod } = usePerformanceBudget();

  const [menuVisible, setMenuVisible] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [balanceModalVisible, setBalanceModalVisible] = useState(false);
  const [extraModalVisible, setExtraModalVisible] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showProjectionsModal, setShowProjectionsModal] = useState(false);

  // Month Navigation State (current month + 2 previous months)
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const { minMonth: rawMinMonth, maxMonth: rawMaxMonth } = useMemo(
    () => getRecentMonthWindow(new Date(), 3),
    []
  );
  const minMonth = rawMinMonth;
  const maxMonth = rawMaxMonth;
  const selectedMonthKey = toMonthKey(selectedMonth);

  // Projections State
  const [projectionSettings, setProjectionSettings] = useState<ProjectionSettings>({
    includeSalary: false,
    includeVale: false,
    includeReminders: false,
    includeSubscriptions: false
  });

  // Calculate Salary/Vale previews from Profile
  const { salaryPreview, valePreview } = useMemo(() => {
    const profileData = profile as any;
    const nestedProfile = profileData?.profile || {};
    const financialSource = profileData?.financial ?? nestedProfile?.financial ?? null;

    const toNumber = (value: any): number => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }
      if (typeof value === 'string') {
        const normalized = value
          .replace(/[^\d,.-]/g, '')
          .replace(/\.(?=\d{3}(?:\D|$))/g, '')
          .replace(',', '.');
        return Number(normalized) || 0;
      }
      return 0;
    };

    const firstDefined = (...values: any[]) => {
      for (const value of values) {
        if (value !== undefined && value !== null) return value;
      }
      return undefined;
    };

    const baseSalary = toNumber(firstDefined(
      financialSource?.salary?.base,
      profileData?.baseSalary,
      nestedProfile?.baseSalary
    ));
    if (baseSalary <= 0) return { salaryPreview: 0, valePreview: 0 };

    const isExempt = !!firstDefined(
      financialSource?.salary?.isExempt,
      profileData?.salaryExemptFromDiscounts,
      nestedProfile?.salaryExemptFromDiscounts
    );

    const legacyAdvancePercent = toNumber(firstDefined(
      profileData?.salaryAdvancePercent,
      nestedProfile?.salaryAdvancePercent
    ));
    const legacyAdvanceValue = toNumber(firstDefined(
      profileData?.salaryAdvanceValue,
      nestedProfile?.salaryAdvanceValue
    ));

    const hasAdvance = financialSource?.advance?.enabled !== undefined
      ? !!financialSource.advance.enabled
      : (legacyAdvancePercent > 0 || legacyAdvanceValue > 0);

    const advanceTypeRaw = firstDefined(
      financialSource?.advance?.type,
      legacyAdvancePercent > 0 ? 'percentage' : 'fixed'
    );
    const advanceType: 'percentage' | 'fixed' = advanceTypeRaw === 'fixed' ? 'fixed' : 'percentage';
    const advanceVal = toNumber(firstDefined(
      financialSource?.advance?.value,
      advanceType === 'percentage' ? legacyAdvancePercent : legacyAdvanceValue
    ));

    // Discounts need to preserve the fixed amount in reais.
    const discountsSource = Array.isArray(financialSource?.discounts) ? financialSource.discounts : [];
    const otherDiscounts: Discount[] = discountsSource.map((d: any) => {
      const discountNumericValue = toNumber(d.value);
      const discountType: 'fixed' | 'percentage' = d.type === 'percentage' ? 'percentage' : 'fixed';

      return {
        id: d.id,
        name: d.name,
        value: discountType === 'fixed'
          ? discountNumericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : discountNumericValue.toString().replace('.', ','),
        type: discountType
      };
    });

    const result = calculateFinancials(
      baseSalary,
      isExempt,
      hasAdvance,
      advanceType,
      advanceVal,
      otherDiscounts
    );



    return {
      salaryPreview: result.netSalary,
      valePreview: result.advance
    };
  }, [profile]);

  // Preference state
  const [includeOpenFinance, setIncludeOpenFinance] = useState(true);
  const [isValuesVisible, setIsValuesVisible] = useState(true);

  // Force refresh profile when entering dashboard to ensure financial data is up to date
  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshProfile();
      }
    }, [user])
  );

  // Load preferences
  useEffect(() => {
    if (profile?.preferences) {
      const prefs = profile.preferences as any;
      // Default to true if undefined, otherwise use the saved value
      setIncludeOpenFinance(prefs.includeOpenFinance ?? true);

      if (prefs.projections) {
        setProjectionSettings(prefs.projections);
      }
    }
  }, [profile]);

  const handleSaveProjections = async (settings: ProjectionSettings) => {
    setProjectionSettings(settings);
    if (user) {
      try {
        await databaseService.updatePreference(user.uid, {
          projections: settings
        });
      } catch (error) {
        console.error('Error saving projections:', error);
      }
    }
  };

  const handleToggleOpenFinance = async (value: boolean) => {
    setIncludeOpenFinance(value);
    if (user) {
      try {
        await databaseService.updatePreference(user.uid, {
          includeOpenFinance: value
        });
      } catch (error) {
        console.error('Error saving preference:', error);
      }
    }
  };

  const [selectedInvoicePeriod, setSelectedInvoicePeriod] = useState<InvoicePeriod>('current');
  const [selectedInvoicePeriodByCard, setSelectedInvoicePeriodByCard] = useState<Record<string, InvoicePeriod>>({});
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Bank accounts state for balance configuration
  const [checkingTransactions, setCheckingTransactions] = useState<Transaction[]>([]);
  const [creditCardTransactions, setCreditCardTransactions] = useState<Transaction[]>([]);
  const [allBankAccounts, setAllBankAccounts] = useState<any[]>([]);
  const [selectedBalanceAccountIds, setSelectedBalanceAccountIds] = useState<string[] | null>(null);
  const [recurrences, setRecurrences] = useState<any[]>([]);
  const [paymentAlertCards, setPaymentAlertCards] = useState<CreditCardAccount[]>([]);

  const paymentAlertsEnabled = ((profile?.preferences as any)?.paymentAlertsEnabled ?? true) as boolean;

  // Animated menu state
  const menuProgress = useSharedValue(0);

  const [creditCardData, setCreditCardData] = useState({
    hasCards: false,
    totalInvoice: 0,
    totalLimit: 0,
    totalUsed: 0,
    usagePercentage: 0
  });

  /* State for tracking which card was clicked for the modal */
  const [selectedCardForModal, setSelectedCardForModal] = useState<any>(null);

  const [invoiceData, setInvoiceData] = useState<{
    pastTotal: number;
    currentTotal: number;
    nextTotal: number;
    cards: Array<{
      id: string;
      name: string;
      past: number;
      current: number;
      next: number;
      limit: number;
      used: number;
      dueDate: Date | null;
      closingDate: Date | null;
    }>;
  }>({
    pastTotal: 0,
    currentTotal: 0,
    nextTotal: 0,
    cards: []
  });

  const [bankAccountData, setBankAccountData] = useState({
    hasAccounts: false,
    totalBalance: 0,
    count: 0
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sync local state with profile preferences (handling updates from Open Finance)
  useEffect(() => {
    const prefs = (profile?.preferences as any);
    // Only sync if balanceAccountIds key exists in preferences (even if empty array)
    if (prefs && 'balanceAccountIds' in prefs) {
      const newIds = prefs.balanceAccountIds as string[];
      const sortedNew = [...newIds].sort().join(',');
      const sortedCurrent = selectedBalanceAccountIds ? [...selectedBalanceAccountIds].sort().join(',') : '__null__';
      if (sortedNew !== sortedCurrent) {
        setSelectedBalanceAccountIds(newIds);
      }
    }
  }, [profile]);

  // Sync invoice period with profile preferences
  useEffect(() => {
    const prefs = (profile?.preferences as any);
    if (isInvoicePeriod(prefs?.invoicePeriod) && prefs.invoicePeriod !== selectedInvoicePeriod) {
      setSelectedInvoicePeriod(prefs.invoicePeriod);
    }

    const rawByCard = prefs?.invoicePeriodByCard;
    if (rawByCard && typeof rawByCard === 'object') {
      const normalizedByCard = Object.entries(rawByCard).reduce<Record<string, InvoicePeriod>>((acc, [cardId, period]) => {
        if (isInvoicePeriod(period)) {
          acc[cardId] = period;
        }
        return acc;
      }, {});

      setSelectedInvoicePeriodByCard((prev) => {
        const prevKeys = Object.keys(prev).sort();
        const nextKeys = Object.keys(normalizedByCard).sort();
        if (prevKeys.length !== nextKeys.length) {
          return normalizedByCard;
        }
        const isEqual = prevKeys.every((key, index) => key === nextKeys[index] && prev[key] === normalizedByCard[key]);
        return isEqual ? prev : normalizedByCard;
      });
    } else {
      setSelectedInvoicePeriodByCard((prev) => (
        Object.keys(prev).length > 0 ? {} : prev
      ));
    }
  }, [profile, selectedInvoicePeriod]);

  const getCardInvoicePeriod = useCallback((cardId?: string | null): InvoicePeriod => {
    if (!cardId) return selectedInvoicePeriod;
    return selectedInvoicePeriodByCard[cardId] || selectedInvoicePeriod;
  }, [selectedInvoicePeriod, selectedInvoicePeriodByCard]);

  const handleInvoicePeriodChange = async (period: InvoicePeriod) => {
    const selectedCardId = selectedCardForModal?.id as string | undefined;
    setInvoiceModalVisible(false);

    if (selectedCardId) {
      const nextInvoicePeriodByCard: Record<string, InvoicePeriod> = {
        ...selectedInvoicePeriodByCard
      };
      if (period === selectedInvoicePeriod) {
        delete nextInvoicePeriodByCard[selectedCardId];
      } else {
        nextInvoicePeriodByCard[selectedCardId] = period;
      }
      setSelectedInvoicePeriodByCard(nextInvoicePeriodByCard);

      if (user?.uid) {
        try {
          await databaseService.updatePreference(user.uid, {
            invoicePeriodByCard: nextInvoicePeriodByCard
          });
        } catch (error) {
          console.error('Error saving invoice period preference:', error);
        }
      }
      return;
    }

    setSelectedInvoicePeriod(period);
    if (user?.uid) {
      try {
        await databaseService.updatePreference(user.uid, {
          invoicePeriod: period
        });
      } catch (error) {
        console.error('Error saving invoice period preference:', error);
      }
    }
  };

  // Recalculate balance when selection or accounts change
  useEffect(() => {
    if (allBankAccounts.length > 0) {
      // null = not initialized yet → use all accounts as default
      // [] = user explicitly deselected all → balance = 0
      // [...ids] = user selected specific accounts
      let accountsToInclude: any[];
      if (selectedBalanceAccountIds === null) {
        // Not initialized, use all accounts
        accountsToInclude = allBankAccounts;
      } else if (selectedBalanceAccountIds.length === 0) {
        // User explicitly deselected all
        accountsToInclude = [];
      } else {
        accountsToInclude = allBankAccounts.filter(acc => selectedBalanceAccountIds.includes(acc.id));
      }

      const totalBalance = accountsToInclude.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

      setBankAccountData(prev => ({
        ...prev,
        hasAccounts: true,
        totalBalance,
        count: accountsToInclude.length
      }));
    }
  }, [selectedBalanceAccountIds, allBankAccounts]);

  // Expense Source State for Pie Chart
  const [expenseSource, setExpenseSource] = useState<'credit' | 'checking'>('credit');
  const [animateOverviewGlowOnMount] = useState(() => {
    if (hasPlayedOverviewGlowIntro) return false;
    hasPlayedOverviewGlowIntro = true;
    return true;
  });

  const cycleExpenseSource = (direction: number) => {
    const sources: ('credit' | 'checking')[] = ['credit', 'checking'];
    const currentIndex = sources.indexOf(expenseSource);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = sources.length - 1;
    if (newIndex >= sources.length) newIndex = 0;
    setExpenseSource(sources[newIndex]);
  };

  const getExpenseSourceLabel = () => {
    switch (expenseSource) {
      case 'credit': return 'Cartão';
      case 'checking': return 'Conta';
      default: return 'Cartão';
    }
  };

  useEffect(() => {
    menuProgress.value = withSpring(menuVisible ? 1 : 0, {
      mass: 0.6,
      damping: 15,
      stiffness: 200,
      overshootClamping: false,
    });
  }, [menuVisible]);

  // Animated Props for VictoryPie (requires creating an Animated Component if not supported directly,
  // but usually standard React state causes re-renders.
  // To fix "laggy" animation, we need to avoid React State updates on every frame.
  // VictoryNative works best with its own animation prop, but since that failed,
  // we will try a different approach: Using a simple React State but with fewer steps or optimized.

  // Reverting to Victory's built-in animation but forcing a reset
  // Removed redundant chartKey effect needed for VictoryPie
  // The key property on VictoryPie using expenseSource is sufficient

  // Fetch recurrences for calendar
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = databaseService.onRecurrencesChange(user.uid, (data) => {
      setRecurrences(data);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    notificationService.reschedulePaymentAlerts({
      userId: user.uid,
      enabled: paymentAlertsEnabled,
      recurrences,
      accounts: paymentAlertCards,
      plan: profile?.subscription || null,
      invoicePreferences: { daysBeforeDue: 3, showAmount: true },
    });
  }, [user?.uid, paymentAlertsEnabled, recurrences, paymentAlertCards, profile?.subscription]);

  const hasInitialLoadRef = useRef(false);
  const lastMonthKeyLoadedRef = useRef<string | null>(null);
  const selectedMonthRef = useRef(selectedMonth);
  const selectedBalanceAccountIdsRef = useRef<string[] | null>(selectedBalanceAccountIds);
  const creditOverviewRunIdRef = useRef(0);

  useEffect(() => {
    selectedMonthRef.current = selectedMonth;
  }, [selectedMonth]);

  useEffect(() => {
    selectedBalanceAccountIdsRef.current = selectedBalanceAccountIds;
  }, [selectedBalanceAccountIds]);

  const fetchMonthScopedData = useCallback(async (month: Date) => {
    const t0 = Date.now();
    if (!user?.uid) {
      return;
    }

    const { startDate, nextMonthStart } = getFirestoreMonthRange(month);
    const transactionsRef = collection(db, 'users', user.uid, 'transactions');
    const creditRef = collection(db, 'users', user.uid, 'creditCardTransactions');

    const qTransactions = query(
      transactionsRef,
      where('date', '>=', startDate),
      where('date', '<', nextMonthStart),
      orderBy('date', 'desc'),
      limit(100)
    );

    const qCredit = query(
      creditRef,
      where('date', '>=', startDate),
      where('date', '<', nextMonthStart),
      orderBy('date', 'desc'),
      limit(100)
    );

    const [txSnapshot, creditSnapshot] = await Promise.all([
      getDocs(qTransactions),
      getDocs(qCredit)
    ]);

    const mappedTxs: Transaction[] = txSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        description: data.description || '',
        amount: Math.abs(data.amount || 0),
        date: normalizeTransactionDateValue(data.date),
        type: normalizeCheckingTransactionType(data),
        category: data.category || undefined,
        accountId: data.accountId || undefined,
      };
    });

    const mappedCreditTxs: Transaction[] = creditSnapshot.docs.map(doc => {
      const data = doc.data();
      const txCardId = data.cardId || data.accountId || data.pluggyAccountId || data.pluggyRaw?.accountId || null;
      return {
        id: doc.id,
        description: data.description || '',
        amount: Math.abs(data.amount || 0),
        date: normalizeTransactionDateValue(data.date),
        type: normalizeCreditTransactionType(data),
        category: data.category || null,
        cardId: txCardId,
        accountId: txCardId,
        invoiceMonthKey: data.invoiceMonthKey || null,
        invoiceMonthKeyManual: data.invoiceMonthKeyManual === true,
      };
    });

    setCheckingTransactions(mappedTxs);
    setCreditCardTransactions(mappedCreditTxs);
    // Performance: log duration for month-scoped data fetch
    if (typeof console !== 'undefined') {
      console.log('[Perf Dashboard] fetchMonthScopedData duration', Date.now() - t0, 'monthKey', toMonthKey(month));
    }
  }, [user?.uid]);

  const fetchCreditOverviewData = useCallback(async ({ awaitHeavy = false }: { awaitHeavy?: boolean } = {}) => {
    const t0Credit = Date.now();
    if (!user?.uid) {
      return;
    }

    const runId = ++creditOverviewRunIdRef.current;
    const fetchAccounts = async () => databaseService.getAccounts(user.uid);
    const accountsResult = await queryCache.get(`accounts_${user.uid}`, fetchAccounts, { ttlMinutes: 10, persist: true });

    if (runId !== creditOverviewRunIdRef.current) {
      return;
    }

    if (!accountsResult?.success || !accountsResult.data) {
      setCreditCardData(prev => ({ ...prev, hasCards: false }));
      setInvoiceData({ pastTotal: 0, currentTotal: 0, nextTotal: 0, cards: [] });
      setPaymentAlertCards([]);
      setAllBankAccounts([]);
      setBankAccountData({ hasAccounts: false, totalBalance: 0, count: 0 });
      return;
    }

    const accounts = accountsResult.data;
    const prefs = profile?.preferences as any;
    const hiddenAccountIds = ((prefs?.hiddenAccountIds as string[]) || []);
    const bankAccounts = accounts.filter((acc: any) =>
      acc.subtype === 'CHECKING_ACCOUNT' &&
      acc.type !== 'credit' &&
      acc.type !== 'CREDIT' &&
      acc.type !== 'CREDIT_CARD' &&
      acc.subtype !== 'CREDIT_CARD' &&
      !hiddenAccountIds.includes(acc.id)
    );
    setAllBankAccounts(bankAccounts);

    if (bankAccounts.length === 0) {
      setBankAccountData({ hasAccounts: false, totalBalance: 0, count: 0 });
    } else {
      const hasSavedPreference = prefs && 'balanceAccountIds' in prefs;
      const savedAccountIds = hasSavedPreference ? (prefs.balanceAccountIds as string[]) : null;
      const effectiveSelectedIds = selectedBalanceAccountIdsRef.current === null
        ? (savedAccountIds !== null ? savedAccountIds : bankAccounts.map((acc: any) => acc.id))
        : selectedBalanceAccountIdsRef.current;

      if (selectedBalanceAccountIdsRef.current === null) {
        setSelectedBalanceAccountIds(effectiveSelectedIds);
      }

      const accountsToInclude = effectiveSelectedIds.length === 0
        ? []
        : bankAccounts.filter((acc: any) => effectiveSelectedIds.includes(acc.id));
      const totalBalance = accountsToInclude.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

      // Atualiza saldo imediatamente sem esperar pipeline pesado de cartão.
      setBankAccountData({
        hasAccounts: true,
        totalBalance,
        count: accountsToInclude.length
      });
    }

    const creditCards = accounts
      .filter((acc: any) =>
        (acc.type === 'credit' || acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD' || acc.subtype === 'CREDIT_CARD') &&
        acc.type !== 'BANK' &&
        acc.subtype !== 'SAVINGS_ACCOUNT' &&
        acc.subtype !== 'CHECKING_ACCOUNT' &&
        !acc.name.toLowerCase().includes('elite master') &&
        !acc.name.toLowerCase().includes('elite visa')
      )
      .sort((a: any, b: any) => (b.creditData?.creditLimit || 0) - (a.creditData?.creditLimit || 0));

    const notificationCards: CreditCardAccount[] = creditCards.map((card: any) => ({
      id: card.id,
      name: card.name,
      type: 'credit',
      creditLimit: card.creditData?.creditLimit || 0,
      currentBill: card.currentBill,
    }));
    setPaymentAlertCards(notificationCards);

    if (creditCards.length === 0) {
      setCreditCardData(prev => ({ ...prev, hasCards: false }));
      setInvoiceData({ pastTotal: 0, currentTotal: 0, nextTotal: 0, cards: [] });
      return;
    }

    const runHeavyAggregation = async () => {
      const fetchAllCreditTransactions = async () => {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - CREDIT_OVERVIEW_WINDOW_MONTHS);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const creditTxRef = collection(db, 'users', user.uid, 'creditCardTransactions');
        const cardIds = new Set(creditCards.map((card: any) => card.id));
        const txCountByCard = new Map<string, number>();
        cardIds.forEach((cardId) => txCountByCard.set(cardId, 0));
        const collectedTransactions: Transaction[] = [];
        let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

        while (true) {
          const qCredit: Query<DocumentData> = cursor
            ? query(
              creditTxRef,
              where('date', '>=', cutoffDateStr),
              orderBy('date', 'desc'),
              startAfter(cursor),
              limit(CREDIT_OVERVIEW_BATCH_SIZE)
            )
            : query(
              creditTxRef,
              where('date', '>=', cutoffDateStr),
              orderBy('date', 'desc'),
              limit(CREDIT_OVERVIEW_BATCH_SIZE)
            );

          const snapshot = await getDocs(qCredit);
          if (snapshot.empty) {
            break;
          }

          snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data();
            const txCardId = data.cardId || data.accountId || data.pluggyAccountId || data.pluggyRaw?.accountId || null;
            if (!txCardId || !cardIds.has(txCardId)) {
              return;
            }

            const currentCount = txCountByCard.get(txCardId) || 0;
            if (currentCount >= CREDIT_OVERVIEW_MAX_ITEMS_PER_CARD) {
              return;
            }

            txCountByCard.set(txCardId, currentCount + 1);
            collectedTransactions.push({
              id: doc.id,
              description: data.description || '',
              amount: Math.abs(data.amount || 0),
              date: normalizeTransactionDateValue(data.date),
              type: normalizeCreditTransactionType(data),
              category: data.category || null,
              cardId: txCardId,
              accountId: txCardId,
              installmentNumber: data.installmentNumber || 1,
              totalInstallments: data.totalInstallments || 1,
              invoiceMonthKey: data.invoiceMonthKey || null,
              invoiceMonthKeyManual: data.invoiceMonthKeyManual === true,
              isRefund: data.isRefund || false,
              originalTransactionId: data.originalTransactionId || null
            } as Transaction);
          });

          const reachedPerCardLimit = Array.from(txCountByCard.values()).every((count) => count >= CREDIT_OVERVIEW_MAX_ITEMS_PER_CARD);
          if (reachedPerCardLimit || snapshot.docs.length < CREDIT_OVERVIEW_BATCH_SIZE) {
            break;
          }

          cursor = snapshot.docs[snapshot.docs.length - 1];
        }

        return collectedTransactions;
      };

      const allCreditTransactions = ((await queryCache.get(
        `dashboard_credit_transactions_${user.uid}_v2`,
        fetchAllCreditTransactions,
        { ttlMinutes: 10, persist: true }
      )) || []) as Transaction[];

      if (runId !== creditOverviewRunIdRef.current) {
        return;
      }

      const transactionsByCard = new Map<string, Transaction[]>();
      allCreditTransactions.forEach((tx) => {
        const txCardId = tx.cardId || tx.accountId;
        if (!txCardId) {
          return;
        }
        const cardTxs = transactionsByCard.get(txCardId);
        if (cardTxs) {
          cardTxs.push(tx);
        } else {
          transactionsByCard.set(txCardId, [tx]);
        }
      });

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          if (runId !== creditOverviewRunIdRef.current) {
            resolve();
            return;
          }

          let totalInvoice = 0;
          let totalLimit = 0;
          let totalAvailable = 0;
          const cardDetails: Array<{
            id: string;
            name: string;
            past: number;
            current: number;
            next: number;
            limit: number;
            used: number;
            dueDate: Date | null;
            closingDate: Date | null;
          }> = [];

          creditCards.forEach((card: any) => {
            const cardTransactions = (transactionsByCard.get(card.id) || []).slice(0, CREDIT_OVERVIEW_MAX_ITEMS_PER_CARD);
            const builtInvoices = card.currentBill?.id && card.bills?.length
              ? buildInvoicesPluggyFirst(card, cardTransactions, card.id)
              : buildInvoices(card, cardTransactions, card.id);

            const cardLimit = card.creditData?.creditLimit || card.creditLimit || 0;
            const available = card.creditData?.availableCreditLimit || card.availableCreditLimit || 0;
            const used = cardLimit > 0 ? (cardLimit - available) : Math.abs(card.balance || 0);

            totalLimit += cardLimit;
            totalAvailable += available;

            const currentValue = Math.abs(builtInvoices.currentInvoice.total || 0);
            const previousValue = Math.abs(builtInvoices.closedInvoice.total || 0);
            const nextValue = Math.abs(builtInvoices.futureInvoices[0]?.total || 0);

            totalInvoice += currentValue;
            cardDetails.push({
              id: card.id,
              name: card.name || card.connector?.name || 'Cartao',
              past: previousValue,
              current: currentValue,
              next: nextValue,
              limit: cardLimit,
              used,
              dueDate: builtInvoices.currentInvoice.dueDate ? parseDate(builtInvoices.currentInvoice.dueDate) : null,
              closingDate: builtInvoices.currentInvoice.closingDate ? parseDate(builtInvoices.currentInvoice.closingDate) : null
            });
          });

          const totalUsed = totalLimit > 0 ? (totalLimit - totalAvailable) : totalInvoice;
          const usagePercentage = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

          setCreditCardData({
            hasCards: true,
            totalInvoice,
            totalLimit,
            totalUsed,
            usagePercentage
          });

          setInvoiceData({
            pastTotal: cardDetails.reduce((sum, card) => sum + card.past, 0),
            currentTotal: totalInvoice,
            nextTotal: cardDetails.reduce((sum, card) => sum + card.next, 0),
            cards: cardDetails
          });

          // Log duration after heavy aggregation completes
          console.log('[Perf Dashboard] fetchCreditOverviewData heavyAggregation duration', Date.now() - t0Credit);
          resolve();
        });
      });
    };

    if (awaitHeavy) {
      await runHeavyAggregation();
    } else {
      void runHeavyAggregation();
    }
  }, [profile, user?.uid]); // Removed unnecessary dependencies

  useEffect(() => {
    if (!user?.uid) {
      hasInitialLoadRef.current = false;
      lastMonthKeyLoadedRef.current = null;
      return;
    }

    let active = true;
    const load = async () => {
      const t0Initial = Date.now();
      try {
        const initialMonth = selectedMonthRef.current;
        const plan = getDashboardLoadPlan({
          trigger: 'initial',
          hasUser: !!user?.uid,
          hasInitialLoad: hasInitialLoadRef.current,
          lastMonthKeyLoaded: lastMonthKeyLoadedRef.current,
          selectedMonthKey: toMonthKey(initialMonth),
        });
        if (!plan.fetchMonthScopedData && !plan.fetchCreditOverviewData) {
          return;
        }

        setIsLoading(true);
        if (typeof console !== 'undefined') {
          console.log('[Perf Dashboard] initial load started', { t0Initial });
        }
        const requests: Array<Promise<any>> = [];
        if (plan.fetchMonthScopedData) {
          requests.push(fetchMonthScopedData(initialMonth));
        }
        if (plan.fetchCreditOverviewData) {
          // Await heavy aggregation on initial load to prevent "flash of zero"
          // With cache, this is fast enough to not feel laggy
          requests.push(fetchCreditOverviewData({ awaitHeavy: true }));
        }
        await Promise.all(requests);
        if (typeof console !== 'undefined') {
          console.log('[Perf Dashboard] initial load completed in', Date.now() - t0Initial, 'ms');
        }

        if (!active) {
          return;
        }
        if (plan.markInitialLoad) {
          hasInitialLoadRef.current = true;
        }
        lastMonthKeyLoadedRef.current = plan.updateLastMonthKey;
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [fetchCreditOverviewData, fetchMonthScopedData, user?.uid]);

  useEffect(() => {
    const plan = getDashboardLoadPlan({
      trigger: 'month_change',
      hasUser: !!user?.uid,
      hasInitialLoad: hasInitialLoadRef.current,
      lastMonthKeyLoaded: lastMonthKeyLoadedRef.current,
      selectedMonthKey,
    });
    if (!plan.fetchMonthScopedData) {
      return;
    }
    void fetchMonthScopedData(selectedMonth);
    lastMonthKeyLoadedRef.current = plan.updateLastMonthKey;
  }, [fetchMonthScopedData, selectedMonth, selectedMonthKey, user?.uid]);

  const onRefresh = useCallback(async () => {
    const plan = getDashboardLoadPlan({
      trigger: 'refresh',
      hasUser: !!user?.uid,
      hasInitialLoad: hasInitialLoadRef.current,
      lastMonthKeyLoaded: lastMonthKeyLoadedRef.current,
      selectedMonthKey,
    });

    if (!user?.uid || (!plan.fetchMonthScopedData && !plan.fetchCreditOverviewData)) {
      return;
    }

    setRefreshing(true);
    try {
      const requests: Array<Promise<any>> = [];

      // Invalidate cache on manual refresh
      await queryCache.invalidate(`accounts_${user.uid}`);
      await queryCache.invalidate(`dashboard_credit_transactions_${user.uid}_v2`);
      await queryCache.invalidate(`dashboard_credit_transactions_${user.uid}`);

      if (plan.fetchMonthScopedData) {
        requests.push(fetchMonthScopedData(selectedMonth));
      }
      if (plan.fetchCreditOverviewData) {
        requests.push(fetchCreditOverviewData({ awaitHeavy: true }));
      }
      await Promise.all(requests);
      lastMonthKeyLoadedRef.current = plan.updateLastMonthKey;
    } finally {
      setRefreshing(false);
    }
  }, [fetchCreditOverviewData, fetchMonthScopedData, selectedMonth, selectedMonthKey, user?.uid]);
  const animatedContainerStyle = useAnimatedStyle(() => {
    // Pivot from top-right (approximate using translate/scale)
    // When progress is 0: scale 0.6, translateX 40, translateY -20
    const scale = interpolate(menuProgress.value, [0, 1], [0.6, 1]);
    const opacity = interpolate(menuProgress.value, [0, 0.4, 1], [0, 1, 1]);

    const translateX = interpolate(menuProgress.value, [0, 1], [30, 0]);
    const translateY = interpolate(menuProgress.value, [0, 1], [-20, 0]);

    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { scale },
      ],
    };
  });



  const displayName = profile?.name || user?.email || undefined;
  const initials = getInitials(displayName);
  const gradientColors = getAvatarGradient(user?.email || displayName);



  const pieData = useMemo(() => {
    const transactions = expenseSource === 'credit' ? creditCardTransactions : checkingTransactions;

    const expenses = transactions.filter(t =>
      t.type === 'expense' &&
      t.date &&
      extractMonthKey(t.date) === selectedMonthKey
    );

    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    if (totalExpense === 0) {
      return [];
    }

    const categoryMap = new Map<string, number>();
    expenses.forEach((transaction) => {
      const categoryName = getCategoryName(transaction.category);
      categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + transaction.amount);
    });

    const colors = ['#A855F7', '#BEF264', '#06B6D4', '#F472B6', '#FBBF24', '#9CA3AF'];
    const chartData: Array<{ x: string; y: number; color: string; percent: number }> = [];

    let colorIndex = 0;
    categoryMap.forEach((amount, category) => {
      chartData.push({
        x: category,
        y: amount,
        color: colors[colorIndex % colors.length],
        percent: (amount / totalExpense) * 100,
      });
      colorIndex += 1;
    });

    const maxCategories = lod >= 2 ? 4 : lod === 1 ? 5 : 6;
    return chartData.sort((a, b) => b.y - a.y).slice(0, maxCategories);
  }, [checkingTransactions, creditCardTransactions, expenseSource, getCategoryName, lod, selectedMonthKey]);

  const selectedCreditExpenseTotal = useMemo(() => {
    return invoiceData.cards.reduce((sum, card) => {
      const period = getCardInvoicePeriod(card.id);
      let val = 0;
      if (period === 'past') val = card.past;
      else if (period === 'current') val = card.current;
      else if (period === 'next') val = card.next;
      else if (period === 'total_used') val = card.used;
      else if (period === 'none') val = 0;
      return sum + Math.abs(val);
    }, 0);
  }, [invoiceData.cards, getCardInvoicePeriod]);

  const selectedCardForModalData = useMemo(() => {
    const selectedCardId = selectedCardForModal?.id;
    if (!selectedCardId) {
      return null;
    }
    return invoiceData.cards.find(card => card.id === selectedCardId) || selectedCardForModal;
  }, [invoiceData.cards, selectedCardForModal]);

  const selectedCardModalPeriod = getCardInvoicePeriod(selectedCardForModalData?.id);

  // Compute carousel data for render and dots
  const carouselData = React.useMemo(() => [
    ...(creditCardData.hasCards && invoiceData.cards.length > 0 ? invoiceData.cards.map(c => ({
      type: 'credit' as const,
      key: c.id,
      ...c
    })) : [])
  ], [creditCardData.hasCards, invoiceData.cards]);

  return (
    <View style={styles.mainContainer}>
      {/* Background no topo */}
      <UniversalBackground
        backgroundColor="#0C0C0C"
        glowSize={350}
        height={280}
        animateGlowOnMount={animateOverviewGlowOnMount}
        glowIntroDurationMs={900}
        showParticles={true}
        particleCount={12}
      />

      {/* Conteúdo do dashboard */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D97757"
            colors={['#D97757']}
          />
        }
      >
        {/* Header with avatar and month navigator */}
        <View style={[styles.header, { zIndex: 10 }]}>
          <View style={{ justifyContent: 'center', alignItems: 'flex-start' }}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
              contentPosition={{ left: 0 }}
            />
          </View>
          <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
            {/* Avatar - Moved First for row-reverse anchoring */}
            <View style={{ position: 'relative', zIndex: 10 }}>
              <TouchableOpacity
                onPress={() => setMenuVisible(!menuVisible)}
                activeOpacity={0.8}
              >
                <View style={styles.avatar}>
                  <Avvvatars value={user?.email || (profile as any)?.name || user?.displayName || 'Guest'} size={32} style="shape" />
                </View>
              </TouchableOpacity>

              <Animated.View
                pointerEvents={menuVisible ? 'auto' : 'none'}
                style={[styles.dropdownContainer, animatedContainerStyle]}
              >
                <View style={styles.dropdownArrow} />
                <View style={styles.dropdownBlur}>
                  <View style={styles.dropdownContent}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setMenuVisible(false);
                        router.push('/settings');
                      }}
                    >
                      <Text style={styles.dropdownText}>Configuração</Text>
                    </TouchableOpacity>
                    <View style={styles.dropdownDivider} />
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={async () => {
                        setMenuVisible(false);
                        await signOut();
                      }}
                    >
                      <Text style={styles.dropdownTextDestructive}>Sair</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </View>


          </View>
        </View>

        {/* Content Section -- Month navigator moved to header */}
        <View style={styles.content}>
          <OverviewSection
            isValuesVisible={isValuesVisible}
            setIsValuesVisible={setIsValuesVisible}
            isLoading={isLoading}
            selectedMonthKey={selectedMonthKey}
            checkingTransactions={checkingTransactions}
            bankAccountData={bankAccountData}
            selectedCreditExpenseTotal={selectedCreditExpenseTotal}
            projectionSettings={projectionSettings}
            salaryPreview={salaryPreview}
            valePreview={valePreview}
            recurrences={recurrences}
            includeOpenFinance={includeOpenFinance}
            onProjectionsPress={() => setShowProjectionsModal(true)}
            onNewExtraPress={() => setExtraModalVisible(true)}
          />




          {/* Main Balance Container */}
          {bankAccountData.hasAccounts && (
            <View style={{ marginBottom: 16 }}>
              <View style={[styles.sectionHeader, { marginTop: 16, marginBottom: 12, alignItems: 'center' }]}>
                <Text style={[styles.sectionTitle, { fontSize: 16, color: '#909090' }]}>Minhas Contas</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.95}
                style={[styles.incomeCard, { marginTop: 0, width: '100%', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 70 }]}
                onPress={() => setBalanceModalVisible(true)}
              >
                {/* Left side */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <DelayedLoopLottie
                    source={require('../../assets/carteira.json')}
                    style={{ width: 36, height: 36 }}
                    delay={1000}
                    throttleMultiplier={1.15}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'AROneSans_500Medium', color: '#909090', letterSpacing: 0.5 }}>
                        SALDO PRINCIPAL
                      </Text>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#04D361' }} />
                      <Text style={{ fontSize: 11, color: '#909090', fontFamily: 'AROneSans_500Medium' }}>
                        {bankAccountData.count} {bankAccountData.count === 1 ? 'conta' : 'contas'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#E0E0E0', marginRight: 4, letterSpacing: -0.5 }}>
                        {bankAccountData.totalBalance < 0 ? '-R$' : 'R$'}
                      </Text>
                      {isValuesVisible ? (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                          <RollingCounter
                            value={Math.abs(bankAccountData.totalBalance)}
                            height={28}
                            width={14}
                            fontSize={24}
                            letterSpacing={-0.5}
                            color="#FFFFFF"
                          />
                          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: -0.5 }}>
                            ,{Math.abs(bankAccountData.totalBalance).toFixed(2).slice(-2)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: -0.5, paddingTop: 6 }}>
                          ••••
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Right side: Chevron */}
                <View style={{ paddingLeft: 8 }}>
                  <View style={styles.chevronContainer}>
                    <ChevronRight size={18} color="#505050" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Unified Stack Carousel for Credit Cards */}
          {
            (carouselData.length > 0) && (
              <View>
                {/* Header with Title and Dots */}
                <View style={[styles.sectionHeader, { marginTop: 16, marginBottom: 12, alignItems: 'center' }]}>
                  <Text style={[styles.sectionTitle, { fontSize: 16, color: '#909090' }]}>Meus Cartões</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {carouselData.map((_, index) => (
                      <View
                        key={index}
                        style={{
                          width: currentCardIndex === index ? 20 : 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: currentCardIndex === index ? '#D97757' : '#333',
                        }}
                      />
                    ))}
                  </View>
                </View>

                <StackCarousel
                  data={carouselData}
                  onSnapToItem={setCurrentCardIndex}

                  cardHeight={110}
                  cardWidth={Dimensions.get('window').width - 32}
                  renderItem={({ item, index, animatedIndex, translateX, totalCards }) => {
                    // Hook must be called unconditionally at top level of component
                    const cardWidth = Dimensions.get('window').width - 32;
                    const animatedStyle = useStackCardStyle(index, animatedIndex, translateX, totalCards, cardWidth, 12);

                    const cardItem = item as any;
                    const selectedPeriod = getCardInvoicePeriod(cardItem.id);
                    const selectedRawValue =
                      selectedPeriod === 'past' ? cardItem.past :
                        selectedPeriod === 'next' ? cardItem.next :
                          selectedPeriod === 'total_used' ? cardItem.used :
                            selectedPeriod === 'none' ? 0 :
                              cardItem.current;
                    const selectedValue = Math.abs(selectedRawValue);

                    const percentage = cardItem.limit > 0
                      ? Math.min((selectedValue / cardItem.limit) * 100, 100)
                      : 0;

                    const progressColor = percentage > 90 ? '#FF4C4C' : percentage > 70 ? '#FFB800' : '#4CAF50';

                    return (
                      <Animated.View style={[styles.stackCardWrapper, animatedStyle, { position: 'absolute', width: '100%', height: '100%' }]}>
                        <TouchableOpacity
                          activeOpacity={0.95}
                          style={[styles.incomeCard, { marginTop: 0, width: '100%', height: '100%', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'column', alignItems: 'stretch' }]}
                          onPress={() => {
                            setSelectedCardForModal(cardItem);
                            setInvoiceModalVisible(true);
                          }}
                        >
                          {/* Header: Icon + Name ... Status */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                              <DelayedLoopLottie
                                source={require('../../assets/cartabranco.json')}
                                style={{ width: 22, height: 22 }}
                                delay={1000}
                                throttleMultiplier={1.15}
                              />
                              <Text
                                style={{ fontSize: 12, fontFamily: 'AROneSans_500Medium', color: '#E0E0E0', letterSpacing: 0.5, flex: 1 }}
                                numberOfLines={1}
                              >
                                {cardItem.name.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 10, fontFamily: 'AROneSans_500Medium', color: '#666666', letterSpacing: 0.5 }}>
                              • {
                                selectedPeriod === 'past' ? 'FATURA ANTERIOR' :
                                  selectedPeriod === 'next' ? 'PRÓXIMA FATURA' :
                                    selectedPeriod === 'total_used' ? 'LIMITE USADO' :
                                      selectedPeriod === 'none' ? 'OCULTO' : 'FATURA ATUAL'
                              }
                            </Text>
                          </View>

                          {/* Main Value and Due Date - Left Aligned */}
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginRight: 10 }}>
                              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#E0E0E0', marginRight: 4, letterSpacing: -0.5 }}>
                                {selectedValue < 0 ? '-R$' : 'R$'}
                              </Text>
                              {isValuesVisible ? (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                  <RollingCounter
                                    value={Math.abs(selectedValue)}
                                    height={28}
                                    width={14}
                                    fontSize={24}
                                    letterSpacing={-0.5}
                                    color="#FFFFFF"
                                  />
                                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: -0.5 }}>
                                    ,{Math.abs(selectedValue).toFixed(2).slice(-2)}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: -0.5, paddingTop: 4 }}>
                                  ••••
                                </Text>
                              )}
                            </View>
                            {cardItem.dueDate && (
                              <Text style={{ fontSize: 11, fontFamily: 'AROneSans_400Regular', color: '#909090' }}>
                                Vence {new Date(cardItem.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </Text>
                            )}
                          </View>

                          {/* Progress Bar and Limits */}
                          <View style={{ width: '100%', marginTop: 'auto' }}>
                            <View style={{ width: '100%', height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, marginBottom: 6 }}>
                              <View style={{ height: '100%', width: `${percentage}%`, backgroundColor: progressColor, borderRadius: 2 }} />
                            </View>

                            {/* Footer: Limits - Space Between */}
                            <View
                              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                              <AnimatedCurrency
                                value={cardItem.limit - selectedValue}
                                isVisible={isValuesVisible}
                                style={{ fontSize: 10, color: '#909090', fontFamily: 'AROneSans_400Regular' }}
                                prefix="Disp: R$ "
                              />
                              <AnimatedCurrency
                                value={cardItem.limit}
                                isVisible={isValuesVisible}
                                style={{ fontSize: 10, color: '#04D361', fontFamily: 'AROneSans_600SemiBold' }}
                                prefix="Limite: R$ "
                                prefixStyle={{ fontSize: 10, color: '#04D361', fontFamily: 'AROneSans_500Medium' }}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  }}
                />
              </View>
            )
          }

          {/* Cálculos removed */}

          {/* Expenses Pie Chart */}
          <View style={{ marginTop: 24, paddingHorizontal: 0 }}>
            <View style={[styles.sectionHeader, { marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[styles.sectionTitle, { fontSize: 16, color: '#909090' }]}>Despesas por Categoria</Text>

              {/* Source Selector */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4, borderWidth: 1, borderColor: '#2A2A2A', gap: 2 }}>
                <TouchableOpacity onPress={() => cycleExpenseSource(-1)} style={{ padding: 4 }}>
                  <ChevronLeft size={16} color="#909090" />
                </TouchableOpacity>
                <Text style={{ color: '#E0E0E0', fontSize: 12, fontFamily: 'AROneSans_500Medium', minWidth: 50, textAlign: 'center' }}>
                  {getExpenseSourceLabel()}
                </Text>
                <TouchableOpacity onPress={() => cycleExpenseSource(1)} style={{ padding: 4 }}>
                  <ChevronRight size={16} color="#909090" />
                </TouchableOpacity>
              </View>
            </View>

            {pieData.length > 0 ? (
              <View style={[styles.summaryCard, { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' }]}>
                {/* Chart Section - Left */}
                <View style={{ width: '55%', alignItems: 'center', justifyContent: 'center' }}>
                  <VictoryPie
                    key={expenseSource} // Depend only on source for remounting
                    animate={{
                      duration: budget.chartAnimationMs,
                      easing: "exp"
                    }}
                    data={pieData}
                    // Remove endAngle prop as we are using built-in animation now
                    width={Dimensions.get('window').width * 0.45}
                    height={180}
                    padding={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    colorScale={pieData.map(d => d.color)}
                    innerRadius={30}
                    cornerRadius={6}
                    padAngle={3}
                    style={{
                      data: { fillOpacity: 0.9, stroke: 'none' },
                      labels: { fill: "#1A1A1A", fontSize: 10, fontWeight: "bold" }
                    }}
                    labelRadius={({ innerRadius }) => (typeof innerRadius === 'number' ? innerRadius + 18 : 50)}
                    labelComponent={
                      <VictoryLabel
                        angle={0}
                        textAnchor="middle"
                        verticalAnchor="middle"
                        backgroundPadding={[{ top: 3, bottom: 3, left: 5, right: 5 }]}
                        backgroundStyle={[{ fill: "#FFFFFF", opacity: 0.95, rx: 6 }]}
                      />
                    }
                    labels={({ datum }) => `${Math.round(datum.percent)}%`}
                  />
                </View>

                {/* Legend Section - Right */}
                <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 10, paddingLeft: 12 }}>
                  {pieData.map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
                      <Text
                        style={{ color: '#E0E0E0', fontSize: 13, fontFamily: 'AROneSans_500Medium', flex: 1 }}
                        numberOfLines={1}
                      >
                        {item.x}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={[styles.summaryCard, { justifyContent: 'center', padding: 32, alignItems: 'center' }]}>
                <Text style={{ color: '#909090', fontFamily: 'AROneSans_400Regular' }}>Nenhuma despesa encontrada</Text>
              </View>
            )}
          </View>


          {/* Financial Calendar */}
          <FinancialCalendar
            checkingTransactions={checkingTransactions}
            creditCardTransactions={creditCardTransactions}
            recurrences={recurrences}
            selectedMonth={selectedMonth}
            minMonth={minMonth}
            maxMonth={maxMonth}
            onMonthChange={(date) => setSelectedMonth(clampMonth(date, minMonth, maxMonth))}
          />

          {/* Projections Modal */}
          <ProjectionsModal
            visible={showProjectionsModal}
            onClose={() => setShowProjectionsModal(false)}
            currentSettings={projectionSettings}
            onSave={handleSaveProjections}
            salaryPreview={salaryPreview}
            valePreview={valePreview}
            includeOpenFinance={includeOpenFinance}
            onToggleOpenFinance={handleToggleOpenFinance}
          />

        </View >
      </ScrollView >

      {invoiceModalVisible && (
        <ModalPadrao
          visible={invoiceModalVisible}
          onClose={() => setInvoiceModalVisible(false)}
          title={`Selecionar Fatura - ${selectedCardForModalData?.name?.trim() || ''}`}
        >
          <View style={modalOptionStyles.sectionCard}>

            {/* Fatura Anterior */}
            <TouchableOpacity
              style={modalOptionStyles.itemContainer}
              onPress={() => handleInvoicePeriodChange('past')}
            >
              <View style={modalOptionStyles.itemIconContainer}>
                <RotateCcw size={20} color={selectedCardModalPeriod === 'past' ? '#D97757' : '#E0E0E0'} />
              </View>
              <View style={modalOptionStyles.itemRightContainer}>
                <View style={modalOptionStyles.itemContent}>
                  <View>
                    <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'past' && { color: '#D97757' }]}>Anterior</Text>
                    <Text style={modalOptionStyles.itemSubtitle}>Visualizar fatura passada</Text>
                  </View>
                  <Text style={modalOptionStyles.itemValue}>
                    R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(selectedCardForModalData ? selectedCardForModalData.past : invoiceData.pastTotal))}
                  </Text>
                </View>
              </View>
              <View style={modalOptionStyles.itemSeparator} />
            </TouchableOpacity>

            {/* Fatura Atual */}
            <TouchableOpacity
              style={modalOptionStyles.itemContainer}
              onPress={() => handleInvoicePeriodChange('current')}
            >
              <View style={modalOptionStyles.itemIconContainer}>
                <CreditCard size={20} color={selectedCardModalPeriod === 'current' ? '#D97757' : '#E0E0E0'} />
              </View>
              <View style={modalOptionStyles.itemRightContainer}>
                <View style={modalOptionStyles.itemContent}>
                  <View>
                    <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'current' && { color: '#D97757' }]}>Atual</Text>
                    <Text style={modalOptionStyles.itemSubtitle}>Visualizar mês vigente</Text>
                  </View>
                  <Text style={modalOptionStyles.itemValue}>
                    R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(selectedCardForModalData ? selectedCardForModalData.current : invoiceData.currentTotal))}
                  </Text>
                </View>
              </View>
              <View style={modalOptionStyles.itemSeparator} />
            </TouchableOpacity>

            {/* Limite Utilizado */}
            <TouchableOpacity
              style={modalOptionStyles.itemContainer}
              onPress={() => handleInvoicePeriodChange('total_used')}
            >
              <View style={modalOptionStyles.itemIconContainer}>
                <TrendingUp size={20} color={selectedCardModalPeriod === 'total_used' ? '#D97757' : '#E0E0E0'} />
              </View>
              <View style={modalOptionStyles.itemRightContainer}>
                <View style={modalOptionStyles.itemContent}>
                  <View>
                    <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'total_used' && { color: '#D97757' }]}>Total Usado</Text>
                    <Text style={modalOptionStyles.itemSubtitle}>Soma de todas as open invoices</Text>
                  </View>
                  <Text style={modalOptionStyles.itemValue}>
                    R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(selectedCardForModalData ? selectedCardForModalData.used : creditCardData.totalUsed))}
                  </Text>
                </View>
              </View>
              <View style={modalOptionStyles.itemSeparator} />
            </TouchableOpacity>

            {/* Nenhuma Fatura */}
            <TouchableOpacity
              style={modalOptionStyles.itemContainer}
              onPress={() => handleInvoicePeriodChange('none')}
            >
              <View style={modalOptionStyles.itemIconContainer}>
                <Ban size={20} color={selectedCardModalPeriod === 'none' ? '#FF4C4C' : '#E0E0E0'} />
              </View>
              <View style={modalOptionStyles.itemRightContainer}>
                <View style={modalOptionStyles.itemContent}>
                  <View>
                    <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'none' && { color: '#FF4C4C' }]}>Não considerar</Text>
                    <Text style={modalOptionStyles.itemSubtitle}>Ocultar faturas do resumo</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ModalPadrao >
      )}

      {/* Balance Accounts Configuration Modal */}
      {balanceModalVisible && (
        < BalanceAccountsModal
          visible={balanceModalVisible}
          onClose={() => setBalanceModalVisible(false)}
          userId={user?.uid || ''}
          accounts={allBankAccounts}
          selectedAccountIds={selectedBalanceAccountIds ?? allBankAccounts.map(a => a.id)}
          onSave={(selectedIds: string[]) => {
            setSelectedBalanceAccountIds(selectedIds);
          }}
        />
      )}

      {/* Extra Income Modal */}
      {extraModalVisible && (
        <ExtraIncomeModal
          visible={extraModalVisible}
          onClose={() => setExtraModalVisible(false)}
          onSave={(data) => {
            console.log('Extra Income Saved:', data);
            // TODO: Implement actual save logic with databaseService
            setExtraModalVisible(false);
          }}
        />
      )}

      {/* Config Modal */}
      <ConfigIncomeModal
        visible={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        includeOpenFinance={includeOpenFinance}
        onToggleOpenFinance={handleToggleOpenFinance}
      />
    </View >
  );
}

const modalOptionStyles = StyleSheet.create({
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
  itemValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  itemSeparator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
});

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    zIndex: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 140,
    height: 45,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Month Navigator Styles
  monthNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#252525',
  },
  monthNavButtonDisabled: {
    backgroundColor: '#1A1A1A',
    opacity: 0.5,
  },
  monthLabelContainer: {
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontFamily: 'AROneSans_600SemiBold',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  todayButton: {
    fontSize: 12,
    color: '#D97757',
    marginTop: 4,
    fontFamily: 'AROneSans_500Medium',
  },
  // Compact Month Navigator Styles (next to avatar)
  monthNavigatorCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthNavButtonCompact: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  monthNavButtonDisabledCompact: {
    opacity: 0.3,
  },
  monthLabelContainerCompact: {
    alignItems: 'center',
    minWidth: 100,
  },
  monthLabelCompact: {
    fontSize: 14,
    fontFamily: 'AROneSans_600SemiBold',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  todayButtonCompact: {
    fontSize: 10,
    color: '#D97757',
    marginTop: 2,
    fontFamily: 'AROneSans_500Medium',
  },
  content: {
    flex: 1,
  },
  // Section Header Styles
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

  // Income Info Styles (Simplified)
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBadge: {
    marginRight: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#909090',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
  amountText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 4,
  },
  perMonthText: {
    fontSize: 16,
    color: '#909090',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#383836',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 6,
  },
  dateBadgeText: {
    color: '#909090',
    fontSize: 12,
    fontWeight: '500',
  },

  // Income Card Styles
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
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dropdown Styles
  dropdownContainer: {
    position: 'absolute',
    top: 55,
    right: -10,
    minWidth: 160,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  dropdownArrow: {
    width: 16,
    height: 16,
    backgroundColor: '#141414',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: '#30302E',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    top: -8,
    right: 22, // Aligned with avatar center (adjusted for rounded corner)
    zIndex: 2,
  },
  dropdownBlur: {
    backgroundColor: '#141414',
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30302E',
    overflow: 'hidden',
  },
  dropdownContent: {
    paddingVertical: 4,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'AROneSans_500Medium',
  },
  dropdownTextDestructive: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'AROneSans_500Medium',
  },
  dropdownDivider: {
    height: 1,
    width: '100%',
    backgroundColor: '#30302E',
  },
  // Progress Bar Styles
  progressBarContainer: {
    height: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    marginBottom: 8,
    marginTop: 4,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFB800', // Yellow/Orange color from image
    borderRadius: 3,
  },
  limitContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitText: {
    fontSize: 12,
    color: '#00BFA5', // Teal color for "Limite" label
    fontWeight: '500',
  },
  limitValue: {
    color: '#00BFA5',
  },
  // Count Badge Styles
  countBadge: {
    backgroundColor: '#30302E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  countBadgeText: {
    color: '#909090',
    fontSize: 10,
    fontWeight: '500',
  },
  stackCardWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    marginBottom: 10, // Reduced to 10 + 15 (carousel padding) ~= 25px visual gap
  },
  shortcutItem: {
    alignItems: 'center',
    // Removed flex: 1 to allow space-between to push items to edges
    width: 70, // Fixed width larger than button to contain text
  },
  shortcutIconButton: {
    width: 64,
    height: 64,
    borderRadius: 22, // Slightly more rounded as per image
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
  // Summary Cards Styles
  summaryCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    width: '100%',
    gap: 16,
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
  configItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  configItemTitle: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  configItemSubtitle: {
    fontSize: 12,
    color: '#909090',
    lineHeight: 18,
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    // marginBottom removed as we are now row layout
  },
  summaryLabel: {
    fontSize: 14,
    color: '#909090',
    fontFamily: 'AROneSans_500Medium',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'AROneSans_700Bold',
    letterSpacing: -0.5,
  },
});
