export interface Discount {
    id: string;
    name: string;
    value: string;
    type: 'fixed' | 'percentage';
}

export const INSS_TABLE_2025 = [
    { limit: 1518.00, rate: 0.075, deduction: 0 },
    { limit: 2793.88, rate: 0.09, deduction: 21.18 }, // Deduction is approximate/not used in loop
    { limit: 4190.83, rate: 0.12, deduction: 101.18 },
    { limit: 8157.41, rate: 0.14, deduction: 181.18 },
];

export const IRRF_TABLE_2025 = [
    { limit: 2428.80, rate: 0, deduction: 0 },
    { limit: 2826.65, rate: 0.075, deduction: 182.16 },
    { limit: 3751.05, rate: 0.15, deduction: 394.16 },
    { limit: 4664.68, rate: 0.225, deduction: 675.49 },
    { limit: Infinity, rate: 0.275, deduction: 908.73 },
];

export const parseCurrency = (value: string): number => {
    return parseFloat(value.replace(/\D/g, '')) / 100 || 0;
};

export const parseNumber = (value: string): number => {
    return parseFloat(value.replace(',', '.')) || 0;
};

const roundToCents = (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const calculateFinancials = (
    baseSalary: number,
    isSalaryExempt: boolean,
    hasAdvance: boolean,
    advanceType: 'percentage' | 'fixed',
    advanceValue: number, // Should be parsed value (number or percentage)
    otherDiscounts: Discount[]
) => {
    // 1. INSS
    let inssRaw = 0;
    if (!isSalaryExempt) {
        let previousLimit = 0;
        for (const range of INSS_TABLE_2025) {
            const currentLimit = Math.min(baseSalary, range.limit);
            if (currentLimit > previousLimit) {
                inssRaw += (currentLimit - previousLimit) * range.rate;
                previousLimit = range.limit;
            }
        }
    }
    const inss = roundToCents(inssRaw);

    // 2. Advance (Vale)
    let advanceRaw = 0;
    if (hasAdvance) {
        if (advanceType === 'percentage') {
            const pct = advanceValue;
            advanceRaw = baseSalary * (pct / 100);
        } else {
            advanceRaw = advanceValue;
        }
    }
    const advance = roundToCents(advanceRaw);

    // 3. IRRF
    const irrfBase = roundToCents(baseSalary - inss);
    let irrf = 0;
    if (!isSalaryExempt && irrfBase > 0) {
        const bracket = IRRF_TABLE_2025.find(b => irrfBase <= b.limit) || IRRF_TABLE_2025[IRRF_TABLE_2025.length - 1];
        irrf = roundToCents(Math.max(0, (irrfBase * bracket.rate) - bracket.deduction));
    }

    // 4. Other Discounts
    let others = 0;
    otherDiscounts.forEach(d => {
        if (d.type === 'fixed') {
            others += parseCurrency(d.value);
        } else {
            const pct = parseNumber(d.value);
            others += baseSalary * (pct / 100);
        }
    });
    others = roundToCents(others);

    const netSalary = roundToCents(baseSalary - inss - irrf - advance - others);

    return {
        grossSalary: roundToCents(baseSalary),
        inss,
        irrf,
        advance,
        otherDiscountsTotal: others,
        netSalary
    };
};
