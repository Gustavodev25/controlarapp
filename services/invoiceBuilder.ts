import { isNonInstallmentMerchant } from './installmentRules';

/**
 * Invoice Builder - Sistema de construção de faturas de cartão de crédito
 * Mobile version - Baseado no invoiceBuilder.ts do web
 */

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: 'income' | 'expense';
    category?: string;
    cardId?: string;
    accountId?: string;
    installmentNumber?: number;
    totalInstallments?: number;
    invoiceMonthKey?: string;
    invoiceMonthKeyManual?: boolean;
    isProjected?: boolean;
    isPayment?: boolean;
    isRefund?: boolean;
    originalTransactionId?: string;
}

export interface CreditCardAccount {
    id: string;
    name?: string;
    type: 'credit' | 'CREDIT' | 'CREDIT_CARD' | 'BANK';
    subtype?: string;
    creditLimit?: number;
    availableCreditLimit?: number;
    balance?: number;
    connector?: {
        id: string;
        name: string;
        imageUrl?: string;
        primaryColor?: string;
    };
    // Datas do Pluggy creditData (Open Finance)
    balanceCloseDate?: string; // Data de fechamento da fatura atual (YYYY-MM-DD)
    balanceDueDate?: string;   // Data de vencimento da fatura atual (YYYY-MM-DD)
    // Bills (faturas) do Pluggy - dados reais do banco
    currentBill?: {
        id?: string;
        dueDate?: string;         // Data de vencimento REAL da fatura (YYYY-MM-DD)
        closeDate?: string;       // Data de fechamento REAL da fatura (YYYY-MM-DD)
        periodStart?: string;     // Início do período da fatura atual
        periodEnd?: string;       // Fim do período da fatura atual (= data de fechamento)
        totalAmount?: number;
        minimumPaymentAmount?: number;
        allowsInstallments?: boolean;
    };
    bills?: Array<{
        id?: string;
        dueDate?: string;
        closeDate?: string;
        periodStart?: string;
        periodEnd?: string;
        totalAmount?: number;
        minimumPaymentAmount?: number;
    }>;
    // Configuração manual
    closingDateSettings?: {
        lastClosingDate: string;
        lastDueDate?: string | null;  // Data de vencimento configurada manualmente
        currentClosingDate: string;
        updatedAt: string;
    };
}

export interface InvoiceItem {
    id: string;
    description: string;
    amount: number;
    date: string;
    category?: string;
    type: 'income' | 'expense';
    installmentNumber?: number;
    totalInstallments?: number;
    isProjected?: boolean;
    isPayment?: boolean;
    isRefund?: boolean;
    originalTransactionId?: string;
}

export interface Invoice {
    id: string;
    referenceMonth: string; // YYYY-MM
    status: 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';
    startDate: string;
    closingDate: string;
    dueDate: string;
    total: number;
    items: InvoiceItem[];
}

export interface InvoicePeriodDates {
    closingDay: number;
    dueDay: number;
    beforeLastClosingDate: Date;
    lastClosingDate: Date;
    currentClosingDate: Date;
    nextClosingDate: Date;
    lastInvoiceStart: Date;
    currentInvoiceStart: Date;
    nextInvoiceStart: Date;
    lastDueDate: Date;
    currentDueDate: Date;
    nextDueDate: Date;
    lastMonthKey: string;
    currentMonthKey: string;
    nextMonthKey: string;
}

export interface InvoiceBuildResult {
    closedInvoice: Invoice;
    currentInvoice: Invoice;
    futureInvoices: Invoice[];
    allFutureTotal: number;
    periods: InvoicePeriodDates;
}

// ============================================================
// HELPERS - Funções utilitárias
// ============================================================

export const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // Se já tem 'T', é ISO completo, parse direto e ajustar para meio-dia local
    if (dateStr.includes('T')) {
        const isoDate = new Date(dateStr);
        return new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate(), 12, 0, 0);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d || 1, 12, 0, 0);
};

export const toDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const toMonthKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getClosingDate = (year: number, month: number, day: number): Date => {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(day, lastDayOfMonth);
    return new Date(year, month, safeDay, 23, 59, 59);
};

export const isCreditCardPayment = (tx: Transaction): boolean => {
    const d = (tx.description || '').toLowerCase();
    const c = (tx.category || '').toLowerCase();

    // Check if description explicitly indicates a credit card payment
    const isPaymentDescription =
        d.includes('pagamento de fatura') ||
        d.includes('pagamento fatura') ||
        d.includes('pagamento recebido') ||
        d.includes('credit card payment') ||
        d.includes('pag fatura') ||
        d.includes('pgto fatura') ||
        d === 'pgto';

    // Check if category indicates a credit card payment
    const isPaymentCategory =
        c.includes('credit card payment') ||
        c === 'pagamento de fatura' ||
        c === 'payment';

    // Only mark as payment if explicitly identified by description/category
    // Do NOT use tx.type === 'income' alone as it can incorrectly filter regular expenses
    return isPaymentDescription || isPaymentCategory;
};

