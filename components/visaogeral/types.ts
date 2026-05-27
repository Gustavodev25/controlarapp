export type InvoicePeriod = 'past' | 'current' | 'next' | 'total_used' | 'none';

export const INVOICE_PERIOD_VALUES: InvoicePeriod[] = ['past', 'current', 'next', 'total_used', 'none'];

export interface CreditCardCarouselItem {
  type: 'credit';
  key: string;
  id: string;
  name: string;
  past: number;
  current: number;
  next: number;
  limit: number;
  used: number;
  dueDate: Date | null;
  closingDate: Date | null;
}

export interface BankAccountOverviewData {
  hasAccounts?: boolean;
  totalBalance: number;
  count: number;
}

export type ExpenseSource = 'credit' | 'checking';

export interface CategoryExpenseDatum {
  x: string;
  y: number;
  color: string;
  percent: number;
}

export const formatCurrencyAmount = (value: number) => Math.abs(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
