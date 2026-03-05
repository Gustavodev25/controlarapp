import { isNonInstallmentMerchant } from './installmentRules';

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
    manualInvoiceMonth?: string;
    isProjected?: boolean;
    isPayment?: boolean;
    isRefund?: boolean;
    originalTransactionId?: string;
    // === PLUGGY OPEN FINANCE ===
    creditCardMetadata?: {
        billId?: string;
        installmentNumber?: number;
        totalInstallments?: number;
        [key: string]: any;
    };
    pluggyRaw?: any;
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
    // Datas do Pluggy
    balanceCloseDate?: string;
    balanceDueDate?: string;
    // Bills do Pluggy
    currentBill?: {
        id?: string;
        dueDate?: string;
        closeDate?: string;
        periodStart?: string;
        periodEnd?: string;
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
    // Configuração manual de fechamento
    closingDateSettings?: {
        closingDay?: number;
        applyToAll?: boolean;
        lastClosingDate?: string;
        monthOverrides?: Record<string, { closingDay?: number; exactDate?: string }>;
        updatedAt?: string;
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
    pluggyRaw?: any;
    debugMonthKey?: string; // Campo temporário para debug
    billId?: string;
    internalMetadata?: any;
}

export interface Invoice {
    id: string;
    referenceMonth: string;
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
    beforeLastInvoiceStart: Date;
    lastInvoiceStart: Date;
    currentInvoiceStart: Date;
    nextInvoiceStart: Date;
    beforeLastDueDate: Date;
    lastDueDate: Date;
    currentDueDate: Date;
    nextDueDate: Date;
    beforeLastMonthKey: string;
    lastMonthKey: string;
    currentMonthKey: string;
    nextMonthKey: string;
    followingClosingDate: Date;
    followingInvoiceStart: Date;
    followingDueDate: Date;
    followingMonthKey: string;
}

export interface InvoiceBuildResult {
    beforeLastInvoice: Invoice;
    closedInvoice: Invoice;
    currentInvoice: Invoice;
    futureInvoices: Invoice[];
    allFutureTotal: number;
    periods: InvoicePeriodDates;
}

const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateParts = (y: number, m: number, d: number): boolean => {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    const parsed = new Date(y, m - 1, d, 12, 0, 0);
    return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
};

export const normalizePluggyDate = (dateStr?: string | null): string | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const raw = dateStr.trim();
    if (!raw) return null;

    // 1. Pure ISO date "YYYY-MM-DD"
    if (ISO_DATE_REGEX.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        if (!isValidDateParts(y, m, d)) return null;
        return toDateStr(new Date(y, m - 1, d, 12, 0, 0));
    }

    // 2. ISO date-time com timestamp (ex: "2020-07-08T00:00:00.000Z")
    //    IMPORTANTE: Extrair a parte da DATA antes de parsear para evitar
    //    bug de timezone onde UTC meia-noite vira o dia anterior no Brasil (UTC-3).
    if (raw.includes('T')) {
        const datePart = raw.split('T')[0];
        if (ISO_DATE_REGEX.test(datePart)) {
            const [y, m, d] = datePart.split('-').map(Number);
            if (!isValidDateParts(y, m, d)) return null;
            return toDateStr(new Date(y, m - 1, d, 12, 0, 0));
        }
    }

    // 3. Fallback: outros formatos — extrai parte da data se possível
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return null;
    // Usa UTC para evitar timezone shift em strings com 'Z' ou offset
    if (raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw)) {
        return toDateStr(new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0));
    }
    return toDateStr(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
};

export const parseDate = (dateStr?: string | null): Date => {
    const normalized = normalizePluggyDate(dateStr);
    if (!normalized) return new Date(NaN);
    const [y, m, d] = normalized.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
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

const getClosingDateWithOverride = (year: number, month: number, baseClosingDay: number, overrides?: Record<string, { closingDay?: number; exactDate?: string }>): Date => {
    const tentative = getClosingDate(year, month, baseClosingDay);
    const key = toMonthKey(tentative);

    if (overrides && overrides[key]) {
        const override = overrides[key];
        // Check for exactDate override (must be a string to split)
        if (override.exactDate && typeof override.exactDate === 'string') {
            const [y, m, d] = override.exactDate.split('-').map(Number);
            // Ensure valid date parts
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                return new Date(y, m - 1, d, 23, 59, 59);
            }
        }
        if (override.closingDay) {
            return getClosingDate(year, month, override.closingDay);
        }
    }
    return tentative;
};

export const isCreditCardPayment = (tx: Transaction): boolean => {
    const d = (tx.description || '').toLowerCase();
    const c = (tx.category || '').toLowerCase();
    return d.includes('pagamento de fatura') || d.includes('pagamento fatura') ||
        d.includes('pag fatura') || d.includes('pgto fatura') || d === 'pgto' ||
        c.includes('credit card payment') || c === 'pagamento de fatura';
};

const getEffectiveInvoiceMonthKey = (tx: Transaction): string | null => {
    const rawKey = typeof tx.invoiceMonthKey === 'string' ? tx.invoiceMonthKey.trim() : '';
    const manualKey = typeof tx.manualInvoiceMonth === 'string' ? tx.manualInvoiceMonth.trim() : '';

    if (manualKey && MONTH_KEY_REGEX.test(manualKey)) return manualKey;
    if (!rawKey || !MONTH_KEY_REGEX.test(rawKey)) return null;

    // Retornamos a chave mesmo que coincida com o mês da data, para clareza nos logs 
    // e consistência na classificação manual/automática vinda do banco.
    return rawKey;
};

const hasManualInvoiceOverride = (tx: Transaction): boolean => {
    if (tx.invoiceMonthKeyManual === true) return true;
    const manualKey = typeof tx.manualInvoiceMonth === 'string' ? tx.manualInvoiceMonth.trim() : '';
    return MONTH_KEY_REGEX.test(manualKey);
};