const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getEffectiveInvoiceMonthKey = (tx: Transaction): string | null => {
    // COMPATIBILIDADE: Verificar ambos os campos
    // - App Mobile usa: invoiceMonthKey
    // - Web usa: manualInvoiceMonth
    const rawKey = typeof tx.invoiceMonthKey === 'string' ? tx.invoiceMonthKey.trim() : '';
    const manualKey = typeof (tx as any).manualInvoiceMonth === 'string' ? (tx as any).manualInvoiceMonth.trim() : '';
    
    // Se manualInvoiceMonth existe (campo do web), SEMPRE usar ele
    // Isso garante que mudanças feitas no web sejam respeitadas
    if (manualKey && MONTH_KEY_REGEX.test(manualKey)) {
        return manualKey;
    }
    
    // Se não tem manualInvoiceMonth, verificar invoiceMonthKey do app
    if (!rawKey || !MONTH_KEY_REGEX.test(rawKey)) {
        return null;
    }

    // Legacy mobile sync stored purchase month as invoiceMonthKey.
    // In that case, prefer date-range classification to avoid moving current charges to last invoice.
    const rawDate = typeof tx.date === 'string' ? tx.date : '';
    const normalizedDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
    if (ISO_DATE_REGEX.test(normalizedDate) && normalizedDate.slice(0, 7) === rawKey) {
        return null;
    }

    return rawKey;
};

