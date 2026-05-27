import { CreditCardAccount } from './invoiceBuilder';

export interface ClosingDateUpdatePayload {
    closingDateSettings: {
        closingDay?: number;
        applyToAll?: boolean;
        monthOverrides?: Record<string, { closingDay?: number; exactDate?: string }>;
        updatedAt: string;
    };
}

export interface ClosingDateValidationResult {
    isValid: boolean;
    error?: string;
}

export const validateClosingDay = (day: number): boolean => {
    return Number.isInteger(day) && day >= 1 && day <= 31;
};

export const validateMonthKey = (monthKey: string): boolean => {
    // Expected format: YYYY-MM
    const regex = /^\d{4}-\d{2}$/;
    if (!regex.test(monthKey)) return false;

    const [year, month] = monthKey.split('-').map(Number);
    return month >= 1 && month <= 12;
};

export const validateClosingDateForMonth = (day: number, monthKey: string): ClosingDateValidationResult => {
    if (!validateClosingDay(day)) {
        return { isValid: false, error: 'O dia deve ser entre 1 e 31.' };
    }

    if (!validateMonthKey(monthKey)) {
        return { isValid: false, error: 'Mês inválido.' };
    }

    const [year, month] = monthKey.split('-').map(Number);
    // Check if day exists in that month
    const daysInMonth = new Date(year, month, 0).getDate();

    if (day > daysInMonth) {
        return { isValid: false, error: `O dia ${day} não existe no mês ${month}/${year}.` };
    }

    return { isValid: true };
};

export const createClosingDateUpdatePayload = (
    account: CreditCardAccount,
    newClosingDay: number,
    applyToAll: boolean,
    targetMonthKey?: string
): ClosingDateUpdatePayload | null => {
    if (!validateClosingDay(newClosingDay)) return null;

    const currentSettings = account.closingDateSettings || {};
    const updatedAt = new Date().toISOString();

    if (applyToAll) {
        return {
            closingDateSettings: {
                ...currentSettings,
                closingDay: newClosingDay,
                applyToAll: true,
                updatedAt
            }
        };
    }

    if (!targetMonthKey || !validateMonthKey(targetMonthKey)) return null;

    const validation = validateClosingDateForMonth(newClosingDay, targetMonthKey);
    if (!validation.isValid) return null;

    const monthOverrides = currentSettings.monthOverrides || {};

    return {
        closingDateSettings: {
            ...currentSettings,
            // If we are switching from global to specific, we might want to keep the old global setting or not.
            // The requirement is usually just to override for this month.
            // But if applyToAll was true, setting it to false might be needed if the user explicitly chose "Only this month"
            // However, the logic in invoiceBuilder prioritizes monthOverrides regardless of applyToAll flag for that specific month.
            // But if we want to stop "Apply to all" behavior for FUTURE months, that's different.
            // Usually "Apply to all" means "Default closing day". "Month override" is an exception.
            // So we keep applyToAll as is (or as it was in currentSettings) and just add the override.
            // Wait, if the user selects "Only this month", they are adding an exception.

            monthOverrides: {
                ...monthOverrides,
                [targetMonthKey]: { closingDay: newClosingDay }
            },
            updatedAt
        }
    };
};