const normalizeDescription = (desc: string): string => (desc || '')
    .trim().toLowerCase()
    .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')
    .replace(/\s*\d+\/\d+\s*/g, '')
    .replace(/\s*parcela\s*\d+\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractInstallmentFromDesc = (desc: string): { current: number; total: number } | null => {
    const match = (desc || '').match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { current: parseInt(match[1]), total: parseInt(match[2]) } : null;
};

// ============================================================
// PLUGGY FIRST - PERÍODOS (usando periodStart/periodEnd)
// ============================================================

const buildPeriodsFromPluggyCurrentBill = (
    card: CreditCardAccount,
    today: Date,
    normalizedDueDate: string,
    normalizedCloseDate: string
): InvoicePeriodDates => {
    // Utilizar as datas EXATAS enviadas pelo Pluggy sem recalcular com base no dia de hoje
    const refDueDate = parseDate(normalizedDueDate);
    const refClosingDate = parseDate(normalizedCloseDate);

    let currentClosingDate = refClosingDate;
    let currentDueDate = refDueDate;

    // Determinar o dia base de fechamento (padrão)
    // PRIORIDADE: Pluggy. Ignoramos applyToAll global aqui para garantir que dados frescos do banco prevaleçam.
    // O usuário só consegue sobrescrever se tiver um monthOverride específico.
    let baseClosingDay = currentClosingDate.getDate();
    let closingDay = baseClosingDay;

    // Aplicar Overrides de Configuração do Usuário para a fatura atual
    currentClosingDate = getClosingDateWithOverride(
        currentClosingDate.getFullYear(),
        currentClosingDate.getMonth(),
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );
    closingDay = currentClosingDate.getDate(); // Reflete o dia efetivo da atual

    // Se temos um override, precisamos recalcular a data de vencimento se ela não tiver sido fornecida
    // Mas aqui estamos no fluxo onde normalizedDueDate já existe.
    // Opcional: ajustar due date se necessário, mas geralmente confiamos no Pluggy.
    // Porem, se o usuario mudou o fechamento manualmente, o vencimento pode estar descasado.
    // Vamos manter o due date do pluggy por enquanto, a menos que seja muito absurdo.

    const dueDay = currentDueDate.getDate();

    const calculateDueDate = (closing: Date): Date => {
        let dueMonth = closing.getMonth();
        let dueYear = closing.getFullYear();
        if (dueDay <= closingDay) {
            dueMonth++;
            if (dueMonth > 11) {
                dueMonth = 0;
                dueYear++;
            }
        }
        const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
        return new Date(dueYear, dueMonth, Math.min(dueDay, lastDayOfDueMonth), 12, 0, 0);
    };

    // FATURA ANTERIOR (respeitando overrides específicos dela)
    const lastClosingDate = getClosingDateWithOverride(
        currentClosingDate.getFullYear(),
        currentClosingDate.getMonth() - 1,
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );

    // FATURA ANTERIOR À ANTERIOR (respeitando overrides específicos dela)
    const beforeLastClosingDate = getClosingDateWithOverride(
        lastClosingDate.getFullYear(),
        lastClosingDate.getMonth() - 1,
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );

    // FATURA PRÓXIMA (respeitando overrides específicos dela)
    const nextClosingDate = getClosingDateWithOverride(
        currentClosingDate.getFullYear(),
        currentClosingDate.getMonth() + 1,
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );

    // DATAS DE INÍCIO (Aproximações, o buildInvoices vai sobrescrever com Pluggy real se houver)
    // O início de uma fatura é sempre o dia seguinte ao fechamento da anterior
    const currentInvoiceStart = new Date(lastClosingDate.getTime() + 86400000);
    const lastInvoiceStart = new Date(beforeLastClosingDate.getTime() + 86400000);

    // Para beforeLastInvoiceStart, precisamos da fatura ANTERIOR à beforeLast
    const threeMonthsAgoClosing = getClosingDateWithOverride(
        beforeLastClosingDate.getFullYear(),
        beforeLastClosingDate.getMonth() - 1,
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );
    const beforeLastInvoiceStart = new Date(threeMonthsAgoClosing.getTime() + 86400000);

    const nextInvoiceStart = new Date(currentClosingDate.getTime() + 86400000);

    const beforeLastDueDate = calculateDueDate(beforeLastClosingDate);
    const lastDueDate = calculateDueDate(lastClosingDate);
    const nextDueDate = calculateDueDate(nextClosingDate);

    // MÊS DE REFERÊNCIA: Seguindo a preferência do usuário e padrão de gastos,
    // usamos o mês do FECHAMENTO (spending month) como chave, não o do vencimento.
    return {
        closingDay,
        dueDay,
        beforeLastClosingDate,
        lastClosingDate,
        currentClosingDate,
        nextClosingDate,
        beforeLastInvoiceStart,
        lastInvoiceStart,
        currentInvoiceStart,
        nextInvoiceStart,
        beforeLastDueDate,
        lastDueDate,
        currentDueDate,
        nextDueDate,
        beforeLastMonthKey: toMonthKey(beforeLastClosingDate),
        lastMonthKey: toMonthKey(lastClosingDate),
        currentMonthKey: toMonthKey(currentClosingDate),
        nextMonthKey: toMonthKey(nextClosingDate),

        // FATURA SEGUINTE (following)
        followingClosingDate: getClosingDateWithOverride(
            nextClosingDate.getFullYear(),
            nextClosingDate.getMonth() + 1,
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        ),
        followingInvoiceStart: new Date(nextClosingDate.getTime() + 86400000),
        followingDueDate: calculateDueDate(getClosingDateWithOverride(
            nextClosingDate.getFullYear(),
            nextClosingDate.getMonth() + 1,
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        )),
        followingMonthKey: toMonthKey(getClosingDateWithOverride(
            nextClosingDate.getFullYear(),
            nextClosingDate.getMonth() + 1,
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        ))
    };
};


// ============================================================
// CÁLCULO DE PERÍODOS
// ============================================================

export const calculateInvoicePeriodDates = (
    card: CreditCardAccount | null | undefined,
    today: Date = new Date()
): InvoicePeriodDates => {
    const normalizedPeriodEnd = normalizePluggyDate(card?.currentBill?.periodEnd || null);
    const normalizedDueDate = normalizePluggyDate(card?.currentBill?.dueDate || null);

    if (normalizedPeriodEnd && normalizedDueDate) {
        return buildPeriodsFromPluggyCurrentBill(card!, today, normalizedDueDate, normalizedPeriodEnd);
    }

    let closingDay = 1;
    let dueDay = 10;

    const bCloseDate = normalizePluggyDate(card?.balanceCloseDate || null);
    const bDueDate = normalizePluggyDate(card?.balanceDueDate || null);

    let currentClosingDate: Date;
    let currentDueDate: Date;

    const calculateDueDate = (closing: Date): Date => {
        let dMonth = closing.getMonth();
        let dYear = closing.getFullYear();
        if (dueDay <= closingDay) {
            dMonth++;
            if (dMonth > 11) { dMonth = 0; dYear++; }
        }
        const lastDay = new Date(dYear, dMonth + 1, 0).getDate();
        return new Date(dYear, dMonth, Math.min(dueDay, lastDay), 12, 0, 0);
    };

    // Aplicar globalDay se estiver configurado para todos os meses
    if (card?.closingDateSettings?.applyToAll && card.closingDateSettings.closingDay) {
        closingDay = card.closingDateSettings.closingDay;
    }

    // Determinar o dia base para cálculos (evitando propagar overrides de um mês para outros)
    let baseClosingDay = closingDay;

    if (bCloseDate && bDueDate) {
        // 1. Usa as datas EXATAS do Pluggy como Fatura Atual, sem ancorar pelo dia de hoje
        currentClosingDate = parseDate(bCloseDate);
        currentDueDate = parseDate(bDueDate);

        // Se temos dados do Pluggy, o baseClosingDay deve ser o do Pluggy (Pluggy First)
        // Ignoramos applyToAll aqui para garantir que a data real do banco prevaleça.
        baseClosingDay = currentClosingDate.getDate();

        // Aplicar Overrides usando helper
        currentClosingDate = getClosingDateWithOverride(
            currentClosingDate.getFullYear(),
            currentClosingDate.getMonth(),
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        );
        closingDay = currentClosingDate.getDate();

        dueDay = currentDueDate.getDate();
    } else {
        // Lógica legada que baseava a âncora na data atual
        if (bDueDate) {
            dueDay = parseDate(bDueDate).getDate();
            if (bCloseDate) {
                closingDay = parseDate(bCloseDate).getDate();
            } else {
                const inferred = new Date(parseDate(bDueDate).getTime() - 86400000 * 10);
                closingDay = inferred.getDate();
            }
        } else if (bCloseDate) {
            closingDay = parseDate(bCloseDate).getDate();
            dueDay = (closingDay + 10) % 30 || 1;
        }

        baseClosingDay = closingDay;

        // ÂNCORA DINÂMICA
        let anchorYear = today.getFullYear();
        let anchorMonth = today.getMonth();

        const thisMonthClosing = getClosingDateWithOverride(anchorYear, anchorMonth, baseClosingDay, card?.closingDateSettings?.monthOverrides);
        if (today > thisMonthClosing || today > calculateDueDate(thisMonthClosing)) {
            anchorMonth++;
            if (anchorMonth > 11) { anchorMonth = 0; anchorYear++; }
        }

        currentClosingDate = getClosingDateWithOverride(anchorYear, anchorMonth, baseClosingDay, card?.closingDateSettings?.monthOverrides);
        currentDueDate = calculateDueDate(currentClosingDate);
    }

    const lastClosingDate = getClosingDateWithOverride(
        currentClosingDate.getFullYear(),
        currentClosingDate.getMonth() - 1,
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );
    const lastDueDate = calculateDueDate(lastClosingDate);

    const beforeLastClosingDate = getClosingDateWithOverride(
        lastClosingDate.getFullYear(),
        lastClosingDate.getMonth() - 1,
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );
    const beforeLastDueDate = calculateDueDate(beforeLastClosingDate);

    const nextClosingDate = getClosingDateWithOverride(
        currentClosingDate.getFullYear(),
        currentClosingDate.getMonth() + 1,
        baseClosingDay,
        card?.closingDateSettings?.monthOverrides
    );
    const nextDueDate = calculateDueDate(nextClosingDate);

    return {
        closingDay, dueDay,
        beforeLastClosingDate, lastClosingDate, currentClosingDate, nextClosingDate,

        // Ajuste de datas de início usando beforeLastClosingDate correta
        beforeLastInvoiceStart: new Date(getClosingDateWithOverride(
            beforeLastClosingDate.getFullYear(),
            beforeLastClosingDate.getMonth() - 1,
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        ).getTime() + 86400000),

        lastInvoiceStart: new Date(beforeLastClosingDate.getTime() + 86400000),
        currentInvoiceStart: new Date(lastClosingDate.getTime() + 86400000),
        nextInvoiceStart: new Date(currentClosingDate.getTime() + 86400000),
        beforeLastDueDate, lastDueDate, currentDueDate, nextDueDate,
        beforeLastMonthKey: toMonthKey(beforeLastClosingDate),
        lastMonthKey: toMonthKey(lastClosingDate),
        currentMonthKey: toMonthKey(currentClosingDate),
        nextMonthKey: toMonthKey(nextClosingDate),

        // FATURA SEGUINTE (following)
        followingClosingDate: getClosingDateWithOverride(
            nextClosingDate.getFullYear(),
            nextClosingDate.getMonth() + 1,
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        ),
        followingInvoiceStart: new Date(nextClosingDate.getTime() + 86400000),
        followingDueDate: calculateDueDate(getClosingDateWithOverride(
            nextClosingDate.getFullYear(),
            nextClosingDate.getMonth() + 1,
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        )),
        followingMonthKey: toMonthKey(getClosingDateWithOverride(
            nextClosingDate.getFullYear(),
            nextClosingDate.getMonth() + 1,
            baseClosingDay,
            card?.closingDateSettings?.monthOverrides
        ))
    };
};


// ============================================================
// PROCESSAMENTO
// ============================================================

export const transactionToInvoiceItem = (tx: Transaction, isProjected = false): InvoiceItem => {
    const nonInstallmentMerchant = isNonInstallmentMerchant(tx.description);

    // Normalização rigorosa do tipo para evitar erros no cálculo do total
    let type: 'income' | 'expense' = 'expense';
    const rawType = (tx.type || '').toLowerCase();
    if (rawType === 'income' || rawType === 'credit' || tx.amount < 0) {
        type = 'income';
    } else if (rawType === 'expense' || rawType === 'debit' || tx.amount > 0) {
        type = 'expense';
    }

    return {
        id: tx.id,
        description: tx.description,
        amount: Math.abs(tx.amount),
        date: tx.date,
        category: tx.category,
        type: type,
        installmentNumber: tx.installmentNumber,
        totalInstallments: tx.totalInstallments,
        isProjected,
        isPayment: isCreditCardPayment(tx),
        isRefund: tx.isRefund || tx.category === 'Refund',
        originalTransactionId: tx.originalTransactionId,
        pluggyRaw: (tx as any).pluggyRaw,
        debugMonthKey: tx.invoiceMonthKey || tx.manualInvoiceMonth,
        billId: tx.creditCardMetadata?.billId,
        internalMetadata: tx.creditCardMetadata
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
            nonInstallmentTxs.push({ ...tx, installmentNumber: 1, totalInstallments: 1 });
            return;
        }

        const descInstallment = extractInstallmentFromDesc(tx.description || '');

        let installmentNumber = tx.installmentNumber || 1;
        let totalInstallments = tx.totalInstallments || 0;

        if ((totalInstallments <= 1) && descInstallment && descInstallment.total > 1) {
            installmentNumber = descInstallment.current;
            totalInstallments = descInstallment.total;
        } else {
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
            const txWithInstallment = { ...tx, installmentNumber, totalInstallments };
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
// FORMATTERS & UTILS
// ============================================================

export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatDate = (dateStr: string): string => {
    const normalized = normalizePluggyDate(dateStr);
    if (!normalized) return '';
    const [y, m, d] = normalized.split('-');
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
    if (!date || isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
};

export const formatDateFull = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const validatePluggyDates = (bill: any) => {
    if (bill && bill.periodEnd && bill.closeDate) {
        const diffDays = Math.abs(
            (parseDate(bill.periodEnd).getTime() - parseDate(bill.closeDate).getTime()) / 86400000
        );
        if (diffDays > 5) {
            // Silencioso em produção
        }
    }
};

const findBillById = (card: CreditCardAccount | null | undefined, billId?: string) => {
    if (!card || !billId) return undefined;
    if (card.currentBill && card.currentBill.id === billId) return card.currentBill;
    return card.bills?.find(b => b.id === billId);
};

const getInvoiceMonthKeyForTx = (tx: Transaction, periods: InvoicePeriodDates, card: CreditCardAccount | null | undefined) => {
    if (tx.creditCardMetadata?.billId) {
        const bill = findBillById(card, tx.creditCardMetadata.billId);
        const normalizedDue = normalizePluggyDate(bill?.dueDate || null);
        return normalizedDue ? toMonthKey(parseDate(normalizedDue)) : null;
    }
    const manual = getEffectiveInvoiceMonthKey(tx);
    if (manual) return manual;
    return null;
};

const dateToNumber = (d: Date): number =>
    d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

const pickNormalizedBillDate = (bill: any, fields: string[]): string | null => {
    for (const field of fields) {
        const value = bill?.[field];
        const normalized = normalizePluggyDate(typeof value === 'string' ? value : null);
        if (normalized) return normalized;
    }
    return null;
};

const safeDateTime = (dateStr?: string | null): number => {
    const parsed = parseDate(dateStr);
    const time = parsed.getTime();
    return Number.isNaN(time) ? 0 : time;
};

const pluggyBillToInvoice = (bill: any, status: 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE'): Invoice => {
    const normalizedClose = normalizePluggyDate(bill.closeDate || bill.periodEnd || bill.balanceCloseDate || bill.dueDate);
    const normalizedStart = normalizePluggyDate(bill.periodStart);
    const normalizedDue = normalizePluggyDate(bill.dueDate);
    const referenceBase = normalizedClose || normalizedDue || normalizedStart;
    const referenceDate = referenceBase ? parseDate(referenceBase) : new Date(NaN);

    return {
        id: `bill_${bill.id}`,
        referenceMonth: isNaN(referenceDate.getTime()) ? '' : toMonthKey(referenceDate),
        status,
        startDate: normalizedStart || '',
        closingDate: normalizedClose || '',
        dueDate: normalizedDue || '',
        total: bill.totalAmount ?? 0,
        items: []
    };
};

const applyDateOverridesToBills = (bills: any[], card: CreditCardAccount | null | undefined) => {
    if (!card?.closingDateSettings || bills.length === 0) return;
    const { monthOverrides, closingDay, applyToAll } = card.closingDateSettings;

    // Ordenar cronologicamente para facilitar ajuste de start/end em cadeia
    // bills está DESC (Recente -> Antigo). Vamos inverter para processar Antigo -> Recente
    const chronologicalBills = [...bills].reverse();

    chronologicalBills.forEach((bill, index) => {
        // 1. Determinar mês de referência da fatura
        // IMPORTANTE: Se usarmos 'dueDate', recuamos 10 dias para pegar o mês provável da fatura
        const closeDateCandidate = pickNormalizedBillDate(bill, ['closeDate', 'periodEnd']);
        const dueDateStr = normalizePluggyDate(bill.dueDate);

        let refDate: Date;
        if (closeDateCandidate) {
            refDate = parseDate(closeDateCandidate);
        } else if (dueDateStr) {
            // Se só tem vencimento, recua 10 dias para "chutar" o mês de fechamento nominal
            const d = parseDate(dueDateStr);
            d.setDate(d.getDate() - 10);
            refDate = d;
        } else {
            return;
        }

        const refMonth = toMonthKey(refDate);
        let newDay: number | undefined;
        let newCloseDate: Date | null = null;

        // 2. Verificar Overrides do Mês Atual (para alterar fechamento)
        if (monthOverrides && monthOverrides[refMonth]) {
            const override = monthOverrides[refMonth];
            if (override.exactDate && typeof override.exactDate === 'string') {
                newCloseDate = parseDate(override.exactDate);
            } else if (override.closingDay) {
                newDay = override.closingDay;
            }
        } else if (applyToAll && closingDay) {
            newDay = closingDay;
        }

        // 3. Verificar Overrides do Mês ANTERIOR (para alterar data de INÍCIO desta fatura)
        // Isso é necessário se a fatura anterior não existir na lista 'chronologicalBills' (ex: muito antiga ou não retornada pelo Pluggy),
        // mas o usuário configurou um override para ela.
        if (monthOverrides || (applyToAll && closingDay)) {
            // Calcular mês anterior
            const prevMonthDate = new Date(refDate);
            prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
            const prevMonthKey = toMonthKey(prevMonthDate);
            let prevCloseDate: Date | null = null;

            if (monthOverrides && monthOverrides[prevMonthKey]) {
                const prevOverride = monthOverrides[prevMonthKey];

                if (prevOverride.exactDate && typeof prevOverride.exactDate === 'string') {
                    prevCloseDate = parseDate(prevOverride.exactDate);
                } else if (prevOverride.closingDay) {
                    // Se for só dia, precisamos reconstruir a data completa do mês anterior
                    const y = prevMonthDate.getFullYear();
                    const m = prevMonthDate.getMonth();
                    const lastDay = new Date(y, m + 1, 0).getDate();
                    const safeDay = Math.min(prevOverride.closingDay, lastDay);
                    prevCloseDate = new Date(y, m, safeDay, 12, 0, 0);
                }
            } else if (applyToAll && closingDay) {
                const y = prevMonthDate.getFullYear();
                const m = prevMonthDate.getMonth();
                const lastDay = new Date(y, m + 1, 0).getDate();
                const safeDay = Math.min(closingDay, lastDay);
                prevCloseDate = new Date(y, m, safeDay, 12, 0, 0);
            }

            if (prevCloseDate) {
                const newStartDate = new Date(prevCloseDate);
                newStartDate.setDate(newStartDate.getDate() + 1);
                const newStartDateStr = toDateStr(newStartDate);

                // Atualiza start date da fatura atual se diferir
                if (bill.periodStart !== newStartDateStr) {
                    console.log(`[DEBUG-INVOICE] Aplicando Override de Início (devido ao mês anterior ${prevMonthKey}): Fatura ${refMonth} começa em ${newStartDateStr}`);
                    bill.periodStart = newStartDateStr;
                }
            }
        }

        // Se não encontrou override direto para este mês, tenta achar se o mês real de referência é diferente.
        // As vezes o 'refDate' (chutado via due date) pode errar o mês.
        // Ex: Due 05/04, Close 28/03 -> RefMonth 2024-03.
        // Se override for para 2024-04 (devido a mudança de data), precisamos pegar.
        // Mas a lógica aqui é baseada no bill original.

        if (newDay && !newCloseDate) {
            // Calcular nova data de fechamento baseada no dia
            const [yStr, mStr] = refMonth.split('-');
            const y = parseInt(yStr);
            const m = parseInt(mStr);
            const lastDayOfMonth = new Date(y, m, 0).getDate();

            const safeDay = Math.min(newDay, lastDayOfMonth);
            newCloseDate = new Date(y, m - 1, safeDay, 12, 0, 0);
        }

        if (newCloseDate) {
            const newCloseDateStr = toDateStr(newCloseDate);

            // Se a data calculada for IGUAL à original, não faz nada para preservar dados originais
            if (closeDateCandidate && newCloseDateStr === closeDateCandidate) {
                return;
            }

            console.log(`[DEBUG-INVOICE] Aplicando Override: Mês=${refMonth}, Original=${closeDateCandidate || 'só due'}, Novo Fechamento=${newCloseDateStr}`);

            // 3. Re-calcular Vencimento Mantendo o GAP original (se houver dueDate)
            // REMOVED: O usuário pediu para NUNCA alterar a data de vencimento, mesmo que o fechamento mude.
            // if (dueDateStr) {
            //     const oldCloseStr = closeDateCandidate || toDateStr(refDate);
            //     const oldClose = parseDate(oldCloseStr);
            //     const oldDue = parseDate(dueDateStr);
            //     const gap = Math.round((oldDue.getTime() - oldClose.getTime()) / 86400000);
            //
            //     const newDue = new Date(newCloseDate);
            //     newDue.setDate(newDue.getDate() + (gap > 0 ? gap : 10)); // Mantém o gap original ou usa 10 como default
            //     bill.dueDate = toDateStr(newDue);
            // }

            // Atualizar Bill Atual
            bill.closeDate = newCloseDateStr;
            bill.periodEnd = newCloseDateStr;

            // 4. Ajustar Início da Próxima Fatura para o dia seguinte ao fechamento atual
            const nextBill = chronologicalBills[index + 1];
            if (nextBill) {
                const newStartDate = new Date(newCloseDate);
                newStartDate.setDate(newStartDate.getDate() + 1);
                nextBill.periodStart = toDateStr(newStartDate);
            }
        }
    });
};

// ============================================================
// FALLBACK LEGADO
// ============================================================

export const buildInvoices = (
    card: CreditCardAccount | null | undefined,
    transactions: Transaction[],
    cardId: string = 'all'
): InvoiceBuildResult => {
    const today = new Date();
    const periods = calculateInvoicePeriodDates(card, today);
    const uniqueTransactions = Array.from(new Map(transactions.map(t => [t.id, t])).values());

    const result: InvoiceBuildResult = {
        beforeLastInvoice: {
            id: 'before_last',
            referenceMonth: periods.beforeLastMonthKey,
            status: 'PAID',
            startDate: toDateStr(periods.beforeLastInvoiceStart),
            closingDate: toDateStr(periods.beforeLastClosingDate),
            dueDate: toDateStr(periods.beforeLastDueDate),
            total: 0,
            items: []
        },
        closedInvoice: {
            id: 'last',
            referenceMonth: periods.lastMonthKey,
            status: 'CLOSED',
            startDate: toDateStr(periods.lastInvoiceStart),
            closingDate: toDateStr(periods.lastClosingDate),
            dueDate: toDateStr(periods.lastDueDate),
            total: 0,
            items: []
        },
        currentInvoice: {
            id: 'current',
            referenceMonth: periods.currentMonthKey,
            status: 'OPEN',
            startDate: toDateStr(periods.currentInvoiceStart),
            closingDate: toDateStr(periods.currentClosingDate),
            dueDate: toDateStr(periods.currentDueDate),
            total: 0,
            items: []
        },
        futureInvoices: [],
        allFutureTotal: 0,
        periods
    };

    const recalculateTotal = (inv: Invoice) => {
        inv.total = inv.items.reduce((sum, item) => {
            const isTxRefund = item.isRefund || item.category === 'Refund' || item.isPayment;
            const isExpense = item.type === 'expense';
            const signed = (isExpense && !isTxRefund) ? Math.abs(item.amount) : -Math.abs(item.amount);
            return sum + signed;
        }, 0);
        inv.items.sort((a, b) => b.date.localeCompare(a.date));
    };

    // Faturas Futuras (Sintetizadas)
    const nextInv: Invoice = {
        id: 'next',
        referenceMonth: periods.nextMonthKey,
        status: 'OPEN',
        startDate: toDateStr(periods.nextInvoiceStart),
        closingDate: toDateStr(periods.nextClosingDate),
        dueDate: toDateStr(periods.nextDueDate),
        total: 0,
        items: []
    };
    const followingInv: Invoice = {
        id: 'following',
        referenceMonth: periods.followingMonthKey,
        status: 'OPEN',
        startDate: toDateStr(periods.followingInvoiceStart),
        closingDate: toDateStr(periods.followingClosingDate),
        dueDate: toDateStr(periods.followingDueDate),
        total: 0,
        items: []
    };

    // Classificação simples por data
    uniqueTransactions.forEach(tx => {
        if (isCreditCardPayment(tx)) return;
        const txDateNum = dateToNumber(parseDate(tx.date));
        const item = transactionToInvoiceItem(tx);

        const blStart = dateToNumber(periods.beforeLastInvoiceStart);
        const blEnd = dateToNumber(periods.beforeLastClosingDate);
        const lStart = dateToNumber(periods.lastInvoiceStart);
        const lEnd = dateToNumber(periods.lastClosingDate);
        const cStart = dateToNumber(periods.currentInvoiceStart);
        const cEnd = dateToNumber(periods.currentClosingDate);
        const nStart = dateToNumber(periods.nextInvoiceStart);
        const nEnd = dateToNumber(periods.nextClosingDate);
        const fStart = dateToNumber(periods.followingInvoiceStart);
        const fEnd = dateToNumber(periods.followingClosingDate);

        if (txDateNum >= blStart && txDateNum <= blEnd) result.beforeLastInvoice.items.push(item);
        else if (txDateNum >= lStart && txDateNum <= lEnd) result.closedInvoice.items.push(item);
        else if (txDateNum >= cStart && txDateNum <= cEnd) result.currentInvoice.items.push(item);
        else if (txDateNum >= nStart && txDateNum <= nEnd) nextInv.items.push(item);
        else if (txDateNum >= fStart && txDateNum <= fEnd) followingInv.items.push(item);
        else if (txDateNum > fEnd) followingInv.items.push(item); // Fallback: muito no futuro vai no último
    });

    recalculateTotal(result.beforeLastInvoice);
    recalculateTotal(result.closedInvoice);
    recalculateTotal(result.currentInvoice);
    recalculateTotal(nextInv);
    recalculateTotal(followingInv);

    result.futureInvoices = [nextInv, followingInv];
    result.allFutureTotal = nextInv.total + followingInv.total;

    // Fallback legado não usa bills diretos, então mantemos a lógica original de override se necessário
    // mas como removemos a função applyClosingDateOverrides, vamos reimplementar de forma segura ou remover se não for usada aqui.
    // Para manter consistência com o que foi feito na buildInvoicesPluggyFirst, 
    // idealmente o fallback também deveria usar a nova lógica, mas ele é baseado em periodos calculados.

    return result;
};









// ============================================================
// NOVA ARQUITETURA: BILL-DRIVEN (Resiliente para bancos tradicionais)
// ============================================================

// Mescla bills do mesmo ciclo de fatura (por exemplo, Bradesco que pode dividir em múltiplos bills no mesmo mês)
const mergeBillsInSameCycle = (bills: any[]): { mergedBills: any[], billIdMap: Map<string, string> } => {
    const billIdMap = new Map<string, string>(); // Mapeia billId antigo -> billId novo

    if (bills.length <= 1) {
        bills.forEach(b => billIdMap.set(b.id, b.id));
        return { mergedBills: bills, billIdMap };
    }

    // Agrupa bills por mês de fechamento (referenceMonth)
    const billsByMonth = new Map<string, any[]>();
    bills.forEach(bill => {
        const closeDate = pickNormalizedBillDate(bill, ['periodEnd', 'closeDate', 'dueDate', 'periodStart']);
        const monthKey = closeDate ? toMonthKey(parseDate(closeDate)) : '';
        if (!billsByMonth.has(monthKey)) billsByMonth.set(monthKey, []);
        billsByMonth.get(monthKey)!.push(bill);
    });

    // Se houver múltiplos bills no mesmo mês, mescla em um
    const mergedBills: any[] = [];
    const processedMonths = new Set<string>();

    // Processa na ordem original (mais recente para mais antigo)
    bills.forEach(bill => {
        const closeDate = pickNormalizedBillDate(bill, ['periodEnd', 'closeDate', 'dueDate', 'periodStart']);
        const monthKey = closeDate ? toMonthKey(parseDate(closeDate)) : '';

        if (processedMonths.has(monthKey)) return; // Já foi processado
        processedMonths.add(monthKey);

        const billsInMonth = billsByMonth.get(monthKey) || [];

        if (billsInMonth.length === 1) {
            // Se tem apenas um bill neste mês, mantém como está
            billIdMap.set(bill.id, bill.id);
            mergedBills.push(bill);
        } else {
            // Se tem múltiplos bills no mesmo mês, mescla em um
            let masterBill = { ...billsInMonth[0] };
            const firstStartStr = pickNormalizedBillDate(billsInMonth[0], ['periodStart', 'periodEnd', 'closeDate', 'dueDate']);
            const firstEndStr = pickNormalizedBillDate(billsInMonth[0], ['periodEnd', 'closeDate', 'dueDate', 'periodStart']);
            let earliestStart = firstStartStr ? parseDate(firstStartStr) : new Date(NaN);
            let latestEnd = firstEndStr ? parseDate(firstEndStr) : new Date(NaN);
            let totalAmount = billsInMonth[0].totalAmount || 0;

            // Mapeia todos os billIds antigos para o novo (masterBill id)
            billsInMonth.forEach(b => billIdMap.set(b.id, masterBill.id));

            for (let i = 1; i < billsInMonth.length; i++) {
                const bill = billsInMonth[i];
                const startStr = pickNormalizedBillDate(bill, ['periodStart', 'periodEnd', 'closeDate', 'dueDate']);
                const endStr = pickNormalizedBillDate(bill, ['periodEnd', 'closeDate', 'dueDate', 'periodStart']);
                const startDate = startStr ? parseDate(startStr) : new Date(NaN);
                const endDate = endStr ? parseDate(endStr) : new Date(NaN);

                if (!isNaN(startDate.getTime()) && (isNaN(earliestStart.getTime()) || startDate < earliestStart)) {
                    earliestStart = startDate;
                    masterBill.periodStart = toDateStr(startDate);
                }
                if (!isNaN(endDate.getTime()) && (isNaN(latestEnd.getTime()) || endDate > latestEnd)) {
                    latestEnd = endDate;
                    masterBill.periodEnd = toDateStr(endDate);
                    masterBill.closeDate = toDateStr(endDate);
                }
                totalAmount += bill.totalAmount || 0;
            }

            masterBill.totalAmount = totalAmount;
            mergedBills.push(masterBill);
        }
    });

    return { mergedBills, billIdMap };
};

export const buildInvoicesPluggyFirst = (
    card: CreditCardAccount | null | undefined,
    transactions: Transaction[],
    cardId: string = 'all'
): InvoiceBuildResult => {

    const today = new Date();
    const uniqueTxs = Array.from(new Map(transactions.map(t => [t.id, t])).values());

    // 1. Coleta TODOS os bills do Pluggy
    let allBills: any[] = [];
    if (card?.currentBill) allBills.push({ ...card.currentBill, isCurrent: true });
    if (card?.bills) allBills.push(...card.bills.map(b => ({ ...b, isCurrent: false })));

    // Ordena do mais recente para o mais antigo (baseado no dueDate)
    allBills.sort((a, b) => safeDateTime(b.dueDate) - safeDateTime(a.dueDate));

    // 1.5 GARANTIR 5 MESES ALVO (Atrasada, Anterior, Atual, Próxima, Seguinte)
    // Se o Pluggy não retornar algum desses meses, criamos faturas "sintéticas" baseadas nos períodos calculados
    const periods = calculateInvoicePeriodDates(card, today);
    const requiredMonths = [
        { key: periods.beforeLastMonthKey, close: periods.beforeLastClosingDate, start: periods.beforeLastInvoiceStart, due: periods.beforeLastDueDate },
        { key: periods.lastMonthKey, close: periods.lastClosingDate, start: periods.lastInvoiceStart, due: periods.lastDueDate },
        { key: periods.currentMonthKey, close: periods.currentClosingDate, start: periods.currentInvoiceStart, due: periods.currentDueDate },
        { key: periods.nextMonthKey, close: periods.nextClosingDate, start: periods.nextInvoiceStart, due: periods.nextDueDate },
        { key: periods.followingMonthKey, close: periods.followingClosingDate, start: periods.followingInvoiceStart, due: periods.followingDueDate },
    ];

    requiredMonths.forEach(req => {
        const existing = allBills.find(b => {
            const bClose = pickNormalizedBillDate(b, ['periodEnd', 'closeDate', 'dueDate']);
            return bClose && toMonthKey(parseDate(bClose)) === req.key;
        });
        if (!existing) {
            allBills.push({
                id: `synth_${req.key}`,
                periodStart: toDateStr(req.start),
                periodEnd: toDateStr(req.close),
                closeDate: toDateStr(req.close),
                dueDate: toDateStr(req.due),
                totalAmount: 0,
                isCurrent: req.key === periods.currentMonthKey,
                isSynthesized: true
            });
        }
    });

    // Re-ordenar após adicionar sintéticas
    allBills.sort((a, b) => safeDateTime(b.dueDate) - safeDateTime(a.dueDate));

    // MESCLA bills do mesmo ciclo (Bradesco pode dividir uma fatura em múltiplos bills)
    const { mergedBills, billIdMap } = mergeBillsInSameCycle(allBills);
    allBills = mergedBills;

    // GARANTIR QUE TODO O BILL TENHA periodStart e periodEnd (fechamento)
    // Muitos bancos não enviam o periodStart na Open Finance. Sem isso, a realocação manual falha.
    const chronoBills = [...allBills].sort((a, b) => safeDateTime(a.dueDate) - safeDateTime(b.dueDate));
    chronoBills.forEach((bill, index) => {
        if (!bill.periodEnd && bill.closeDate) bill.periodEnd = bill.closeDate;
        if (!bill.periodEnd && bill.dueDate) {
            const d = parseDate(bill.dueDate);
            d.setDate(d.getDate() - 10);
            bill.periodEnd = toDateStr(d);
            bill.closeDate = bill.periodEnd;
        }

        if (!bill.periodStart) {
            if (index > 0 && chronoBills[index - 1].periodEnd) {
                const start = parseDate(chronoBills[index - 1].periodEnd);
                start.setDate(start.getDate() + 1);
                bill.periodStart = toDateStr(start);
            } else if (bill.periodEnd) {
                const start = parseDate(bill.periodEnd);
                start.setMonth(start.getMonth() - 1);
                start.setDate(start.getDate() + 1);
                bill.periodStart = toDateStr(start);
            }
        }
    });

    // APLICA OVERRIDES DE DATA (Antes de gerar invoices e distribuir transações)
    applyDateOverridesToBills(allBills, card);

    console.log('[DEBUG] --- CICLO DO CARTÃO ---');
    console.log(`[DEBUG] Card: ${card?.name} (${cardId})`);
    allBills.forEach((b, i) => {
        console.log(`[DEBUG] Bill ${i}: ID=${b.id}, Due=${b.dueDate}, Start=${b.periodStart || '?'}, End=${b.periodEnd || '?'}, Current=${b.isCurrent}`);
    });

    // 2. Cria faturas a partir dos bills reais
    let invoices: Invoice[] = allBills.map((bill) => {
        // Assegurar que dueDate esteja presente, mesmo que o Pluggy mande vazio em alguns casos
        // Se estiver vazio, tenta estimar com base no closingDate + 10 dias (comportamento padrão de muitos cartões)
        // ou tenta pegar do balanceDueDate se disponível.
        if (!bill.dueDate) {
            const close = pickNormalizedBillDate(bill, ['periodEnd', 'closeDate']);
            if (close) {
                const d = parseDate(close);
                d.setDate(d.getDate() + 10); // Estimativa segura
                bill.dueDate = toDateStr(d);
            }
        }
        return pluggyBillToInvoice(bill, 'OPEN'); // Status será refinado depois
    });

    // Encontra a fatura marcada como atual pelo Pluggy
    const currentBillIdx = allBills.findIndex(b => b.isCurrent);
    const effectiveCurrentIdx = currentBillIdx !== -1 ? currentBillIdx : 0;

    // Refina status
    invoices.forEach((inv, idx) => {
        if (idx === effectiveCurrentIdx) inv.status = 'OPEN';
        else if (idx > effectiveCurrentIdx) {
            inv.status = idx === effectiveCurrentIdx + 1 ? 'CLOSED' : 'PAID';
        } else {
            inv.status = 'OPEN'; // Faturas futuras (Next)
        }
    });

    // Fallback caso não tenha faturas do Pluggy ainda
    if (invoices.length === 0) {
        return buildInvoices(card, transactions, cardId);
    }

    // 3. Separa transações por billId (usando mapa para tratar bills mesclados)
    const txByBillId = new Map<string, Transaction[]>();
    const unassignedTxs: Transaction[] = [];

    uniqueTxs.forEach(tx => {
        if (isCreditCardPayment(tx)) return;

        // Se o usuário alterou manualmente, tratamos como órfão para forçar a reclassificação pela data/mês
        if (hasManualInvoiceOverride(tx)) {
            unassignedTxs.push(tx);
            return;
        }

        let billId = tx.creditCardMetadata?.billId;
        // Se o billId foi mapeado (bills mesclados), usa o novo billId
        if (billId && billIdMap.has(billId)) {
            billId = billIdMap.get(billId)!;
        }

        // Se o usuário alterou manualmente um cartão inteiro (configuração de fechamento da fatura)
        // Damos primazia total às datas calculadas, desativando o vínculo forçado do banco.
        const hasConfigurations = !!card?.closingDateSettings?.applyToAll || Object.keys(card?.closingDateSettings?.monthOverrides || {}).length > 0;

        if (hasConfigurations) {
            unassignedTxs.push(tx);
        } else if (billId && allBills.some(b => b.id === billId)) {
            if (!txByBillId.has(billId)) txByBillId.set(billId, []);
            txByBillId.get(billId)!.push(tx);
        } else {
            unassignedTxs.push(tx);
        }
    });

    // Removida Lógica Antiga 3.5 de Realocação, pois agora colocamos TODAS as transações
    // em `unassignedTxs` se houver alguma configuração de usuário. A lógica de órfãs vai 
    // alocar tudo puramente por `periodStart / periodEnd`, dando "liberdade total" ao usuário.



    // 4. Atribui itens às faturas principais
    invoices.forEach(inv => {
        // Encontra o bill correspondente a esta fatura
        const bill = allBills.find(b => {
            // Lógica de matching robusta:
            // 1. Pelo ID (se o invoice foi criado a partir deste bill)
            if (inv.id === `bill_${b.id}` || inv.id === b.id) return true;

            // 2. Pelo mês de referência (referenceMonth)
            const billClose = pickNormalizedBillDate(b, ['periodEnd', 'closeDate', 'dueDate']);
            if (billClose) {
                return toMonthKey(parseDate(billClose)) === inv.referenceMonth;
            }
            return false;
        });

        // Coleta transações vinculadas a este billId
        const billTxs = bill ? (txByBillId.get(bill.id) || []) : [];

        // Transforma em InvoiceItems
        inv.items = billTxs.map(tx => transactionToInvoiceItem(tx, false));

        // Tenta encaixar as órfãs nesta fatura
        // Prioridade: Manual Override > Data dentro do Período > Mês de Referência
        const orphansInPeriod = unassignedTxs.filter(tx => {
            // 1. Manual Override (Sempre vence)
            if (hasManualInvoiceOverride(tx)) {
                const manualKey = getEffectiveInvoiceMonthKey(tx);
                return manualKey === inv.referenceMonth;
            }

            // 2. Data dentro do Período do Bill (se houver bill)
            if (bill && bill.periodStart && bill.periodEnd) {
                const startNum = dateToNumber(parseDate(bill.periodStart));
                const endNum = dateToNumber(parseDate(bill.periodEnd));
                const dNum = dateToNumber(parseDate(tx.date));
                return dNum >= startNum && dNum <= endNum;
            }

            // 3. Fallback: Mês da data coincide com mês de referência (apenas para sem billId)
            // CUIDADO: Isso pode pegar transações de início de mês que seriam da fatura anterior
            // Só usamos se não tiver bill para definir os limites exatos.
            return !bill && toMonthKey(parseDate(tx.date)) === inv.referenceMonth;
        });

        if (orphansInPeriod.length > 0) {
            console.log(`[DEBUG-INVOICE] Associando ${orphansInPeriod.length} transações órfãs à fatura ${inv.referenceMonth}`);
            inv.items.push(...orphansInPeriod.map(tx => transactionToInvoiceItem(tx)));

            // Remove as que já foram associadas para não duplicar
            // Usando filter in-place reverso ou criando novo array
            const idsToRemove = new Set(orphansInPeriod.map(t => t.id));
            let i = unassignedTxs.length;
            while (i--) {
                if (idsToRemove.has(unassignedTxs[i].id)) {
                    unassignedTxs.splice(i, 1);
                }
            }
        }
    });

    // 5. Estruturação do Result Final (Sem Projeções)
    const emptyInvoice = (status: 'OPEN' | 'CLOSED' | 'PAID', fallbackMonthOffset = 0): Invoice => {
        const date = new Date(today);
        date.setMonth(date.getMonth() + fallbackMonthOffset);
        return {
            id: `empty_${Date.now()}_${fallbackMonthOffset}`,
            referenceMonth: toMonthKey(date),
            status,
            startDate: '', // Nada calculado
            closingDate: '', // Nada calculado
            dueDate: '', // Nada calculado
            total: 0,
            items: []
        };
    };

    const result: InvoiceBuildResult = {
        beforeLastInvoice: invoices[effectiveCurrentIdx + 2] || emptyInvoice('PAID', -2),
        closedInvoice: invoices[effectiveCurrentIdx + 1] || emptyInvoice('CLOSED', -1),
        currentInvoice: invoices[effectiveCurrentIdx] || emptyInvoice('OPEN', 0),
        futureInvoices: invoices.slice(0, effectiveCurrentIdx).reverse(),
        allFutureTotal: 0,
        periods
    };

    // Sincronizar periods com as datas REAIS das faturas (que podem ter overrides)
    const syncPeriod = (inv: Invoice, targetPrefix: string) => {
        if (inv.closingDate) (result.periods as any)[`${targetPrefix}ClosingDate`] = parseDate(inv.closingDate);
        if (inv.startDate) (result.periods as any)[`${targetPrefix}InvoiceStart`] = parseDate(inv.startDate);
        if (inv.dueDate) (result.periods as any)[`${targetPrefix}DueDate`] = parseDate(inv.dueDate);
    };

    syncPeriod(result.beforeLastInvoice, 'beforeLast');
    syncPeriod(result.closedInvoice, 'last');
    syncPeriod(result.currentInvoice, 'current');
    if (result.futureInvoices.length > 0) {
        syncPeriod(result.futureInvoices[0], 'next');
    }

    const recalculateTotal = (inv: Invoice) => {
        // Se a fatura tem itens mas o total está zerado ou se for a atual (que muda sempre), 
        // recalculamos para garantir precisão visual e evitar o erro de 'valor zerado'
        const hasItems = inv.items.length > 0;
        const isCurrentOrFuture = inv.status === 'OPEN';

        if (hasItems && (inv.total === 0 || isCurrentOrFuture)) {
            inv.total = inv.items.reduce((sum, item) => {
                const isTxRefund = item.isRefund || item.category === 'Refund' || item.isPayment;
                const isExpense = item.type === 'expense';
                const signed = (isExpense && !isTxRefund) ? Math.abs(item.amount) : -Math.abs(item.amount);
                return sum + signed;
            }, 0);
        }
        inv.items.sort((a, b) => b.date.localeCompare(a.date));
    };

    recalculateTotal(result.beforeLastInvoice);
    recalculateTotal(result.closedInvoice);
    recalculateTotal(result.currentInvoice);
    result.futureInvoices.forEach(recalculateTotal);

    result.allFutureTotal = result.futureInvoices.reduce((sum, i) => sum + i.total, 0);

    // Auditoria Simplificada (Apenas o que o Banco mandou)
    console.log('\n--- INICIO AUDITORIA (STRICT PLUGGY DATA) ---');
    const audit = (inv: Invoice, name: string) => {
        console.log(`[AUDIT] ${name}: ${inv.referenceMonth} | ${inv.items.length} itens`);
    };
    audit(result.beforeLastInvoice, 'RETRASADA');
    audit(result.closedInvoice, 'FECHADA');
    audit(result.currentInvoice, 'ATUAL');
    console.log('--- FIM AUDITORIA ---\n');

    return result;
};
