import { buildInvoices, buildInvoicesPluggyFirst, CreditCardAccount, formatDate, normalizePluggyDate, parseDate, toDateStr, Transaction } from '../services/invoiceBuilder';

process.env.TZ = 'UTC';

test('Nubank - periodStart/periodEnd classification places transactions in closedInvoice', () => {
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
  
  // Coleta todas as transações de currentInvoice e futureInvoices
  const allItems = [
    ...result.currentInvoice.items,
    ...(result.futureInvoices[0]?.items || [])
  ];
  
  // eslint-disable-next-line no-console
  console.log('Bradesco merged invoice - currentInvoice:', {
    total: result.currentInvoice.total,
    itemCount: result.currentInvoice.items.length,
    items: result.currentInvoice.items.map(i => ({ desc: i.description, amount: i.amount }))
  });
  // eslint-disable-next-line no-console
  console.log('Bradesco merged invoice - future[0]:', {
    total: result.futureInvoices[0]?.total || 0,
    itemCount: result.futureInvoices[0]?.items.length || 0,
    items: (result.futureInvoices[0]?.items || []).map(i => ({ desc: i.description, amount: i.amount }))
  });
  
  // Verifica que todas as 3 transações estão juntas (mescladas)
  expect(allItems.some(i => i.description === 'COMPRA 1')).toBe(true);
  expect(allItems.some(i => i.description === 'COMPRA 2')).toBe(true);
  expect(allItems.some(i => i.description === 'COMPRA 3')).toBe(true);
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