const normalizeDescription = (desc: string): string => {
    return (desc || '')
        .trim()
        .toLowerCase()
        .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')
        .replace(/\s*\d+\/\d+\s*/g, '')
        .replace(/\s*parcela\s*\d+\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const extractInstallmentFromDesc = (desc: string): { current: number; total: number } | null => {
    const match = (desc || '').match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
        return { current: parseInt(match[1]), total: parseInt(match[2]) };
    }
    return null;
};

// ============================================================
// CÁLCULO DE PERÍODOS - Sistema Rotativo Automático
// ============================================================

/**
 * Calcula os períodos de fatura baseado em uma data base de fechamento.
 * O sistema é ROTATIVO: o usuário configura apenas uma data de fechamento base
 * e o sistema calcula automaticamente todos os períodos subsequentes.
 * 
 * Lógica:
 * - O usuário configura lastClosingDate (data em que a última fatura fechou)
 * - O sistema calcula:
 *   - Última Fatura (FECHADA): período que terminou em lastClosingDate
 *   - Fatura Atual (ABERTA): de lastClosingDate+1 até o próximo fechamento
 *   - Próxima Fatura: período seguinte
 * 
 * Rotação Automática:
 * - Se a data atual já passou do fechamento atual, os períodos avançam automaticamente
 * 
 * ORDEM DE PRIORIDADE:
 * 1. Configuração manual (closingDateSettings) - escolha explícita do usuário
 * 2. Dados do Pluggy (currentBill, balanceCloseDate) - dados automáticos do banco
 * 3. Fallback automático - cálculo padrão
 */
export const calculateInvoicePeriodDates = (
    card: CreditCardAccount | null,
    today: Date = new Date()
): InvoicePeriodDates => {
    // Default closing day if not configured
    let closingDay = 1;
    let dueDay = 10;

    // ==========================================
    // PRIORIDADE 1 (MÁXIMA): Usar configuração manual (closingDateSettings)
    // Esta é a escolha explícita do usuário e deve prevalecer sobre dados automáticos
    // ==========================================
    if (card?.closingDateSettings?.lastClosingDate) {
        // Parse a data base configurada pelo usuário
        let baseClosingDate = parseDate(card.closingDateSettings.lastClosingDate);

        // Extrair o dia de fechamento da data base
        closingDay = baseClosingDate.getDate();

        // PRIORIDADE 1 (MÁXIMA): Usar lastDueDate configurado manualmente pelo usuário
        if (card.closingDateSettings.lastDueDate) {
            const manualDueDate = parseDate(card.closingDateSettings.lastDueDate);
            dueDay = manualDueDate.getDate();
        }
        // PRIORIDADE 2: Tentar obter o dia de vencimento dos dados do Pluggy (se disponível)
        else if (card.currentBill?.dueDate) {
            const pluggyDueDate = parseDate(card.currentBill.dueDate);
            dueDay = pluggyDueDate.getDate();
        } else if (card.balanceDueDate) {
            const pluggyDueDate = parseDate(card.balanceDueDate);
            dueDay = pluggyDueDate.getDate();
        } else {
            dueDay = Math.min(closingDay + 10, 28); // Max 28 para evitar problemas com meses curtos
        }

        // Se também temos currentClosingDate, usar para determinar o dia
        if (card.closingDateSettings.currentClosingDate) {
            const configuredCurrentDate = parseDate(card.closingDateSettings.currentClosingDate);
            closingDay = configuredCurrentDate.getDate();
            baseClosingDate = parseDate(card.closingDateSettings.lastClosingDate);
        }

        // ROTAÇÃO AUTOMÁTICA: Avançar os períodos se necessário
        // IMPORTANTE: Usamos a data de VENCIMENTO para determinar quando avançar,
        // não a data de fechamento. Isso porque a fatura "atual" é a que está
        // pendente de pagamento, mesmo que já tenha fechado.
        let currentClosingDate = new Date(baseClosingDate);
        currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);

        // Ajustar para o dia correto do mês
        currentClosingDate = getClosingDate(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), closingDay);

        // Função para calcular o vencimento de uma fatura baseado na data de fechamento
        const calculateDueDateForClosing = (closingDate: Date): Date => {
            const dueMonth = closingDate.getMonth() === 11 ? 0 : closingDate.getMonth() + 1;
            const dueYear = closingDate.getMonth() === 11 ? closingDate.getFullYear() + 1 : closingDate.getFullYear();
            const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
            return new Date(dueYear, dueMonth, Math.min(dueDay, lastDayOfDueMonth));
        };

        // Enquanto a data atual for maior que o fechamento da fatura ATUAL, avançar 1 mês
        // Isso garante que só rotacionamos quando a fatura atual de fato fechar
        while (today > currentClosingDate) {
            baseClosingDate = new Date(currentClosingDate);
            currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
            currentClosingDate = getClosingDate(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), closingDay);
        }

        const lastClosingDate = baseClosingDate;

        // Calcular próximo fechamento
        const nextClosingDate = new Date(currentClosingDate);
        nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);
        const nextClosingDateAdjusted = getClosingDate(nextClosingDate.getFullYear(), nextClosingDate.getMonth(), closingDay);

        // Calcular fechamento anterior ao último (para a fatura anterior)
        const beforeLastClosingDate = new Date(lastClosingDate);
        beforeLastClosingDate.setMonth(beforeLastClosingDate.getMonth() - 1);
        const beforeLastClosingDateAdjusted = getClosingDate(beforeLastClosingDate.getFullYear(), beforeLastClosingDate.getMonth(), closingDay);

        // Calcular inícios dos períodos
        const lastInvoiceStart = new Date(beforeLastClosingDateAdjusted);
        lastInvoiceStart.setDate(lastInvoiceStart.getDate() + 1);

        const currentInvoiceStart = new Date(lastClosingDate);
        currentInvoiceStart.setDate(currentInvoiceStart.getDate() + 1);

        const nextInvoiceStart = new Date(currentClosingDate);
        nextInvoiceStart.setDate(nextInvoiceStart.getDate() + 1);

        // Due dates (vencimento = fechamento + ~dias no mês seguinte)
        const calculateDueDate = (closingDate: Date): Date => {
            const dueMonth = closingDate.getMonth() === 11 ? 0 : closingDate.getMonth() + 1;
            const dueYear = closingDate.getMonth() === 11 ? closingDate.getFullYear() + 1 : closingDate.getFullYear();
            const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
            return new Date(dueYear, dueMonth, Math.min(dueDay, lastDayOfDueMonth));
        };


        return {
            closingDay,
            dueDay,
            beforeLastClosingDate: beforeLastClosingDateAdjusted,
            lastClosingDate,
            currentClosingDate,
            nextClosingDate: nextClosingDateAdjusted,
            lastInvoiceStart,
            currentInvoiceStart,
            nextInvoiceStart,
            lastDueDate: calculateDueDate(lastClosingDate),
            currentDueDate: calculateDueDate(currentClosingDate),
            nextDueDate: calculateDueDate(nextClosingDateAdjusted),
            lastMonthKey: toMonthKey(calculateDueDate(lastClosingDate)),
            currentMonthKey: toMonthKey(calculateDueDate(currentClosingDate)),
            nextMonthKey: toMonthKey(calculateDueDate(nextClosingDateAdjusted))
        };
    }

    // ==========================================
    // PRIORIDADE 2: Usar periodStart e periodEnd do currentBill se disponíveis
    // Estes são os dados REAIS do período da fatura vindos diretamente do banco
    // ==========================================
    if (card?.currentBill?.periodStart && card?.currentBill?.periodEnd) {
        // periodEnd é o fim do período da fatura atual = data de fechamento
        const periodEnd = parseDate(card.currentBill.periodEnd);
        const periodStart = parseDate(card.currentBill.periodStart);

        // Extrair o dia de fechamento do periodEnd (ex: 10/02 -> closingDay = 10)
        closingDay = periodEnd.getDate();

        // Extrair o dia de vencimento do dueDate
        if (card.currentBill.dueDate) {
            const billDueDate = parseDate(card.currentBill.dueDate);
            dueDay = billDueDate.getDate();
        } else {
            // Estimar vencimento como ~10 dias após fechamento
            dueDay = Math.min(closingDay + 10, 28);
        }

        // Debug log removed for performance

        // O periodEnd do Pluggy é o fechamento da fatura ATUAL
        let currentClosingDate = new Date(periodEnd);

        // O periodStart do Pluggy é o início da fatura ATUAL
        let currentInvoiceStart = new Date(periodStart);

        // ROTAÇÃO AUTOMÁTICA: Se a data atual já passou do fechamento, avançar
        while (today > currentClosingDate) {
            currentInvoiceStart = new Date(currentClosingDate);
            currentInvoiceStart.setDate(currentInvoiceStart.getDate() + 1);
            currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
            currentClosingDate = getClosingDate(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), closingDay);
        }

        // Calcular lastClosingDate = 1 mês antes do currentClosingDate
        const lastClosingDate = new Date(currentClosingDate);
        lastClosingDate.setMonth(lastClosingDate.getMonth() - 1);
        const lastClosingDateAdjusted = getClosingDate(lastClosingDate.getFullYear(), lastClosingDate.getMonth(), closingDay);

        // beforeLastClosingDate = 2 meses antes
        const beforeLastClosingDate = new Date(lastClosingDateAdjusted);
        beforeLastClosingDate.setMonth(beforeLastClosingDate.getMonth() - 1);
        const beforeLastClosingDateAdjusted = getClosingDate(beforeLastClosingDate.getFullYear(), beforeLastClosingDate.getMonth(), closingDay);

        // nextClosingDate = 1 mês depois
        const nextClosingDate = new Date(currentClosingDate);
        nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);
        const nextClosingDateAdjusted = getClosingDate(nextClosingDate.getFullYear(), nextClosingDate.getMonth(), closingDay);

        // Calcular inícios dos períodos
        const lastInvoiceStart = new Date(beforeLastClosingDateAdjusted);
        lastInvoiceStart.setDate(lastInvoiceStart.getDate() + 1);

        const nextInvoiceStart = new Date(currentClosingDate);
        nextInvoiceStart.setDate(nextInvoiceStart.getDate() + 1);

        // Due dates
        const calculateDueDateFromClosing = (closingDateParam: Date): Date => {
            const dueDateMonth = closingDateParam.getMonth() === 11 ? 0 : closingDateParam.getMonth() + 1;
            const dueDateYear = closingDateParam.getMonth() === 11 ? closingDateParam.getFullYear() + 1 : closingDateParam.getFullYear();
            const lastDayOfDueMonth = new Date(dueDateYear, dueDateMonth + 1, 0).getDate();
            return new Date(dueDateYear, dueDateMonth, Math.min(dueDay, lastDayOfDueMonth));
        };

        return {
            closingDay,
            dueDay,
            beforeLastClosingDate: beforeLastClosingDateAdjusted,
            lastClosingDate: lastClosingDateAdjusted,
            currentClosingDate,
            nextClosingDate: nextClosingDateAdjusted,
            lastInvoiceStart,
            currentInvoiceStart,
            nextInvoiceStart,
            lastDueDate: calculateDueDateFromClosing(lastClosingDateAdjusted),
            currentDueDate: calculateDueDateFromClosing(currentClosingDate),
            nextDueDate: calculateDueDateFromClosing(nextClosingDateAdjusted),
            lastMonthKey: toMonthKey(calculateDueDateFromClosing(lastClosingDateAdjusted)),
            currentMonthKey: toMonthKey(calculateDueDateFromClosing(currentClosingDate)),
            nextMonthKey: toMonthKey(calculateDueDateFromClosing(nextClosingDateAdjusted))
        };
    }

    // PRIORIDADE 1: Usar currentBill.dueDate do Pluggy (dados reais da fatura do banco)
    // Esta é a fonte mais confiável pois vem diretamente da fatura
    if (card?.currentBill?.dueDate) {
        const billDueDate = parseDate(card.currentBill.dueDate);
        dueDay = billDueDate.getDate();

        // Estimar o dia de fechamento ou usar dado real da fatura
        if (card.currentBill.closeDate) {
            closingDay = parseDate(card.currentBill.closeDate).getDate();
        } else if (card.balanceCloseDate) {
            closingDay = parseDate(card.balanceCloseDate).getDate();
        } else {
            // Estima fechamento como ~10 dias antes do vencimento (mesmo mês)
            // Se dueDay = 11, fechamento seria aprox dia 1
            closingDay = Math.max(1, dueDay - 10);
            // Debug log removed for performance
        }

        // Debug log removed for performance

        // O vencimento do currentBill é o vencimento da fatura ATUAL
        // Então calculamos o fechamento baseado nisso
        // currentClosingDate = data de fechamento da fatura atual
        let currentClosingDate: Date;
        if (card.currentBill.closeDate) {
            currentClosingDate = parseDate(card.currentBill.closeDate);
        } else if (card.balanceCloseDate) {
            currentClosingDate = parseDate(card.balanceCloseDate);
        } else {
            // Estimar: fechamento é ~10 dias antes do vencimento
            currentClosingDate = new Date(billDueDate);
            currentClosingDate.setDate(currentClosingDate.getDate() - 10);
        }

        // ROTAÇÃO AUTOMÁTICA: Se a data atual já passou do fechamento, avançar
        // IMPORTANTE: Se estamos usando dados REAIS do Pluggy, talvez não devêssemos rotacionar automaticamente
        // a menos que o dado esteja desatualizado (data no passado e hoje é muito a frente).
        // Mas por padrão, se o dado vem do Pluggy, ele deveria ser a "verdade" atual.
        // Vamos manter a rotação apenas se não tivermos closeDate explícito DO BILL,
        // pois se temos, é aquela fatura que o banco diz que é a atual.
        // UPDATE: Para garantir que mostramos a próx fatura se a atual já fechou mesmo pro banco
        // (ex: banco diz fatura atual fecha dia 01/01, e hoje é 15/01, então já devíamos estar mostrando a de Fev)

        while (today > currentClosingDate) {
            currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
            currentClosingDate = getClosingDate(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), closingDay);
        }

        // Continuar com o cálculo padrão baseado no currentClosingDate
        const lastClosingDate = new Date(currentClosingDate);
        lastClosingDate.setMonth(lastClosingDate.getMonth() - 1);
        const lastClosingDateAdjusted = getClosingDate(lastClosingDate.getFullYear(), lastClosingDate.getMonth(), closingDay);

        const beforeLastClosingDate = new Date(lastClosingDateAdjusted);
        beforeLastClosingDate.setMonth(beforeLastClosingDate.getMonth() - 1);
        const beforeLastClosingDateAdjusted = getClosingDate(beforeLastClosingDate.getFullYear(), beforeLastClosingDate.getMonth(), closingDay);

        const nextClosingDate = new Date(currentClosingDate);
        nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);
        const nextClosingDateAdjusted = getClosingDate(nextClosingDate.getFullYear(), nextClosingDate.getMonth(), closingDay);

        const lastInvoiceStart = new Date(beforeLastClosingDateAdjusted);
        lastInvoiceStart.setDate(lastInvoiceStart.getDate() + 1);

        const currentInvoiceStart = new Date(lastClosingDateAdjusted);
        currentInvoiceStart.setDate(currentInvoiceStart.getDate() + 1);

        const nextInvoiceStart = new Date(currentClosingDate);
        nextInvoiceStart.setDate(nextInvoiceStart.getDate() + 1);

        // Due dates com o dueDay real do Pluggy
        const calculateDueDateFromClosing = (closingDateParam: Date): Date => {
            const dueDateMonth = closingDateParam.getMonth() === 11 ? 0 : closingDateParam.getMonth() + 1;
            const dueDateYear = closingDateParam.getMonth() === 11 ? closingDateParam.getFullYear() + 1 : closingDateParam.getFullYear();
            const lastDayOfDueMonth = new Date(dueDateYear, dueDateMonth + 1, 0).getDate();
            return new Date(dueDateYear, dueDateMonth, Math.min(dueDay, lastDayOfDueMonth));
        };

        return {
            closingDay,
            dueDay,
            beforeLastClosingDate: beforeLastClosingDateAdjusted,
            lastClosingDate: lastClosingDateAdjusted,
            currentClosingDate,
            nextClosingDate: nextClosingDateAdjusted,
            lastInvoiceStart,
            currentInvoiceStart,
            nextInvoiceStart,
            lastDueDate: calculateDueDateFromClosing(lastClosingDateAdjusted),
            currentDueDate: calculateDueDateFromClosing(currentClosingDate),
            nextDueDate: calculateDueDateFromClosing(nextClosingDateAdjusted),
            lastMonthKey: toMonthKey(calculateDueDateFromClosing(lastClosingDateAdjusted)),
            currentMonthKey: toMonthKey(calculateDueDateFromClosing(currentClosingDate)),
            nextMonthKey: toMonthKey(calculateDueDateFromClosing(nextClosingDateAdjusted))
        };
    }

    // PRIORIDADE 2: Usar dados do Pluggy (balanceCloseDate) se disponível
    // O Pluggy retorna a data de fechamento da fatura ATUAL
    if (card?.balanceCloseDate) {
        const pluggyCloseDate = parseDate(card.balanceCloseDate);
        closingDay = pluggyCloseDate.getDate();

        // Se também temos balanceDueDate, extrair o dia de vencimento
        if (card.balanceDueDate) {
            const pluggyDueDate = parseDate(card.balanceDueDate);
            dueDay = pluggyDueDate.getDate();
        } else {
            dueDay = Math.min(closingDay + 10, 28);
        }

        // O balanceCloseDate do Pluggy é o fechamento da fatura ATUAL
        // Então currentClosingDate = balanceCloseDate
        let currentClosingDate = new Date(pluggyCloseDate);

        // ROTAÇÃO AUTOMÁTICA: Se a data atual já passou do fechamento, avançar
        while (today > currentClosingDate) {
            currentClosingDate.setMonth(currentClosingDate.getMonth() + 1);
            currentClosingDate = getClosingDate(currentClosingDate.getFullYear(), currentClosingDate.getMonth(), closingDay);
        }

        // lastClosingDate = 1 mês antes do currentClosingDate
        const lastClosingDate = new Date(currentClosingDate);
        lastClosingDate.setMonth(lastClosingDate.getMonth() - 1);
        const lastClosingDateAdjusted = getClosingDate(lastClosingDate.getFullYear(), lastClosingDate.getMonth(), closingDay);

        // beforeLastClosingDate = 2 meses antes
        const beforeLastClosingDate = new Date(lastClosingDateAdjusted);
        beforeLastClosingDate.setMonth(beforeLastClosingDate.getMonth() - 1);
        const beforeLastClosingDateAdjusted = getClosingDate(beforeLastClosingDate.getFullYear(), beforeLastClosingDate.getMonth(), closingDay);

        // nextClosingDate = 1 mês depois do currentClosingDate
        const nextClosingDate = new Date(currentClosingDate);
        nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);
        const nextClosingDateAdjusted = getClosingDate(nextClosingDate.getFullYear(), nextClosingDate.getMonth(), closingDay);

        // Calcular inícios dos períodos
        const lastInvoiceStart = new Date(beforeLastClosingDateAdjusted);
        lastInvoiceStart.setDate(lastInvoiceStart.getDate() + 1);

        const currentInvoiceStart = new Date(lastClosingDateAdjusted);
        currentInvoiceStart.setDate(currentInvoiceStart.getDate() + 1);

        const nextInvoiceStart = new Date(currentClosingDate);
        nextInvoiceStart.setDate(nextInvoiceStart.getDate() + 1);

        // Due dates
        const calculateDueDate = (closingDateParam: Date): Date => {
            const dueDateMonth = closingDateParam.getMonth() === 11 ? 0 : closingDateParam.getMonth() + 1;
            const dueDateYear = closingDateParam.getMonth() === 11 ? closingDateParam.getFullYear() + 1 : closingDateParam.getFullYear();
            const lastDayOfDueMonth = new Date(dueDateYear, dueDateMonth + 1, 0).getDate();
            return new Date(dueDateYear, dueDateMonth, Math.min(dueDay, lastDayOfDueMonth));
        };

        return {
            closingDay,
            dueDay,
            beforeLastClosingDate: beforeLastClosingDateAdjusted,
            lastClosingDate: lastClosingDateAdjusted,
            currentClosingDate,
            nextClosingDate: nextClosingDateAdjusted,
            lastInvoiceStart,
            currentInvoiceStart,
            nextInvoiceStart,
            lastDueDate: calculateDueDate(lastClosingDateAdjusted),
            currentDueDate: calculateDueDate(currentClosingDate),
            nextDueDate: calculateDueDate(nextClosingDateAdjusted),
            lastMonthKey: toMonthKey(calculateDueDate(lastClosingDateAdjusted)),
            currentMonthKey: toMonthKey(calculateDueDate(currentClosingDate)),
            nextMonthKey: toMonthKey(calculateDueDate(nextClosingDateAdjusted))
        };
    }

    // ==========================================
    // PRIORIDADE 4 (FALLBACK): Cálculo automático padrão
    // ==========================================
    // A fatura atual fecha no dia 1 do próximo mês
    // Exemplo: Se hoje é 14/01/2026:
    //   - lastClosingDate = 01/01/2026 (fechou a fatura de dezembro)
    //   - currentClosingDate = 01/02/2026 (vai fechar a fatura de janeiro)
    //   - Fatura Atual = 02/01 até 01/02 (janeiro)

    // O fechamento atual é no dia 1 do próximo mês
    const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
    const nextMonthYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const currentClosingDate = getClosingDate(nextMonthYear, nextMonth, closingDay);

    // O último fechamento foi dia 1 do mês atual
    const lastClosingDate = getClosingDate(today.getFullYear(), today.getMonth(), closingDay);

    // O fechamento anterior ao último (para calcular o período da última fatura)
    const beforeLastMonth = lastClosingDate.getMonth() === 0 ? 11 : lastClosingDate.getMonth() - 1;
    const beforeLastYear = lastClosingDate.getMonth() === 0 ? lastClosingDate.getFullYear() - 1 : lastClosingDate.getFullYear();
    const beforeLastClosingDate = getClosingDate(beforeLastYear, beforeLastMonth, closingDay);

    // Próximo fechamento
    const nextNextMonth = currentClosingDate.getMonth() === 11 ? 0 : currentClosingDate.getMonth() + 1;
    const nextNextYear = currentClosingDate.getMonth() === 11 ? currentClosingDate.getFullYear() + 1 : currentClosingDate.getFullYear();
    const nextClosingDate = getClosingDate(nextNextYear, nextNextMonth, closingDay);

    // Inícios dos períodos
    const lastInvoiceStart = new Date(beforeLastClosingDate.getTime() + 24 * 60 * 60 * 1000);
    const currentInvoiceStart = new Date(lastClosingDate.getTime() + 24 * 60 * 60 * 1000);
    const nextInvoiceStart = new Date(currentClosingDate.getTime() + 24 * 60 * 60 * 1000);

    const calculateDueDate = (closingDateParam: Date): Date => {
        const dueMonth = closingDateParam.getMonth() === 11 ? 0 : closingDateParam.getMonth() + 1;
        const dueYear = closingDateParam.getMonth() === 11 ? closingDateParam.getFullYear() + 1 : closingDateParam.getFullYear();
        const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
        return new Date(dueYear, dueMonth, Math.min(dueDay, lastDayOfDueMonth));
    };

    return {
        closingDay,
        dueDay,
        beforeLastClosingDate,
        lastClosingDate,
        currentClosingDate,
        nextClosingDate,
        lastInvoiceStart,
        currentInvoiceStart,
        nextInvoiceStart,
        lastDueDate: calculateDueDate(lastClosingDate),
        currentDueDate: calculateDueDate(currentClosingDate),
        nextDueDate: calculateDueDate(nextClosingDate),
        lastMonthKey: toMonthKey(calculateDueDate(lastClosingDate)),
            currentMonthKey: toMonthKey(calculateDueDate(currentClosingDate)),
            nextMonthKey: toMonthKey(calculateDueDate(nextClosingDate))
        };
    };

