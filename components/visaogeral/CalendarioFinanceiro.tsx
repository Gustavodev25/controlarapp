import { FinancialCalendar } from '@/components/FinancialCalendar';
import type { Transaction } from '@/services/invoiceBuilder';
import React from 'react';

interface CalendarioFinanceiroProps {
  checkingTransactions: Transaction[];
  creditCardTransactions: Transaction[];
  recurrences: any[];
  selectedMonth: Date;
  minMonth: Date;
  maxMonth: Date;
  onMonthChange: (date: Date) => void;
}

const CalendarioFinanceiro = React.memo((props: CalendarioFinanceiroProps) => (
  <FinancialCalendar {...props} />
));

CalendarioFinanceiro.displayName = 'CalendarioFinanceiro';

export default CalendarioFinanceiro;
