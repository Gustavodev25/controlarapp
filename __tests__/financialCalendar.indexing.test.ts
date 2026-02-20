import {
  buildEventsByDateIndex,
  CalendarIndexRecurrence,
  CalendarIndexTransaction,
} from '../utils/financialCalendarIndex';

type Tx = CalendarIndexTransaction & {
  id: string;
  type: 'income' | 'expense';
};

type Rec = CalendarIndexRecurrence & {
  id: string;
};

const legacyGetEventsForDate = (
  dateKey: string,
  checkingTransactions: Tx[],
  creditCardTransactions: Tx[],
  recurrences: Rec[]
) => {
  const checking = checkingTransactions.filter((t) => t.date && t.date.startsWith(dateKey));
  const cards = creditCardTransactions.filter((t) => t.date && t.date.startsWith(dateKey));
  const recs = recurrences.filter((r) => r.dueDate && r.dueDate.startsWith(dateKey));

  return { checking, cards, recs };
};

describe('financial calendar indexing', () => {
  it('matches legacy per-date filtering results', () => {
    const checkingTransactions: Tx[] = [
      { id: 'c1', date: '2026-02-10', type: 'income' },
      { id: 'c2', date: '2026-02-10T13:40:00.000Z', type: 'expense' },
      { id: 'c3', date: '2026-02-11', type: 'expense' },
    ];
    const creditCardTransactions: Tx[] = [
      { id: 'k1', date: '2026-02-10', type: 'expense' },
      { id: 'k2', date: '2026-02-12', type: 'expense' },
    ];
    const recurrences: Rec[] = [
      { id: 'r1', dueDate: '2026-02-10' },
      { id: 'r2', dueDate: '2026-02-12' },
    ];

    const index = buildEventsByDateIndex(
      checkingTransactions,
      creditCardTransactions,
      recurrences
    );

    const targetDates = ['2026-02-10', '2026-02-11', '2026-02-12', '2026-02-20'];

    targetDates.forEach((dateKey) => {
      const legacy = legacyGetEventsForDate(
        dateKey,
        checkingTransactions,
        creditCardTransactions,
        recurrences
      );
      const indexed = index.get(dateKey) || {
        checking: [],
        cards: [],
        recs: [],
      };

      expect(indexed.checking.map((item) => item.id)).toEqual(
        legacy.checking.map((item) => item.id)
      );
      expect(indexed.cards.map((item) => item.id)).toEqual(
        legacy.cards.map((item) => item.id)
      );
      expect(indexed.recs.map((item) => item.id)).toEqual(
        legacy.recs.map((item) => item.id)
      );
    });
  });
});
