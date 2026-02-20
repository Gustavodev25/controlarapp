import {
  buildInvoices,
  CreditCardAccount,
  Transaction,
} from '../services/invoiceBuilder';

describe('invoiceBuilder performance parity', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-17T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('keeps totals and installment placement stable after internal optimizations', () => {
    const card: CreditCardAccount = {
      id: 'card-1',
      type: 'credit',
      closingDateSettings: {
        lastClosingDate: '2026-01-10',
        currentClosingDate: '2026-02-10',
        lastDueDate: '2026-02-20',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    };

    const transactions: Transaction[] = [
      {
        id: 'install-1',
        description: 'Notebook 1/3',
        amount: 100,
        date: '2026-01-20',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        installmentNumber: 1,
        totalInstallments: 3,
      },
      {
        id: 'install-2',
        description: 'Notebook 2/3',
        amount: 100,
        date: '2026-02-20',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        installmentNumber: 2,
        totalInstallments: 3,
      },
      {
        id: 'install-2-dup',
        description: 'Notebook 2/3',
        amount: 100,
        date: '2026-02-20',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        installmentNumber: 2,
        totalInstallments: 3,
      },
      {
        id: 'market-current',
        description: 'Mercado',
        amount: 100,
        date: '2026-01-25',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
      },
      {
        id: 'streaming-future',
        description: 'Streaming',
        amount: 80,
        date: '2026-02-12',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
      },
      {
        id: 'refund-current',
        description: 'Estorno',
        amount: 20,
        date: '2026-01-26',
        type: 'income',
        category: 'Refund',
        cardId: 'card-1',
        accountId: 'card-1',
      },
    ];

    const result = buildInvoices(card, transactions, 'card-1');
    const allInvoices = [result.closedInvoice, result.currentInvoice, ...result.futureInvoices];
    const allItems = allInvoices.flatMap((invoice) => invoice.items);
    const ids = allItems.map((item) => item.id);
    const countById = (id: string) => ids.filter((value) => value === id).length;

    expect(countById('install-1')).toBe(1);
    expect(countById('install-2')).toBe(1);
    expect(countById('install-2-dup')).toBe(0);
    expect(countById('proj_install-1_3')).toBe(1);

    const projectedThirdItem = allItems.find((item) => item.id === 'proj_install-1_3');
    expect(projectedThirdItem?.isProjected).toBe(true);

    const sumOfInvoiceTotals = allInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
    expect(sumOfInvoiceTotals).toBe(460);
  });
});
