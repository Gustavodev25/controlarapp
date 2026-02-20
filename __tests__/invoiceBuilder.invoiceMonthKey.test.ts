import {
  buildInvoices,
  CreditCardAccount,
  Transaction,
} from '../services/invoiceBuilder';

describe('invoiceBuilder invoiceMonthKey compatibility', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-18T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const card: CreditCardAccount = {
    id: 'card-1',
    type: 'credit',
    closingDateSettings: {
      lastClosingDate: '2026-01-26',
      currentClosingDate: '2026-02-26',
      lastDueDate: '2026-02-03',
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  };

  it('ignores legacy auto invoiceMonthKey and keeps current-cycle charges in current invoice', () => {
    const transactions: Transaction[] = [
      {
        id: 'last-cycle',
        description: 'Compra antiga',
        amount: 300,
        date: '2026-01-20',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        invoiceMonthKey: '2026-01',
      },
      {
        id: 'current-cycle-jan',
        description: 'Compra fim de janeiro',
        amount: 1000,
        date: '2026-01-30',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        invoiceMonthKey: '2026-01',
      },
      {
        id: 'current-cycle-feb',
        description: 'Compra fevereiro',
        amount: 510.32,
        date: '2026-02-10',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        invoiceMonthKey: '2026-02',
      },
    ];

    const result = buildInvoices(card, transactions, 'card-1');

    expect(result.closedInvoice.total).toBeCloseTo(300, 2);
    expect(result.currentInvoice.total).toBeCloseTo(1510.32, 2);
    expect(result.currentInvoice.items.some((item) => item.id === 'current-cycle-feb')).toBe(true);
  });

  it('keeps honoring manual invoiceMonthKey override when month differs from purchase month', () => {
    const transactions: Transaction[] = [
      {
        id: 'manual-move',
        description: 'Compra movida manualmente',
        amount: 200,
        date: '2026-01-30',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        invoiceMonthKey: '2026-02',
        invoiceMonthKeyManual: true,
      },
    ];

    const result = buildInvoices(card, transactions, 'card-1');

    expect(result.closedInvoice.total).toBeCloseTo(200, 2);
    expect(result.currentInvoice.total).toBeCloseTo(0, 2);
    expect(result.closedInvoice.items.some((item) => item.id === 'manual-move')).toBe(true);
  });

  it('keeps transactions in current cycle when provider key uses closing month', () => {
    const transactions: Transaction[] = [
      {
        id: 'jan-27-closing-month-key',
        description: 'Compra com chave do fechamento',
        amount: 510.32,
        date: '2026-01-27',
        type: 'expense',
        cardId: 'card-1',
        accountId: 'card-1',
        // Cycle 27/jan -> 26/fev, but provider labels by closing month (fev).
        invoiceMonthKey: '2026-02',
      },
    ];

    const result = buildInvoices(card, transactions, 'card-1');

    expect(result.currentInvoice.total).toBeCloseTo(510.32, 2);
    expect(result.currentInvoice.items.some((item) => item.id === 'jan-27-closing-month-key')).toBe(true);
  });
});
