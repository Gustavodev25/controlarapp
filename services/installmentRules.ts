// Shared rules for merchants that should never be treated as installment purchases.

const NON_INSTALLMENT_MERCHANTS = new Set(['mpinnerai', 'manual saude bra']);

const normalizeDescription = (desc: string): string => {
    return (desc || '')
        .trim()
        .toLowerCase()
        .replace(/\s*\d+\s*\/\s*\d+\s*$/g, '')
        .replace(/\s*\d+\/\d+\s*/g, '')
        .replace(/\s*parcela\s*\d+\s*/gi, '')
        .replace(/\s*parc\s*\d+\s*/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
};

export const isNonInstallmentMerchant = (description?: string | null): boolean => {
    const normalized = normalizeDescription(description || '');
    return NON_INSTALLMENT_MERCHANTS.has(normalized);
};