// ============================================================
// PROCESSAMENTO DE TRANSAÇÕES
// ============================================================

const transactionToInvoiceItem = (tx: Transaction, isProjected = false): InvoiceItem => {
    const nonInstallmentMerchant = isNonInstallmentMerchant(tx.description);
    return {
        id: tx.id,
        description: tx.description,
        amount: Math.abs(tx.amount),
        date: tx.date,
        category: tx.category,
        type: tx.type,
        installmentNumber: nonInstallmentMerchant ? 1 : tx.installmentNumber,
        totalInstallments: nonInstallmentMerchant ? 1 : tx.totalInstallments,
        isProjected,
        isPayment: isCreditCardPayment(tx),
        isRefund: tx.isRefund || tx.category === 'Refund',
        originalTransactionId: tx.originalTransactionId
    };
};

interface InstallmentSeries {
    firstInstDate: Date;
    transactions: Transaction[];
}

const processInstallments = (
    transactions: Transaction[],
    cardId: string
): { series: Map<string, InstallmentSeries>; nonInstallmentTxs: Transaction[] } => {
    const installmentMap = new Map<string, InstallmentSeries>();
    const nonInstallmentTxs: Transaction[] = [];

    transactions.forEach(tx => {
        if (!tx.date) return;
        if (isCreditCardPayment(tx)) return;

        const txCardId = tx.cardId || tx.accountId || '';
        if (cardId !== 'all' && txCardId !== cardId) return;

        if (isNonInstallmentMerchant(tx.description)) {
            nonInstallmentTxs.push({
                ...tx,
                installmentNumber: 1,
                totalInstallments: 1
            });
            return;
        }

        const descInstallment = extractInstallmentFromDesc(tx.description || '');
        
        // CORREÇÃO: Priorizar regex se o dado estruturado indicar 1 parcela (à vista) mas a descrição indicar parcelamento (ex: "Compra 1/10")
        // Isso corrige casos onde a importação falha em preencher totalInstallments mas a descrição mantém a informação.
        let installmentNumber = tx.installmentNumber || 1;
        let totalInstallments = tx.totalInstallments || 0;

        if ((totalInstallments <= 1) && descInstallment && descInstallment.total > 1) {
            installmentNumber = descInstallment.current;
            totalInstallments = descInstallment.total;
        } else {
             // Fallback normal
             if (installmentNumber === 1 && descInstallment) installmentNumber = descInstallment.current;
             if (totalInstallments === 0 && descInstallment) totalInstallments = descInstallment.total;
        }

        if (totalInstallments > 1) {
            const normalizedDesc = normalizeDescription(tx.description || '');
            const seriesKey = `${txCardId}-${normalizedDesc}-${totalInstallments}`;

            if (!installmentMap.has(seriesKey)) {
                installmentMap.set(seriesKey, { firstInstDate: new Date(9999, 0, 1), transactions: [] });
            }

            const series = installmentMap.get(seriesKey)!;
            const txWithInstallment = {
                ...tx,
                installmentNumber,
                totalInstallments
            };
            series.transactions.push(txWithInstallment);

            const txDate = parseDate(tx.date);

            if (installmentNumber === 1) {
                series.firstInstDate = txDate;
            } else if (series.firstInstDate.getFullYear() === 9999) {
                const firstInstDate = new Date(txDate);
                firstInstDate.setMonth(firstInstDate.getMonth() - (installmentNumber - 1));
                series.firstInstDate = firstInstDate;
            }
        } else {
            nonInstallmentTxs.push(tx);
        }
    });

    return { series: installmentMap, nonInstallmentTxs };
};

