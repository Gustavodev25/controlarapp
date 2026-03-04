import { buildInvoicesPluggyFirst, CreditCardAccount, Transaction } from './services/invoiceBuilder';

const mockedCard: CreditCardAccount = {
    id: 'test_card',
    type: 'CREDIT',
    closingDateSettings: {
        closingDay: 25,
        applyToAll: true,
        monthOverrides: {
            '2026-03': { closingDay: 20, exactDate: '2026-03-20' }, // Hoje é 4 de março de 2026
        }
    },
    bills: [] // Nenhum bill do banco
};

const txs: Transaction[] = [
    {
        id: 'tx1',
        description: 'Mercado',
        amount: -50,
        date: '2026-03-23', // Pelo novo fechamento (20), isso deve ir pra Próxima fatura (Abril). Se fosse 25, seria Atual.
        type: 'expense'
    },
    {
        id: 'tx2',
        description: 'Padaria',
        amount: -20,
        date: '2026-03-10', // Antes do fechamento (tanto 20 quanto 25). Fatura atual (Março).
        type: 'expense'
    }
];

const res = buildInvoicesPluggyFirst(mockedCard, txs, 'test_card');
console.log('--- OUTPUT ---');
console.log('Meses requeridos e dias fechamento:');
console.log('Before Last:', res.periods.beforeLastMonthKey, res.periods.beforeLastClosingDate);
console.log('Last:', res.periods.lastMonthKey, res.periods.lastClosingDate);
console.log('Current:', res.periods.currentMonthKey, res.periods.currentClosingDate, 'Start:', res.periods.currentInvoiceStart);
console.log('Next:', res.periods.nextMonthKey, res.periods.nextClosingDate);

console.log('\nFaturas Sintéticas geradas:');
console.log('Last (Fechada):', res.closedInvoice.items.length, 'itens');
res.closedInvoice.items.forEach(i => console.log('  ', i.date, i.description));

console.log('Current (Atual):', res.currentInvoice.items.length, 'itens');
res.currentInvoice.items.forEach(i => console.log('  ', i.date, i.description));

if (res.futureInvoices.length > 0) {
    console.log('Next (Próxima):', res.futureInvoices[0].items.length, 'itens');
    res.futureInvoices[0].items.forEach(i => console.log('  ', i.date, i.description));
}
