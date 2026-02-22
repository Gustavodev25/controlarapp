/**
 * Invoice Service - Serviço para gerenciar faturas de cartão de crédito
 * Inclui funcionalidade para mover transações entre faturas
 */

import { deleteField, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface MoveTransactionOptions {
    userId: string;
    transactionId: string;
    targetMonthKey: string;
    isRemoveOverride?: boolean;
}

/**
 * Move uma transação para outra fatura ou remove o override manual
 * 
 * COMPATIBILIDADE:
 * - App Mobile usa: invoiceMonthKey + invoiceMonthKeyManual
 * - Web usa: manualInvoiceMonth
 * - Esta função salva AMBOS para garantir sincronização bidirecional
 * 
 * @param options - Opções para mover a transação
 * @returns Promise com resultado da operação
 */
export const moveTransactionToInvoice = async (options: MoveTransactionOptions): Promise<{ success: boolean; error?: string }> => {
    const { userId, transactionId, targetMonthKey, isRemoveOverride = false } = options;

    try {
        // Coleções onde a transação pode estar
        const collections = ['transactions', 'creditCardTransactions'];

        for (const collectionName of collections) {
            const docRef = doc(db, 'users', userId, collectionName, transactionId);

            // Verificar se o documento existe nesta coleção
            const docSnapshot = await getDoc(docRef);
            if (!docSnapshot.exists()) {
                continue;
            }

            // Atualizar o documento
            if (isRemoveOverride) {
                // Remover o override manual (volta ao cálculo automático)
                // Remove AMBOS os campos para compatibilidade total
                await updateDoc(docRef, {
                    // Campos do App Mobile
                    invoiceMonthKey: deleteField(),
                    invoiceMonthKeyManual: deleteField(),
                    // Campo do Web
                    manualInvoiceMonth: deleteField(),
                    // Timestamp
                    updatedAt: new Date().toISOString()
                });
                console.log('[moveTransactionToInvoice] Override removido:', transactionId);
            } else {
                // Definir o override manual
                // Salva AMBOS os campos para compatibilidade total
                await updateDoc(docRef, {
                    // Campos do App Mobile
                    invoiceMonthKey: targetMonthKey,
                    invoiceMonthKeyManual: true,
                    // Campo do Web (para compatibilidade)
                    manualInvoiceMonth: targetMonthKey,
                    // Timestamp
                    updatedAt: new Date().toISOString()
                });
                console.log('[moveTransactionToInvoice] Transação movida:', transactionId, '→', targetMonthKey);
            }

            return { success: true };
        }

        throw new Error('Transação não encontrada em nenhuma coleção');
    } catch (error: any) {
        console.error('[moveTransactionToInvoice] Erro:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Formata uma chave de mês (YYYY-MM) para exibição amigável
 * 
 * @param monthKey - Chave do mês no formato YYYY-MM
 * @returns String formatada (ex: "Fev/26")
 */
export const formatMonthKey = (monthKey: string): string => {
    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;

    const year = parts[0].substring(2); // "2026" → "26"
    const month = parseInt(parts[1]);

    const monthNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return `${monthNames[month]}/${year}`;
};

/**
 * Gera lista de opções de faturas disponíveis
 * 
 * @param currentMonthKey - Mês atual no formato YYYY-MM
 * @param monthsBack - Quantos meses para trás incluir
 * @param monthsForward - Quantos meses para frente incluir
 * @returns Array de opções de fatura
 */
export const generateInvoiceOptions = (
    currentMonthKey: string,
    monthsBack: number = 2,
    monthsForward: number = 3
): Array<{ monthKey: string; label: string; isCurrent: boolean }> => {
    const [year, month] = currentMonthKey.split('-').map(Number);
    const options: Array<{ monthKey: string; label: string; isCurrent: boolean }> = [];

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    // Gerar opções de meses
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