// ============================================================
// CONSTRUÇÃO DE FATURAS
// ============================================================

// ============================================================
// CONSTRUÇÃO DE FATURAS
// ============================================================

export const buildInvoices = (
  card: CreditCardAccount | null,
  transactions: Transaction[],
  cardId: string = 'all'
): InvoiceBuildResult => {

  const today = new Date();
  const periods = calculateInvoicePeriodDates(card, today);

  const dateToNumber = (d: Date) =>
    d.getFullYear() * 10000 +
    (d.getMonth() + 1) * 100 + // FIX month index
    d.getDate();

  const lastInvoiceItems: InvoiceItem[] = [];
  const currentInvoiceItems: InvoiceItem[] = [];

  let calculatedLastTotal = 0;
  let calculatedCurrentTotal = 0;

  const lastStart = dateToNumber(periods.lastInvoiceStart);
  const lastEnd = dateToNumber(periods.lastClosingDate);
  const currentStart = dateToNumber(periods.currentInvoiceStart);
  const currentEnd = dateToNumber(periods.currentClosingDate);

  transactions.forEach(tx => {

    if (isCreditCardPayment(tx)) return;

    const txCardId = tx.cardId || tx.accountId || '';
    if (cardId !== 'all' && txCardId !== cardId) return;

    const txDate = parseDate(tx.date);
    const txDateNum = dateToNumber(txDate);

    // 🔥 NÃO usar Math.abs
    const rawAmount = Number(tx.amount) || 0;

    // Padrão:
    // expense = positivo
    // income/refund = negativo
    const signed =
      tx.type === 'expense'
        ? Math.abs(rawAmount)
        : -Math.abs(rawAmount);

    const item = transactionToInvoiceItem(tx);

    if (txDateNum >= lastStart && txDateNum <= lastEnd) {
      calculatedLastTotal += signed;
      lastInvoiceItems.push(item);
    }

    if (txDateNum >= currentStart && txDateNum <= currentEnd) {
      calculatedCurrentTotal += signed;
      currentInvoiceItems.push(item);
    }
  });

  // 🔥 SE EXISTE VALOR DO BANCO, ELE É A VERDADE
  const bankClosedTotal =
    card?.currentBill?.totalAmount ?? null;

  const closedTotal =
    bankClosedTotal !== null
      ? bankClosedTotal
      : calculatedLastTotal;

  return {
    closedInvoice: {
      id: `inv_${periods.lastMonthKey}`,
      referenceMonth: periods.lastMonthKey,
      status: 'CLOSED',
      startDate: toDateStr(periods.lastInvoiceStart),
      closingDate: toDateStr(periods.lastClosingDate),
      dueDate: toDateStr(periods.lastDueDate),
      total: closedTotal,
      items: lastInvoiceItems
    },

    currentInvoice: {
      id: `inv_${periods.currentMonthKey}`,
      referenceMonth: periods.currentMonthKey,
      status: 'OPEN',
      startDate: toDateStr(periods.currentInvoiceStart),
      closingDate: toDateStr(periods.currentClosingDate),
      dueDate: toDateStr(periods.currentDueDate),
      total: calculatedCurrentTotal,
      items: currentInvoiceItems
    },

    futureInvoices: [],
    allFutureTotal: 0,
    periods
  };
};

// ============================================================
// FORMATTERS
// ============================================================

export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

export const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

export const formatMonthKey = (monthKey: string): string => {
    if (!monthKey) return '';
    const MONTH_NAMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const [year, month] = monthKey.split('-');
    const monthIndex = parseInt(month) - 1;
    return `${MONTH_NAMES[monthIndex]}/${year}`;
};

export const formatDateShort = (date: Date): string => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
};

export const formatDateFull = (date: Date): string => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};
