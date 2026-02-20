/**
 * Serviço para análise diária automática de assinaturas
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { databaseService } from './firebase';
import { DetectedSubscription, detectSubscriptions } from './subscriptionDetector';

const DAILY_ANALYSIS_KEY = 'daily_subscription_analysis_scheduled';
const LAST_ANALYSIS_KEY = 'last_subscription_analysis_date';
const PENDING_DETECTIONS_KEY = 'pending_subscription_detections';

/**
 * Agenda a análise diária de assinaturas
 */
export const scheduleDailySubscriptionAnalysis = async (): Promise<void> => {
    try {
        // Verifica se já está agendado
        const isScheduled = await AsyncStorage.getItem(DAILY_ANALYSIS_KEY);
        if (isScheduled === 'true') {
            console.log('[DailyAnalysis] Already scheduled');
            return;
        }

        // Agenda notificação diária às 9h da manhã
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '🔍 Análise de Assinaturas',
                body: 'Analisando suas transações bancárias...',
                sound: false,
                data: {
                    type: 'subscription_analysis',
                    action: 'analyze'
                },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: 9,
                minute: 0,
                repeats: true,
            } as any,
        });

        await AsyncStorage.setItem(DAILY_ANALYSIS_KEY, 'true');
        console.log('[DailyAnalysis] Scheduled successfully');
    } catch (error) {
        console.error('[DailyAnalysis] Error scheduling:', error);
    }
};

/**
 * Cancela o agendamento da análise diária
 */
export const cancelDailySubscriptionAnalysis = async (): Promise<void> => {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await AsyncStorage.removeItem(DAILY_ANALYSIS_KEY);
        console.log('[DailyAnalysis] Cancelled successfully');
    } catch (error) {
        console.error('[DailyAnalysis] Error cancelling:', error);
    }
};

/**
 * Verifica se deve executar a análise hoje
 */
const shouldRunAnalysisToday = async (): Promise<boolean> => {
    try {
        const lastAnalysis = await AsyncStorage.getItem(LAST_ANALYSIS_KEY);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        if (!lastAnalysis) return true;
        
        return lastAnalysis !== today;
    } catch (error) {
        console.error('[DailyAnalysis] Error checking last analysis:', error);
        return true;
    }
};

/**
 * Salva as detecções pendentes
 */
const savePendingDetections = async (
    userId: string,
    detections: DetectedSubscription[]
): Promise<void> => {
    try {
        const key = `${PENDING_DETECTIONS_KEY}_${userId}`;
        const data = {
            detections,
            date: new Date().toISOString(),
        };
        await AsyncStorage.setItem(key, JSON.stringify(data));
        console.log(`[DailyAnalysis] Saved ${detections.length} pending detections`);
    } catch (error) {
        console.error('[DailyAnalysis] Error saving detections:', error);
    }
};

/**
 * Carrega as detecções pendentes
 */
export const loadPendingDetections = async (
    userId: string
): Promise<DetectedSubscription[]> => {
    try {
        const key = `${PENDING_DETECTIONS_KEY}_${userId}`;
        const data = await AsyncStorage.getItem(key);
        
        if (!data) return [];
        
        const parsed = JSON.parse(data);
        return parsed.detections || [];
    } catch (error) {
        console.error('[DailyAnalysis] Error loading detections:', error);
        return [];
    }
};

/**
 * Limpa as detecções pendentes
 */
export const clearPendingDetections = async (userId: string): Promise<void> => {
    try {
        const key = `${PENDING_DETECTIONS_KEY}_${userId}`;
        await AsyncStorage.removeItem(key);
        console.log('[DailyAnalysis] Cleared pending detections');
    } catch (error) {
        console.error('[DailyAnalysis] Error clearing detections:', error);
    }
};

/**
 * Remove uma detecção específica das pendentes
 */
export const removePendingDetection = async (
    userId: string,
    detectionId: string
): Promise<void> => {
    try {
        const pending = await loadPendingDetections(userId);
        const filtered = pending.filter(d => d.id !== detectionId);
        
        if (filtered.length > 0) {
            await savePendingDetections(userId, filtered);
        } else {
            await clearPendingDetections(userId);
        }
    } catch (error) {
        console.error('[DailyAnalysis] Error removing detection:', error);
    }
};

/**
 * Executa a análise diária de assinaturas
 */
