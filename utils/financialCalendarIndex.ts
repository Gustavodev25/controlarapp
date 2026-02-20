export interface CalendarIndexTransaction {
  date: string;
}

export interface CalendarIndexRecurrence {
  dueDate: string;
}

export interface EventsForDate<
  TTransaction extends CalendarIndexTransaction,
  TRecurrence extends CalendarIndexRecurrence
> {
  checking: TTransaction[];
  cards: TTransaction[];
  recs: TRecurrence[];
  totalCount: number;
}

export const buildEventsByDateIndex = <
  TTransaction extends CalendarIndexTransaction,
  TRecurrence extends CalendarIndexRecurrence
>(
  checkingTransactions: TTransaction[],
  creditCardTransactions: TTransaction[],
  recurrences: TRecurrence[]
) => {
  const map = new Map<string, EventsForDate<TTransaction, TRecurrence>>();
  const ensureEntry = (dateKey: string) => {
    const existing = map.get(dateKey);
    if (existing) return existing;
    const created: EventsForDate<TTransaction, TRecurrence> = {
      checking: [],
      cards: [],
      recs: [],
      totalCount: 0,
    };
    map.set(dateKey, created);
    return created;
  };

  checkingTransactions.forEach((tx) => {
    if (!tx.date) return;
    const entry = ensureEntry(tx.date.slice(0, 10));
    entry.checking.push(tx);
    entry.totalCount += 1;
  });

  creditCardTransactions.forEach((tx) => {
    if (!tx.date) return;
    const entry = ensureEntry(tx.date.slice(0, 10));
    entry.cards.push(tx);
    entry.totalCount += 1;
  });

  recurrences.forEach((rec) => {
    if (!rec.dueDate) return;
    const entry = ensureEntry(rec.dueDate.slice(0, 10));
    entry.recs.push(rec);
    entry.totalCount += 1;
  });

  return map;
};
