import {
  clampMonth,
  extractMonthKey,
  getFirestoreMonthRange,
  getRecentMonthWindow,
  isSameMonth,
  toMonthKey,
} from '../utils/monthWindow';

describe('dashboard month window utils', () => {
  it('returns current month and previous 2 months for a 3-month window', () => {
    const referenceDate = new Date(2026, 1, 11); // 2026-02-11
    const { minMonth, maxMonth } = getRecentMonthWindow(referenceDate, 3);

    expect(toMonthKey(maxMonth)).toBe('2026-02');
    expect(toMonthKey(minMonth)).toBe('2025-12');
  });

  it('clamps month outside the allowed range', () => {
    const minMonth = new Date(2025, 11, 1); // 2025-12
    const maxMonth = new Date(2026, 1, 1); // 2026-02

    const belowRange = new Date(2025, 10, 15); // 2025-11
    const aboveRange = new Date(2026, 2, 3); // 2026-03
    const inRange = new Date(2026, 0, 20); // 2026-01

    expect(isSameMonth(clampMonth(belowRange, minMonth, maxMonth), minMonth)).toBe(true);
    expect(isSameMonth(clampMonth(aboveRange, minMonth, maxMonth), maxMonth)).toBe(true);
    expect(toMonthKey(clampMonth(inRange, minMonth, maxMonth))).toBe('2026-01');
  });

  it('builds firestore month range using month start and next month start', () => {
    const range = getFirestoreMonthRange(new Date(2026, 1, 19)); // 2026-02-19

    expect(range.startDate).toBe('2026-02-01');
    expect(range.nextMonthStart).toBe('2026-03-01');
  });

  it('extracts month key from date and timestamp formats', () => {
    expect(extractMonthKey('2026-02-11')).toBe('2026-02');
    expect(extractMonthKey('2026-02-11T10:23:45.000Z')).toBe('2026-02');
    expect(extractMonthKey('invalid-date')).toBe('');
  });
});