export const runDailySubscriptionAnalysis = async (userId: string): Promise<{
    success: boolean;
    newDetections: number;
    totalPending: number;
}> => {
    try {
        console.log('[DailyAnalysis] Starting analysis for user:', userId);

        // Verifica se deve executar hoje
        const shouldRun = await shouldRunAnalysisToday();
        console.log('[DailyAnalysis] Should run today:', shouldRun);
        
        if (!shouldRun) {
            console.log('[DailyAnalysis] Already ran today, skipping');
            const pending = await loadPendingDetections(userId);
            console.log('[DailyAnalysis] Returning existing pending:', pending.length);
            return {
                success: true,
                newDetections: 0,
                totalPending: pending.length
            };
        }

        // Busca contas bancárias
        console.log('[DailyAnalysis] Fetching bank accounts...');
        const accountsResult = await databaseService.getAccounts(userId);
        
        if (!accountsResult.success || !accountsResult.data || accountsResult.data.length === 0) {
            console.log('[DailyAnalysis] No bank accounts found');
            await AsyncStorage.setItem(LAST_ANALYSIS_KEY, new Date().toISOString().split('T')[0]);
            return {
                success: true,
                newDetections: 0,
                totalPending: 0
            };
        }

        console.log('[DailyAnalysis] Found', accountsResult.data.length, 'accounts');

        // Coleta todas as transações
        const allTransactions: any[] = [];
        for (const account of accountsResult.data) {
            if (account.type === 'CHECKING_ACCOUNT' && account.transactions) {
                console.log('[DailyAnalysis] Account', account.id, 'has', account.transactions.length, 'transactions');
                allTransactions.push(...account.transactions);
            }
        }

        console.log('[DailyAnalysis] Total transactions:', allTransactions.length);

        if (allTransactions.length === 0) {
            console.log('[DailyAnalysis] No transactions found');
            await AsyncStorage.setItem(LAST_ANALYSIS_KEY, new Date().toISOString().split('T')[0]);
            return {
                success: true,
                newDetections: 0,
                totalPending: 0
            };
        }

        // Formata transações
        const formattedTransactions = allTransactions.map(t => ({
            id: t.id,
            description: t.description || t.name || 'Transação',
            amount: Math.abs(t.amount),
            date: t.date,
            type: t.amount < 0 ? 'expense' as const : 'income' as const
        }));

        console.log('[DailyAnalysis] Formatted', formattedTransactions.length, 'transactions');

        // Detecta assinaturas
        const detected = detectSubscriptions(formattedTransactions);
        console.log(`[DailyAnalysis] Detected ${detected.length} subscriptions`);

        // Busca assinaturas já existentes
        const existingResult = await databaseService.getRecurrences(userId);
        const existingSubscriptions = existingResult.success && existingResult.data 
            ? existingResult.data.filter((r: any) => r.type === 'subscription')
            : [];

        console.log('[DailyAnalysis] Existing subscriptions:', existingSubscriptions.length);

        // Filtra apenas novas detecções (que não existem ainda)
        const newDetections = detected.filter(det => {
            // Verifica se já existe uma assinatura com nome similar
            const exists = existingSubscriptions.some((sub: any) => {
                const detName = det.name.toLowerCase().trim();
                const subName = sub.name.toLowerCase().trim();
                return detName.includes(subName) || subName.includes(detName);
            });
            return !exists;
        });

        console.log(`[DailyAnalysis] ${newDetections.length} new subscriptions (${detected.length - newDetections.length} already exist)`);

        // Carrega detecções pendentes anteriores
        const previousPending = await loadPendingDetections(userId);
        console.log('[DailyAnalysis] Previous pending:', previousPending.length);

        // Mescla com novas detecções (evita duplicatas)
        const allPending = [...previousPending];
        for (const newDet of newDetections) {
            const isDuplicate = allPending.some(p => 
                p.name.toLowerCase() === newDet.name.toLowerCase()
            );
            if (!isDuplicate) {
                allPending.push(newDet);
            }
        }

        console.log('[DailyAnalysis] Total pending after merge:', allPending.length);

        // Salva detecções pendentes
        if (allPending.length > 0) {
            await savePendingDetections(userId, allPending);
            console.log('[DailyAnalysis] Saved pending detections');

            // Envia notificação se houver novas detecções
            if (newDetections.length > 0) {
                console.log('[DailyAnalysis] Sending notification for', newDetections.length, 'new detections');
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '🎯 Novas Assinaturas Detectadas!',
                        body: `Encontramos ${newDetections.length} possíve${newDetections.length === 1 ? 'l' : 'is'} assinatura${newDetections.length === 1 ? '' : 's'} nas suas transações.`,
                        sound: true,
                        data: {
                            type: 'subscription_detected',
                            count: newDetections.length
                        },
                    },
                    trigger: null, // Imediato
                });
            }
        }

        // Marca como executado hoje
        await AsyncStorage.setItem(LAST_ANALYSIS_KEY, new Date().toISOString().split('T')[0]);
        console.log('[DailyAnalysis] Analysis complete');

        return {
            success: true,
            newDetections: newDetections.length,
            totalPending: allPending.length
        };

    } catch (error) {
        console.error('[DailyAnalysis] Error running analysis:', error);
        return {
            success: false,
            newDetections: 0,
            totalPending: 0
        };
    }
};

/**
 * Força a execução da análise (ignora verificação de data)
 */
export const forceRunAnalysis = async (userId: string): Promise<{
    success: boolean;
    newDetections: number;
    totalPending: number;
}> => {
    try {
        // Remove a marca de última análise para forçar execução
        await AsyncStorage.removeItem(LAST_ANALYSIS_KEY);
        return await runDailySubscriptionAnalysis(userId);
    } catch (error) {
        console.error('[DailyAnalysis] Error forcing analysis:', error);
        return {
            success: false,
            newDetections: 0,
            totalPending: 0
        };
    }
};
