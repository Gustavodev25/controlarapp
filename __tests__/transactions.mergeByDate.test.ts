import {
  compareTransactionsByDateDesc,
  dedupeTransactionsBySourceId,
  mergeSortedTransactions,
} from '../utils/transactionsMerge';

type Tx = {
  id: string;
  date: string;
  source: 'checking' | 'credit';
};

describe('transactions merge by date', () => {
  it('merges two already-sorted lists in descending date order', () => {
    const checking: Tx[] = [
      { id: 'a', date: '2026-02-12', source: 'checking' },
      { id: 'b', date: '2026-02-10', source: 'checking' },
    ];
    const credit: Tx[] = [
      { id: 'c', date: '2026-02-11', source: 'credit' },
      { id: 'd', date: '2026-02-09', source: 'credit' },
    ];

    const merged = mergeSortedTransactions(checking, credit);
    const keys = merged.map((tx) => `${tx.source}-${tx.id}`);

    expect(keys).toEqual([
      'checking-a',
      'credit-c',
      'checking-b',
      'credit-d',
    ]);
    expect([...merged].sort(compareTransactionsByDateDesc)).toEqual(merged);
  });

  it('dedupes by source:id and keeps first occurrence across pages', () => {
    const page1: Tx[] = [
      { id: '1', date: '2026-02-14', source: 'checking' },
      { id: '2', date: '2026-02-13', source: 'credit' },
    ];
    const page2: Tx[] = [
      { id: '1', date: '2026-02-01', source: 'checking' }, // duplicate older
      { id: '3', date: '2026-02-12', source: 'credit' },
    ];

    const mergedPages = mergeSortedTransactions(page1, page2);
    const deduped = dedupeTransactionsBySourceId(mergedPages);

    expect(deduped.map((tx) => `${tx.source}-${tx.id}`)).toEqual([
      'checking-1',
      'credit-2',
      'credit-3',
    ]);
    expect(deduped[0].date).toBe('2026-02-14');
  });
});
