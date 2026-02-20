import { buildInvoices, CreditCardAccount, Transaction } from '../services/invoiceBuilder';

describe('invoiceBuilder santander regression', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-18T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('keeps current Santander invoice total and count for the provided statement sample', () => {
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

    const tx = (
      id: string,
      date: string,
      amount: number,
      description: string,
      key: 'FEV' | 'MAR',
      installmentNumber?: number,
      totalInstallments?: number,
    ): Transaction => ({
      id,
      date,
      amount,
      description,
      type: 'expense',
      cardId: 'card-1',
      accountId: 'card-1',
      invoiceMonthKey: key === 'FEV' ? '2026-02' : '2026-03',
      installmentNumber,
      totalInstallments,
    });

    const transactions: Transaction[] = [
      tx('1', '2026-02-15', 19.9, 'AMAZONPRIMEBR', 'FEV'),
      tx('2', '2026-02-13', 60, 'FACEBK *3VQ7ZEVJP2', 'FEV'),
      tx('3', '2026-02-13', 35.9, 'ASA*CONTROLAR MAIS LTD', 'FEV'),
      tx('4', '2026-02-11', 16.45, 'SCP MAIS- FEV/26', 'FEV'),
      tx('5', '2026-02-11', 100, 'FACEBK *ZGDVUFRJP2', 'FEV'),
      tx('6', '2026-02-11', 39.9, 'APPLECOMBILL', 'FEV'),
      tx('7', '2026-02-05', 46, 'SMILES CLUBE SMILES', 'FEV'),
      tx('8', '2026-02-04', 100, 'FACEBK *RG6W7FRJP2', 'FEV'),
      tx('9', '2026-02-03', 17.01, 'UBER * PENDING', 'FEV'),
      tx('10', '2026-02-03', 19.24, 'UBER * PENDING', 'FEV'),
      tx('11', '2026-02-03', 50, 'SEM PARAR', 'FEV'),
      tx('12', '2026-02-02', 80, 'PETLOVE SAUD*PETL', 'FEV'),
      tx('13', '2026-01-31', 100, 'FACEBK *MDGMZDHJP2', 'MAR'),
      tx('14', '2026-01-31', 10, 'AMAZON AD FREE FOR PRIMEV', 'MAR'),
      tx('15', '2026-01-30', 50, 'SEM PARAR', 'MAR'),
      tx('16', '2026-01-30', 39.9, 'PETLOVE SAUD*PETL', 'MAR'),
      tx('17', '2026-01-30', 14.9, 'APPLE.COM/BILL', 'MAR'),
      tx('18', '2026-01-29', 2866.34, 'UNITED AUTO NAGOYA RUDG', 'MAR', 1, 10),
      tx('19', '2026-01-28', 100, 'SEM PARAR', 'FEV'),
      tx('20', '2026-01-28', 10.9, 'MERCADINHO TRES DE MAI', 'FEV'),
      tx('21', '2026-01-28', 100, 'FACEBK *FA4HKDVJP2', 'FEV'),
      tx('22', '2026-01-28', 9.99, 'APPLE.COM/BILL', 'FEV'),
      tx('23', '2026-01-28', 100.7, 'CHARLOT', 'FEV'),
      tx('24', '2026-01-27', 97.22, 'OUTBACK SAO BERNARDO', 'FEV'),
      tx('25', '2026-01-27', 12.9, 'IFD*BR', 'FEV'),
      tx('26', '2026-01-27', 7.11, 'UBER * PENDING', 'FEV'),
      tx('27', '2026-01-27', 31.5, 'CAFETERIA DA VEIA', 'FEV'),
      tx('28', '2026-01-27', 52.9, 'MP*WORKANA', 'FEV'),
      tx('29', '2026-01-27', 28.34, 'UBER * PENDING', 'FEV'),
      tx('30', '2026-01-27', 6.17, 'UBER * PENDING', 'FEV'),
      tx('31', '2026-01-27', 4.2, 'MERCADINHO TRES DE MAI', 'FEV'),
      tx('32', '2026-01-27', 6.35, 'TOP SP TARFA TRANSPORT', 'FEV'),
      tx('33', '2025-12-28', 43.75, 'ANUIDADE DIFERENCIADA', 'FEV', 3, 12),
    ];

    const result = buildInvoices(card, transactions, 'card-1');
    expect(result.currentInvoice.total).toBeCloseTo(4277.57, 2);
    expect(result.currentInvoice.items.length).toBe(33);
  });
});
