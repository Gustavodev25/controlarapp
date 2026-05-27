import { BalanceAccountsModal } from '@/components/BalanceAccountsModal';
import { ExtraIncomeModal } from '@/components/ExtraIncomeModal';
import { ProjectionSettings, ProjectionsModal } from '@/components/ProjectionsModal';
import Avvvatars from '@/components/ui/Avvvatars';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';

import { ConfigIncomeModal } from '@/components/ConfigIncomeModal';
import { UniversalBackground } from '@/components/UniversalBackground';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import CalendarioFinanceiro from '@/components/visaogeral/CalendarioFinanceiro';
import DespesasPorCategoria from '@/components/visaogeral/DespesasPorCategoria';
import MeusCartoes from '@/components/visaogeral/MeusCartoes';
import MinhasContas from '@/components/visaogeral/MinhasContas';
import SaldoConta from '@/components/visaogeral/SaldoConta';
import { INVOICE_PERIOD_VALUES, type CreditCardCarouselItem, type ExpenseSource, type InvoicePeriod } from '@/components/visaogeral/types';
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';



let hasPlayedOverviewGlowIntro = false;

const CREDIT_OVERVIEW_WINDOW_MONTHS = 24;
const CREDIT_OVERVIEW_BATCH_SIZE = 250;
const CREDIT_OVERVIEW_MAX_ITEMS_PER_CARD = 1000;
const CREDIT_OVERVIEW_MAX_SCANNED_DOCS = 5000;
const DEBUG_DASHBOARD_PERF = false;
const PROFILE_REFRESH_MIN_INTERVAL_MS = 30000;

const debugDashboardPerfLog = (...args: unknown[]) => {
  if (DEBUG_DASHBOARD_PERF) {
    console.log(...args);
  }
};

const isInvoicePeriod = (value: unknown): value is InvoicePeriod => (
  typeof value === 'string' && INVOICE_PERIOD_VALUES.includes(value as InvoicePeriod)
);

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

const toFiniteNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseOptionalDate = (value?: string | null): Date | null => {
  const parsed = parseDate(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const waitForUiTurn = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0);
});

const runAfterInteractionsAsync = () => new Promise<void>((resolve) => {
  InteractionManager.runAfterInteractions(() => resolve());
});

