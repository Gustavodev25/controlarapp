export interface MergeableTransaction {
  id: string;
  date: string;
  source: 'checking' | 'credit';
}

export const compareTransactionsByDateDesc = <T extends MergeableTransaction>(a: T, b: T) => {
  if (a.date === b.date) {
    if (a.source === b.source) {
      return a.id.localeCompare(b.id);
    }
    return a.source === 'credit' ? -1 : 1;
  }
  return a.date > b.date ? -1 : 1;
};

export const mergeSortedTransactions = <T extends MergeableTransaction>(left: T[], right: T[]): T[] => {
  const merged: T[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (compareTransactionsByDateDesc(left[i], right[j]) <= 0) {
      merged.push(left[i]);
      i += 1;
    } else {
      merged.push(right[j]);
      j += 1;
    }
  }

  while (i < left.length) {
    merged.push(left[i]);
    i += 1;
  }

  while (j < right.length) {
    merged.push(right[j]);
    j += 1;
  }

  return merged;
};

export const dedupeTransactionsBySourceId = <T extends MergeableTransaction>(list: T[]): T[] => {
  const seen = new Set<string>();
  const deduped: T[] = [];

  list.forEach((item) => {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(item);
  });

  return deduped;
};
