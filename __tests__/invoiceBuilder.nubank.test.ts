import { buildInvoices, buildInvoicesPluggyFirst, calculateInvoicePeriodDates, CreditCardAccount, formatDate, normalizePluggyDate, parseDate, toDateStr, Transaction } from '../services/invoiceBuilder';

process.env.TZ = 'UTC';

afterEach(() => {
  jest.useRealTimers();
});

test('rotates current bill automatically when due date is today', () => {
  const card: CreditCardAccount = {
    id: 'rotating-card',
    type: 'credit',
    currentBill: {
      id: 'bill_2026-04',
      periodStart: '2026-03-21',
      periodEnd: '2026-04-20',
      dueDate: '2026-05-01',
      totalAmount: 150
    }
  } as any;

  const periods = calculateInvoicePeriodDates(card, new Date(2026, 4, 1, 9, 0, 0));

  expect(toDateStr(periods.lastClosingDate)).toBe('2026-04-20');
  expect(toDateStr(periods.currentClosingDate)).toBe('2026-05-20');
  expect(toDateStr(periods.currentDueDate)).toBe('2026-06-01');
});

test('keeps May as current when old closed bill still has future due date', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 4, 1, 9, 0, 0));

  const card: CreditCardAccount = {
    id: 'gold-card',
    type: 'credit',
    currentBill: {
      id: 'bill_2026-04',
      periodStart: '2026-03-29',
      periodEnd: '2026-04-28',
      dueDate: '2026-05-10',
      totalAmount: 706.33
    }
  } as any;

  const transactions: Transaction[] = [
    {
      id: 'may_tx',
      description: 'Ec *Pichauinforma 7/10',
      amount: 396.43,
      date: '2026-05-01',
      type: 'expense',
      cardId: 'gold-card',
      creditCardMetadata: { billId: 'bill_2026-04' }
    }
  ];

  const result = buildInvoicesPluggyFirst(card, transactions, 'gold-card');

  expect(result.currentInvoice.referenceMonth).toBe('2026-05');
  expect(toDateStr(result.periods.currentClosingDate)).toBe('2026-05-28');
  expect(toDateStr(result.periods.currentDueDate)).toBe('2026-06-10');
  expect(result.currentInvoice.items.some((item) => item.id === 'may_tx')).toBe(true);
});

test('Nubank - periodStart/periodEnd classification places transactions in closedInvoice', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 1, 15, 9, 0, 0));

  const card: CreditCardAccount = {
    id: 'nubank',
    type: 'credit',
    currentBill: {
      id: 'bill_2026-03',
      periodStart: '2026-02-02',
      periodEnd: '2026-03-01',
      dueDate: '2026-03-08',
      totalAmount: 150
    },
    bills: [
      {
        id: 'bill_2026-02',
        periodStart: '2026-01-02',
        periodEnd: '2026-02-01',
        dueDate: '2026-02-08',
        totalAmount: 200
      }
    ]
  } as any;

  const transactions: Transaction[] = [
    // This transaction is inside the period 2026-02-02..2026-03-01 -> should appear in currentInvoice
    { id: 't_current_1', description: 'Compra corrente', amount: 100, date: '2026-02-05', type: 'expense', cardId: 'nubank' },
    // This transaction is inside the previous period 2026-01-02..2026-02-01 -> should appear in closedInvoice
    { id: 't_closed_1', description: 'Compra passada', amount: 50, date: '2026-01-20', type: 'expense', cardId: 'nubank' }
  ];

  const result = buildInvoices(card, transactions, 'nubank');
  // Output to help debugging when running the test locally
  // eslint-disable-next-line no-console
  console.log('closedInvoice:', result.closedInvoice);
  // Assert that the closed invoice contains at least the past transaction
  expect(result.closedInvoice.items.some(i => i.description === 'Compra passada')).toBe(true);
});

test('Bradesco - merges multiple bills in same month into single invoice', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 0, 31, 9, 0, 0));

  // Simula problema do Bradesco que divide uma fatura em múltiplos bills (29 jan até 01 fev)
  const card: CreditCardAccount = {
    id: 'bradesco-gol',
    type: 'credit',
    currentBill: {
      id: 'part2',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-01',
      dueDate: '2026-02-10',
      totalAmount: 0
    },
    bills: [
      {
        id: 'part1',
        periodStart: '2026-01-29',
        periodEnd: '2026-02-01',
        dueDate: '2026-02-10',
        totalAmount: 0
      }
    ]
  } as any;

  const transactions: Transaction[] = [
    // Transação do primeiro bill (parte 1)
    { 
      id: 't1', 
      description: 'COMPRA 1', 
      amount: 100, 
      date: '2026-01-30', 
      type: 'expense', 
      cardId: 'bradesco-gol',
      creditCardMetadata: { billId: 'part1' }
    },
    // Transação do segundo bill (parte 2)
    { 
      id: 't2', 
      description: 'COMPRA 2', 
      amount: 200, 
      date: '2026-02-01', 
      type: 'expense', 
      cardId: 'bradesco-gol',
      creditCardMetadata: { billId: 'part2' }
    },
    // Transação sem billId que deveria entrar na mesma fatura
    { 
      id: 't3', 
      description: 'COMPRA 3', 
      amount: 150, 
      date: '2026-01-31', 
      type: 'expense', 
      cardId: 'bradesco-gol'
    }
  ];

  const result = buildInvoicesPluggyFirst(card, transactions, 'bradesco-gol');
  
  const invoiceBuckets = [
    result.beforeLastInvoice,
    result.closedInvoice,
    result.currentInvoice,
    ...result.futureInvoices
  ];
  const mergedInvoice = invoiceBuckets.find((invoice) => {
    const descriptions = new Set(invoice.items.map((item) => item.description));
    return descriptions.has('COMPRA 1') && descriptions.has('COMPRA 2') && descriptions.has('COMPRA 3');
  });
  
  // Verifica que todas as 3 transações estão juntas (mescladas)
  expect(mergedInvoice).toBeTruthy();
});

test('normalizePluggyDate normaliza ISO com timezone e data simples', () => {
  expect(normalizePluggyDate('2026-03-01T00:00:00.000Z')).toBe('2026-03-01');
  expect(normalizePluggyDate('2026-03-01')).toBe('2026-03-01');
});

test('normalizePluggyDate retorna null para datas inválidas', () => {
  expect(normalizePluggyDate('')).toBeNull();
  expect(normalizePluggyDate('invalid-date')).toBeNull();
});

test('parseDate preserva o dia normalizado', () => {
  const parsed = parseDate('2026-03-01T10:30:00.000Z');
  expect(toDateStr(parsed)).toBe('2026-03-01');
});

test('formatDate renderiza DD/MM/YYYY a partir de ISO', () => {
  expect(formatDate('2026-03-01T00:00:00.000Z')).toBe('01/03/2026');
});
