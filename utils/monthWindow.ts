export interface MonthWindow {
  minMonth: Date;
  maxMonth: Date;
}

export interface FirestoreMonthRange {
  startDate: string;
  nextMonthStart: string;
}

export const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date: Date, amount: number): Date => {
  const normalized = startOfMonth(date);
  return new Date(normalized.getFullYear(), normalized.getMonth() + amount, 1);
};

export const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const extractMonthKey = (dateValue: string): string => {
  const match = /^(\d{4})-(\d{2})/.exec((dateValue || '').trim());
  return match ? `${match[1]}-${match[2]}` : '';
};

export const compareMonths = (a: Date, b: Date): number => {
  const aValue = a.getFullYear() * 12 + a.getMonth();
  const bValue = b.getFullYear() * 12 + b.getMonth();
  return aValue - bValue;
};

export const isSameMonth = (a: Date, b: Date): boolean =>
  compareMonths(a, b) === 0;

export const getRecentMonthWindow = (
  referenceDate: Date = new Date(),
  monthsCount: number = 3
): MonthWindow => {
  const normalizedCount = Number.isFinite(monthsCount) && monthsCount > 0 ? Math.floor(monthsCount) : 1;
  const maxMonth = startOfMonth(referenceDate);
  const minMonth = addMonths(maxMonth, -(normalizedCount - 1));
  return { minMonth, maxMonth };
};

export const clampMonth = (date: Date, minMonth: Date, maxMonth: Date): Date => {
  const normalized = startOfMonth(date);
  const normalizedMin = startOfMonth(minMonth);
  const normalizedMax = startOfMonth(maxMonth);

  if (compareMonths(normalized, normalizedMin) < 0) {
    return normalizedMin;
  }
  if (compareMonths(normalized, normalizedMax) > 0) {
    return normalizedMax;
  }
  return normalized;
};

export const getFirestoreMonthRange = (month: Date): FirestoreMonthRange => {
  const monthStart = startOfMonth(month);
  const nextMonth = addMonths(monthStart, 1);
  return {
    startDate: formatDateLocal(monthStart),
    nextMonthStart: formatDateLocal(nextMonth),
  };
};