const buildQuickCreditOverview = (creditCards: any[]) => {
  let totalInvoice = 0;
  let totalLimit = 0;
  let totalAvailable = 0;

  const cards = creditCards.map((card: any) => {
    const cardLimit = toFiniteNumber(card.creditData?.creditLimit ?? card.creditLimit);
    const available = toFiniteNumber(card.creditData?.availableCreditLimit ?? card.availableCreditLimit);
    const used = cardLimit > 0 ? Math.max(0, cardLimit - available) : Math.abs(toFiniteNumber(card.balance));
    const current = Math.abs(toFiniteNumber(card.currentBill?.totalAmount ?? card.balance));

    totalInvoice += current;
    totalLimit += cardLimit;
    totalAvailable += available;

    return {
      id: card.id,
      name: card.name || card.connector?.name || 'Cartao',
      past: 0,
      current,
      next: 0,
      limit: cardLimit,
      used,
      dueDate: parseOptionalDate(card.currentBill?.dueDate ?? card.balanceDueDate),
      closingDate: parseOptionalDate(card.currentBill?.closeDate ?? card.balanceCloseDate),
    };
  });

  const totalUsed = totalLimit > 0 ? Math.max(0, totalLimit - totalAvailable) : totalInvoice;
  const usagePercentage = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

  return {
    creditCardData: {
      hasCards: cards.length > 0,
      totalInvoice,
      totalLimit,
      totalUsed,
      usagePercentage,
    },
    invoiceData: {
      pastTotal: 0,
      currentTotal: totalInvoice,
      nextTotal: 0,
      cards,
    },
  };
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
      if (!user?.uid) {
        return;
      }

      const now = Date.now();
      if (now - lastProfileRefreshAtRef.current < PROFILE_REFRESH_MIN_INTERVAL_MS) {
        return;
      }

      lastProfileRefreshAtRef.current = now;
      refreshProfile().catch((error) => {
        console.error('Error refreshing dashboard profile:', error);
      });
    }, [user?.uid])
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

  const [expenseSource, setExpenseSource] = useState<ExpenseSource>('credit');
  const [animateOverviewGlowOnMount] = useState(() => {
    if (hasPlayedOverviewGlowIntro) return false;
    hasPlayedOverviewGlowIntro = true;
    return true;
  });

  const cycleExpenseSource = (direction: number) => {
    const sources: ExpenseSource[] = ['credit', 'checking'];
    const currentIndex = sources.indexOf(expenseSource);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = sources.length - 1;
    if (newIndex >= sources.length) newIndex = 0;
    setExpenseSource(sources[newIndex]);
  };

  // Fetch recurrences for calendar
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = databaseService.onRecurrencesChange(user.uid, (data) => {
      setRecurrences(data);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const lastPaymentAlertScheduleKeyRef = useRef<string | null>(null);
  const paymentAlertScheduleKey = useMemo(() => {
    if (!user?.uid) return '';

    const recurrenceKeys = recurrences
      .map((item: any) => [
        item.id,
        item.name,
        item.dueDate,
        item.frequency,
        item.type,
        item.amount,
        item.cancellationDate,
      ].join('|'))
      .sort();

    const accountKeys = paymentAlertCards
      .map((card: any) => [
        card.id,
        card.name,
        card.balanceDueDate,
        card.currentBill?.dueDate,
        card.currentBill?.totalAmount,
        card.currentBill?.id,
      ].join('|'))
      .sort();

    const subscription = profile?.subscription as any;

    return JSON.stringify({
      userId: user.uid,
      enabled: paymentAlertsEnabled,
      recurrenceKeys,
      accountKeys,
      plan: subscription
        ? [
          subscription.plan,
          subscription.status,
          subscription.expiresAt?.toString?.() ?? subscription.expiresAt ?? '',
        ].join('|')
        : '',
    });
  }, [paymentAlertCards, paymentAlertsEnabled, profile?.subscription, recurrences, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !paymentAlertScheduleKey) return;
    if (lastPaymentAlertScheduleKeyRef.current === paymentAlertScheduleKey) {
      return;
    }
    lastPaymentAlertScheduleKeyRef.current = paymentAlertScheduleKey;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;

      notificationService.reschedulePaymentAlerts({
        userId: user.uid,
        enabled: paymentAlertsEnabled,
        recurrences,
        accounts: paymentAlertCards,
        plan: profile?.subscription || null,
        invoicePreferences: { daysBeforeDue: 3, showAmount: true },
      }).catch((error) => {
        console.error('Error rescheduling payment alerts:', error);
      });
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [paymentAlertScheduleKey, user?.uid, paymentAlertsEnabled, recurrences, paymentAlertCards, profile?.subscription]);

  const hasInitialLoadRef = useRef(false);
  const lastMonthKeyLoadedRef = useRef<string | null>(null);
  const selectedMonthRef = useRef(selectedMonth);
  const selectedBalanceAccountIdsRef = useRef<string[] | null>(selectedBalanceAccountIds);
  const creditOverviewRunIdRef = useRef(0);
  const loadedUserIdRef = useRef<string | null>(null);
  const lastProfileRefreshAtRef = useRef(0);

  useEffect(() => {
    selectedMonthRef.current = selectedMonth;
  }, [selectedMonth]);

  useEffect(() => {
    selectedBalanceAccountIdsRef.current = selectedBalanceAccountIds;
  }, [selectedBalanceAccountIds]);

  useEffect(() => {
    const nextUserId = user?.uid ?? null;
    if (loadedUserIdRef.current === nextUserId) {
      return;
    }

    loadedUserIdRef.current = nextUserId;
    hasInitialLoadRef.current = false;
    lastMonthKeyLoadedRef.current = null;
    creditOverviewRunIdRef.current += 1;
  }, [user?.uid]);

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
    debugDashboardPerfLog('[Perf Dashboard] fetchMonthScopedData duration', Date.now() - t0, 'monthKey', toMonthKey(month));
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
    const bankAccounts = accounts.filter((acc: any) => {
      const isCheckingType = acc.type === 'BANK' || acc.type === 'checking' || acc.subtype === 'CHECKING_ACCOUNT';
      const isCreditType = acc.type === 'credit' || acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD' || acc.subtype === 'CREDIT_CARD';
      const isSavingsType = acc.type === 'SAVINGS' || acc.subtype === 'SAVINGS_ACCOUNT' || acc.subtype === 'SAVINGS';
      const isInvestmentType = acc.type === 'INVESTMENT';

      const nameLower = (acc.name || '').toLowerCase();
      const isSavingsByName = nameLower.includes('poupança') || nameLower.includes('poupanca') || nameLower.includes('savings');
      const isCaixinhaByName = nameLower.includes('caixinha') || nameLower.includes('invest');

      return isCheckingType && !isCreditType && !isSavingsType && !isInvestmentType && !isSavingsByName && !isCaixinhaByName && !hiddenAccountIds.includes(acc.id);
    });
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

    const quickOverview = buildQuickCreditOverview(creditCards);
    setCreditCardData(quickOverview.creditCardData);
    setInvoiceData(quickOverview.invoiceData);

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
        let scannedDocs = 0;

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

          scannedDocs += snapshot.docs.length;

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
              originalTransactionId: data.originalTransactionId || null,
              creditCardMetadata: data.creditCardMetadata ? {
                billId: data.creditCardMetadata.billId ?? null,
                installmentNumber: data.creditCardMetadata.installmentNumber ?? null,
                totalInstallments: data.creditCardMetadata.totalInstallments ?? null,
              } : undefined
            } as Transaction);
          });

          const reachedPerCardLimit = Array.from(txCountByCard.values()).every((count) => count >= CREDIT_OVERVIEW_MAX_ITEMS_PER_CARD);
          const reachedScanLimit = scannedDocs >= CREDIT_OVERVIEW_MAX_SCANNED_DOCS;
          if (reachedPerCardLimit || reachedScanLimit || snapshot.docs.length < CREDIT_OVERVIEW_BATCH_SIZE) {
            if (reachedScanLimit) {
              debugDashboardPerfLog('[Perf Dashboard] credit overview scan limit reached', {
                scannedDocs,
                collected: collectedTransactions.length,
              });
            }
            break;
          }

          cursor = snapshot.docs[snapshot.docs.length - 1];
          await waitForUiTurn();
        }

        return collectedTransactions;
      };

      const allCreditTransactions = ((await queryCache.get(
        `dashboard_credit_transactions_${user.uid}_v2`,
        fetchAllCreditTransactions,
        { ttlMinutes: 10, persist: false }
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

          debugDashboardPerfLog('[Perf Dashboard] fetchCreditOverviewData heavyAggregation duration', Date.now() - t0Credit);
          resolve();
        });
      });
    };

    if (awaitHeavy) {
      await runHeavyAggregation();
    } else {
      void runAfterInteractionsAsync()
        .then(() => {
          if (runId !== creditOverviewRunIdRef.current) {
            return;
          }
          return runHeavyAggregation();
        })
        .catch((error) => {
          console.error('Error loading credit overview data:', error);
        });
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
        debugDashboardPerfLog('[Perf Dashboard] initial load started', { t0Initial });
        const requests: Array<Promise<any>> = [];
        if (plan.fetchMonthScopedData) {
          requests.push(fetchMonthScopedData(initialMonth));
        }
        if (plan.fetchCreditOverviewData) {
          requests.push(fetchCreditOverviewData({ awaitHeavy: false }));
        }
        await Promise.all(requests);
        debugDashboardPerfLog('[Perf Dashboard] initial load completed in', Date.now() - t0Initial, 'ms');

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
        requests.push(fetchCreditOverviewData({ awaitHeavy: false }));
      }
      await Promise.all(requests);
      lastMonthKeyLoadedRef.current = plan.updateLastMonthKey;
    } finally {
      setRefreshing(false);
    }
  }, [fetchCreditOverviewData, fetchMonthScopedData, selectedMonth, selectedMonthKey, user?.uid]);
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
  const carouselData = React.useMemo<CreditCardCarouselItem[]>(() => [
    ...(creditCardData.hasCards && invoiceData.cards.length > 0 ? invoiceData.cards.map(c => ({
      type: 'credit' as const,
      key: c.id,
      ...c
    })) : [])
  ], [creditCardData.hasCards, invoiceData.cards]);

  const handleCreditCardStackPress = useCallback((card: CreditCardCarouselItem) => {
    setSelectedCardForModal(card);
    setInvoiceModalVisible(true);
  }, []);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={{ fontSize: 18, fontFamily: 'AROneSans_400Regular', color: '#FFFFFF' }}>Visão Geral</Text>
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

              <ProfileDropdown
                visible={menuVisible}
                onSettings={() => {
                  setMenuVisible(false);
                  router.push('/settings');
                }}
                onSignOut={async () => {
                  setMenuVisible(false);
                  await signOut();
                }}
              />
            </View>


          </View>
        </View>

        {/* Content Section -- Month navigator moved to header */}
        <View style={styles.content}>
          <SaldoConta
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
            animateValues={lod < 2}
          />

          <MinhasContas
            bankAccountData={bankAccountData}
            isValuesVisible={isValuesVisible}
            onPress={() => setBalanceModalVisible(true)}
          />

          <MeusCartoes
            data={carouselData}
            currentCardIndex={currentCardIndex}
            onSnapToItem={setCurrentCardIndex}
            isValuesVisible={isValuesVisible}
            getCardInvoicePeriod={getCardInvoicePeriod}
            onPressCard={handleCreditCardStackPress}
          />

          <DespesasPorCategoria
            pieData={pieData}
            expenseSource={expenseSource}
            chartAnimationMs={budget.chartAnimationMs}
            onCycleExpenseSource={cycleExpenseSource}
          />

          <CalendarioFinanceiro
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
              style={[
                modalOptionStyles.itemContainer,
                selectedCardModalPeriod === 'past' && modalOptionStyles.itemContainerSelected,
              ]}
              onPress={() => handleInvoicePeriodChange('past')}
            >
              <View style={modalOptionStyles.itemContent}>
                <View style={modalOptionStyles.itemTextBlock}>
                  <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'past' && modalOptionStyles.itemTitleSelected]}>Anterior</Text>
                  <Text style={modalOptionStyles.itemSubtitle}>Visualizar fatura passada</Text>
                </View>
                <Text style={modalOptionStyles.itemValue}>
                  R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(selectedCardForModalData ? selectedCardForModalData.past : invoiceData.pastTotal))}
                </Text>
              </View>
              <View style={modalOptionStyles.itemSeparator} />
            </TouchableOpacity>

            {/* Fatura Atual */}
            <TouchableOpacity
              style={[
                modalOptionStyles.itemContainer,
                selectedCardModalPeriod === 'current' && modalOptionStyles.itemContainerSelected,
              ]}
              onPress={() => handleInvoicePeriodChange('current')}
            >
              <View style={modalOptionStyles.itemContent}>
                <View style={modalOptionStyles.itemTextBlock}>
                  <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'current' && modalOptionStyles.itemTitleSelected]}>Atual</Text>
                  <Text style={modalOptionStyles.itemSubtitle}>Visualizar mês vigente</Text>
                </View>
                <Text style={modalOptionStyles.itemValue}>
                  R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(selectedCardForModalData ? selectedCardForModalData.current : invoiceData.currentTotal))}
                </Text>
              </View>
              <View style={modalOptionStyles.itemSeparator} />
            </TouchableOpacity>

            {/* Limite Utilizado */}
            <TouchableOpacity
              style={[
                modalOptionStyles.itemContainer,
                selectedCardModalPeriod === 'total_used' && modalOptionStyles.itemContainerSelected,
              ]}
              onPress={() => handleInvoicePeriodChange('total_used')}
            >
              <View style={modalOptionStyles.itemContent}>
                <View style={modalOptionStyles.itemTextBlock}>
                  <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'total_used' && modalOptionStyles.itemTitleSelected]}>Total Usado</Text>
                  <Text style={modalOptionStyles.itemSubtitle}>Soma de todas as faturas abertas</Text>
                </View>
                <Text style={modalOptionStyles.itemValue}>
                  R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(selectedCardForModalData ? selectedCardForModalData.used : creditCardData.totalUsed))}
                </Text>
              </View>
              <View style={modalOptionStyles.itemSeparator} />
            </TouchableOpacity>

            {/* Nenhuma Fatura */}
            <TouchableOpacity
              style={[
                modalOptionStyles.itemContainer,
                selectedCardModalPeriod === 'none' && modalOptionStyles.itemContainerSelectedDanger,
              ]}
              onPress={() => handleInvoicePeriodChange('none')}
            >
              <View style={modalOptionStyles.itemContent}>
                <View style={modalOptionStyles.itemTextBlock}>
                  <Text style={[modalOptionStyles.itemTitle, selectedCardModalPeriod === 'none' && modalOptionStyles.itemTitleDanger]}>Não considerar</Text>
                  <Text style={modalOptionStyles.itemSubtitle}>Ocultar faturas do resumo</Text>
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
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#161616',
    overflow: 'hidden',
  },
  itemContainer: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  itemContainerSelected: {
    backgroundColor: 'transparent',
  },
  itemContainerSelectedDanger: {
    backgroundColor: 'transparent',
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  itemTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'AROneSans_400Regular',
  },
  itemTitleSelected: {
    color: '#D97757',
  },
  itemTitleDanger: {
    color: '#FF6B6B',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#606060',
    marginTop: 1,
  },
  itemValue: {
    color: '#AAAAAA',
    fontSize: 14,
    fontFamily: 'AROneSans_400Regular',
    textAlign: 'right',
    minWidth: 104,
  },
  itemSeparator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#161616',
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
    width: 40,
    height: 40,
    borderRadius: 10,
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  todayButton: {
    fontSize: 12,
    color: '#D97757',
    marginTop: 4,
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  todayButtonCompact: {
    fontSize: 10,
    color: '#D97757',
    marginTop: 2,
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
    color: '#FFFFFF',
    marginRight: 4,
  },
  amountText: {
    fontSize: 40,
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
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
    fontFamily: 'AROneSans_400Regular',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'AROneSans_400Regular',
    letterSpacing: -0.5,
  },
});
