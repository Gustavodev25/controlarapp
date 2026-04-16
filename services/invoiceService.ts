import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface MoveTransactionOptions {
    userId: string;
    transactionId: string;
    targetMonthKey: string;
    sourceMonthKey?: string;
    isRemoveOverride?: boolean;
    collectionHint?: 'transactions' | 'creditCardTransactions';
}

const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

const isValidMonthKey = (monthKey: string): boolean => MONTH_KEY_REGEX.test(monthKey);

const normalizeDateLike = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;

    const raw = value.trim();
    if (!raw) return null;

    const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
    if (ISO_DATE_REGEX.test(datePart)) return datePart;

    if (BR_DATE_REGEX.test(raw)) {
        const [d, m, y] = raw.split('/').map(Number);
        const parsed = new Date(y, m - 1, d, 12, 0, 0);
        if (parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const shiftDateToTargetMonth = (currentDate: string, targetMonthKey: string): string | null => {
    if (!ISO_DATE_REGEX.test(currentDate) || !MONTH_KEY_REGEX.test(targetMonthKey)) return null;

    const [origYear, origMonth, origDay] = currentDate.split('-').map(Number);
    const [targetYear, targetMonth] = targetMonthKey.split('-').map(Number);

    if (!Number.isInteger(origYear) || !Number.isInteger(origMonth) || !Number.isInteger(origDay)) return null;
    if (!Number.isInteger(targetYear) || !Number.isInteger(targetMonth)) return null;

    const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const safeDay = Math.min(origDay, lastDayOfTargetMonth);
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
};

const shiftDateByInvoiceDelta = (
    currentDate: string,
    sourceMonthKey: string,
    targetMonthKey: string
): string | null => {
    if (!ISO_DATE_REGEX.test(currentDate)) return null;
    if (!MONTH_KEY_REGEX.test(sourceMonthKey) || !MONTH_KEY_REGEX.test(targetMonthKey)) return null;

    const [currYear, currMonth, currDay] = currentDate.split('-').map(Number);
    const [srcYear, srcMonth] = sourceMonthKey.split('-').map(Number);
    const [tgtYear, tgtMonth] = targetMonthKey.split('-').map(Number);

    if (!Number.isInteger(currYear) || !Number.isInteger(currMonth) || !Number.isInteger(currDay)) return null;
    if (!Number.isInteger(srcYear) || !Number.isInteger(srcMonth) || !Number.isInteger(tgtYear) || !Number.isInteger(tgtMonth)) return null;

    const sourceIndex = srcYear * 12 + (srcMonth - 1);
    const targetIndex = tgtYear * 12 + (tgtMonth - 1);
    const deltaMonths = targetIndex - sourceIndex;

    if (deltaMonths === 0) return currentDate;

    const shifted = new Date(currYear, currMonth - 1, 1, 12, 0, 0);
    shifted.setMonth(shifted.getMonth() + deltaMonths);

    const shiftedYear = shifted.getFullYear();
    const shiftedMonth = shifted.getMonth() + 1;
    const lastDayOfShiftedMonth = new Date(shiftedYear, shiftedMonth, 0).getDate();
    const safeDay = Math.min(currDay, lastDayOfShiftedMonth);

    return `${shiftedYear}-${String(shiftedMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
};

const getCollectionSearchOrder = (
    hint?: 'transactions' | 'creditCardTransactions'
): ('transactions' | 'creditCardTransactions')[] => {
    if (hint === 'creditCardTransactions') return ['creditCardTransactions', 'transactions'];
    if (hint === 'transactions') return ['transactions', 'creditCardTransactions'];
    return ['transactions', 'creditCardTransactions'];
};

export const moveTransactionToInvoice = async (options: MoveTransactionOptions): Promise<{ success: boolean; error?: string }> => {
    const { userId, transactionId, targetMonthKey, sourceMonthKey, isRemoveOverride = false, collectionHint } = options;

    try {
        if (!isRemoveOverride && !isValidMonthKey(targetMonthKey)) {
            return { success: false, error: 'Chave de fatura invalida' };
        }

        const collections = getCollectionSearchOrder(collectionHint);

        for (const collectionName of collections) {
            const docRef = doc(db, 'users', userId, collectionName, transactionId);
            const docSnapshot = await getDoc(docRef);

            if (!docSnapshot.exists()) {
                continue;
            }

            if (isRemoveOverride) {
                await updateDoc(docRef, {
                    invoiceMonthKey: deleteField(),
                    invoiceMonthKeyManual: deleteField(),
                    manualInvoiceMonth: deleteField(),
                    updatedAt: new Date().toISOString()
                });
                console.log('[MoveTransaction] Override removido:', { collectionName, transactionId });
                return { success: true };
            }

            const data = docSnapshot.data();
            const currentIsoDate = normalizeDateLike(data.date);
            const shiftedDate = currentIsoDate
                ? (
                    (sourceMonthKey ? shiftDateByInvoiceDelta(currentIsoDate, sourceMonthKey, targetMonthKey) : null)
                    || shiftDateToTargetMonth(currentIsoDate, targetMonthKey)
                )
                : null;

            const payload: Record<string, any> = {
                invoiceMonthKey: targetMonthKey,
                invoiceMonthKeyManual: true,
                manualInvoiceMonth: targetMonthKey,
                // Limpa billId do Pluggy para que a override manual tenha prioridade total
                // Sincronizado com a web (CreditCards.ts updateTransactionInvoice)
                'creditCardMetadata.billId': null,
                updatedAt: new Date().toISOString()
            };

            if (shiftedDate) {
                payload.date = shiftedDate;
            }

            await updateDoc(docRef, payload);
            console.log('[MoveTransaction] Transação movida:', {
                collectionName,
                transactionId,
                sourceMonthKey: sourceMonthKey || null,
                targetMonthKey,
                oldDate: currentIsoDate,
                newDate: shiftedDate || null
            });
            return { success: true };
        }

        console.warn('[MoveTransaction] Transação não encontrada:', { transactionId, collections });
        return { success: false, error: 'Transacao nao encontrada' };
    } catch (error: any) {
        console.error('[MoveTransaction] Erro:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Formata uma chave de mes (YYYY-MM) para exibicao amigavel
 *
 * Alinhado com o formatMonthKey do invoiceBuilder.ts para consistencia visual em toda a aplicacao.
 *
 * @param monthKey - Chave do mes no formato YYYY-MM
 * @returns String formatada (ex: "FEV/26")
 */
export const formatMonthKey = (monthKey: string): string => {
    if (!monthKey || typeof monthKey !== 'string') return '';

    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;

    const year = parts[0].substring(2); // "2026" -> "26"
    const month = parseInt(parts[1], 10);

    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

    return `${monthNames[month - 1]}/${year}`;
};

/**
 * Gera lista de opcoes de faturas disponiveis para o usuario escolher (ex: modal de mover transacao)
 *
 * @param currentMonthKey - Mes atual no formato YYYY-MM (vem do invoiceBuilder)
 * @param monthsBack - Quantos meses para tras incluir
 * @param monthsForward - Quantos meses para frente incluir
 * @returns Array de opcoes de fatura
 */
export const generateInvoiceOptions = (
    currentMonthKey: string,
    monthsBack: number = 2,
    monthsForward: number = 4 // aumentado para UX melhor em fintech
): { monthKey: string; label: string; isCurrent: boolean }[] => {
    if (!currentMonthKey || typeof currentMonthKey !== 'string') {
        return [];
    }

    const [year, month] = currentMonthKey.split('-').map(Number);
    const options: { monthKey: string; label: string; isCurrent: boolean }[] = [];

    const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    for (let i = -monthsBack; i <= monthsForward; i++) {
        const targetDate = new Date(year, month - 1 + i, 1);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1;
        const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

        let label = `${monthNames[targetMonth - 1]} ${targetYear}`;
        if (i < 0) {
            label += ' (Fechada)';
        } else if (i === 0) {
            label += ' (Atual)';
        } else {
            label += ' (Futura)';
        }

        options.push({
            monthKey,
            label,
            isCurrent: i === 0
        });
    }

    return options;
};
