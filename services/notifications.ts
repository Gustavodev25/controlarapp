﻿
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { databaseService } from './firebase';
import { CreditCardAccount, formatCurrency } from './invoiceBuilder';

// Types (mirrored from RecurrenceView for consistency)
export interface RecurrenceItem {
    id: string;
    name: string;
    dueDate: string; // YYYY-MM-DD
    type: 'subscription' | 'reminder';
    status: 'paid' | 'pending' | 'overdue';
    frequency?: 'monthly' | 'yearly';
    cancellationDate?: string; // YYYY-MM-DD
    [key: string]: any;
}

export interface InvoiceNotificationPreferences {
    daysBeforeDue: number;
    showAmount: boolean;
}

type NotificationCategory = 'recurrence' | 'invoice' | 'plan' | 'sync';

interface NotificationMetadata {
    category: NotificationCategory;
    entityId?: string;
    triggerKey?: string;
    userId?: string;
}

interface ScheduleNotificationOptions {
    metadata?: NotificationMetadata;
    retries?: number;
}

interface ScheduleCategoryOptions {
    skipCategoryCleanup?: boolean;
}

export interface PaymentAlertRescheduleParams {
    userId: string;
    enabled?: boolean;
    recurrences?: RecurrenceItem[];
    accounts?: CreditCardAccount[];
    plan?: any;
    invoicePreferences?: InvoiceNotificationPreferences;
}

const PAYMENT_NOTIFICATION_CATEGORIES: NotificationCategory[] = ['recurrence', 'invoice', 'plan'];
const DEFAULT_INVOICE_NOTIFICATION_PREFERENCES: InvoiceNotificationPreferences = { daysBeforeDue: 3, showAmount: false };

// Notification Templates
const NotificationTemplates = {
    due: {
        7: (name: string) => `Faltam 7 dias para o vencimento de ${name}`,
        5: (name: string) => `Faltam 5 dias para o vencimento de ${name}`,
        3: (name: string) => `Lembrete: Faltam 3 dias para o vencimento de ${name}`,
        1: (name: string) => `Falta 1 dia para o vencimento de ${name}`,
        0: (name: string, type: string) => `${type} ${name} vence hoje!`,
        overdue: (name: string, type: string) => `${type} ${name} venceu ontem. Nao esqueca de pagar!`,
    },
    invoice: {
        due_soon: (name: string, days: number, amount?: string) =>
            `Sua fatura do cartao ${name} vence em ${days} dias.${amount ? ` Valor: ${amount}` : ''}`,
        due_today: (name: string, amount?: string) =>
            `A fatura do cartao ${name} vence hoje!${amount ? ` Valor: ${amount}` : ''}`,
        overdue: (name: string) =>
            `A fatura do cartao ${name} venceu ontem. Evite juros!`,
    },
    sync: {
        daily_reset: 'Seus creditos de sincronizacao foram renovados! Aproveite para atualizar seus dados.',
        bank_released: (name: string) => `O banco ${name} ja pode ser sincronizado novamente.`,
        connection_success: (name: string) => `Suas contas e transações do ${name} foram sincronizadas com sucesso!`,
        connection_error: (name: string, error?: string) => error
            ? `Falha ao conectar com ${name}: ${error}`
            : `Não foi possível conectar ao ${name}. Tente novamente.`,
    },
    plan: {
        7: () => `Seu plano expira em 7 dias. Renove para manter o acesso.`,
        3: () => `Seu plano expira em 3 dias. Evite o bloqueio!`,
        1: () => `Critico: Seu plano expira amanha!`,
        0: () => `Seu plano expirou! Atualize seu pagamento agora.`,
        deactivation: () => `Aviso Final: Seu plano sera desativado em 24h. Atualize seu cartao.`,
    },
    cancellation: {
        2: (name: string) => `Lembrete: Faltam 2 dias para cancelar ${name}`,
        1: (name: string) => `Urgente: Cancele ${name} amanha!`,
    }
};

let Notifications: any;
let isRescheduling = false;

const getNotifications = () => {
    if (Notifications) return Notifications;

    try {
        // Hack: Suppress Expo Go SDK 53+ error about Push Notifications
        const originalError = console.error;
        console.error = (...args: any[]) => {
            if (args[0]?.toString()?.includes('expo-notifications: Android Push notifications')) {
                console.log('[NotificationService] Suppressed Expo Go Push Notification Error (Local notifications should still work)');
                return;
            }
            originalError.apply(console, args);
        };

        Notifications = require('expo-notifications');

        console.error = originalError;

        if (Notifications) {
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: true,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });
        }
        return Notifications;
    } catch (error) {
        console.warn('Failed to load expo-notifications:', error);
        return null;
    }
};

// Logger Helper
const logActivity = async (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    let dataStr = '';
    if (data) {
        if (data instanceof Error) {
            dataStr = JSON.stringify({ message: data.message, stack: data.stack, name: data.name });
        } else {
            try {
                dataStr = JSON.stringify(data);
            } catch (e) {
                dataStr = String(data);
            }
        }
    }
    const logEntry = `[NotificationService] ${timestamp}: ${message} ${dataStr}`;
    // console.log(logEntry);
};

const normalizeDateString = (value: string | null | undefined): string | null => {
    if (!value) return null;

    const compact = String(value).trim().replace(/\s+/g, '');
    if (!compact) return null;

    if (compact.includes('T')) {
        return compact.split('T')[0] || null;
    }

    return compact;
};

const parseDateOnly = (value: string | null | undefined): Date | null => {
    const normalized = normalizeDateString(value);
    if (!normalized) return null;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
        const [dd, mm, yyyy] = normalized.split('/').map(Number);
        const parsed = new Date(yyyy, mm - 1, dd);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        return null;
    }

    const [yyyy, mm, dd] = normalized.split('-').map(Number);
    const parsed = new Date(yyyy, mm - 1, dd);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const parsePlanDueDate = (plan: any): Date | null => {
    const nextBillingDate = normalizeDateString(plan?.nextBillingDate);
    if (nextBillingDate) {
        const parsed = parseDateOnly(nextBillingDate);
        if (parsed) return parsed;
    }

    const expiresAt = normalizeDateString(plan?.expiresAt);
    if (expiresAt) {
        const parsed = parseDateOnly(expiresAt);
        if (parsed) return parsed;
    }

    const renewalDateRaw = String(plan?.renewalDate || '').trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(renewalDateRaw)) {
        const [dd, mm, yyyy] = renewalDateRaw.split('/').map(Number);
        const parsed = new Date(yyyy, mm - 1, dd);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
};

const inferLegacyCategoryFromTitle = (title: string | undefined): NotificationCategory | null => {
    if (!title) return null;
    const normalized = title.toLowerCase();

    if (normalized.includes('vencimento de') || normalized.includes('cancelamento de')) {
        return 'recurrence';
    }
    if (normalized.includes('fatura do cart')) {
        return 'invoice';
    }
    if (normalized.includes('assinatura')) {
        return 'plan';
    }
    if (normalized.includes('creditos renovados') || normalized.includes('sincronizacao liberada')) {
        return 'sync';
    }

    return null;
};

const getTriggerTimestamp = (trigger: any): number => {
    if (!trigger) return 0;
    if (typeof trigger.value === 'number') return trigger.value;
    if (trigger.date) return new Date(trigger.date).getTime();
    return 0;
};

const mapAccountsForInvoiceAlerts = (accounts: any[]): CreditCardAccount[] => {
    return accounts
        .filter((acc: any) => {
            const isCreditType = acc.type === 'credit' || acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD' || acc.subtype === 'CREDIT_CARD';
            const isNotBankOrChecking = acc.type !== 'BANK' && acc.type !== 'checking';
            const hasCreditCardIndicators = acc.creditLimit != null || acc.currentBill != null || acc.balanceCloseDate != null || acc.balanceDueDate != null;

            const nameLower = (acc.name || '').toLowerCase();
            const isDebitCard = nameLower.includes('elite') ||
                nameLower.includes('debito') ||
                nameLower.includes('poupanca') ||
                nameLower.includes('conta corrente') ||
                nameLower.includes('savings');

            return isCreditType && isNotBankOrChecking && hasCreditCardIndicators && !isDebitCard;
        })
        .map((acc: any) => ({
            id: acc.id,
            name: acc.name || null,
            type: acc.type || 'credit',
            subtype: acc.subtype || null,
            creditLimit: acc.creditLimit || null,
            availableCreditLimit: acc.availableCreditLimit || null,
            balance: acc.balance || null,
            connector: acc.connector || null,
            balanceCloseDate: acc.balanceCloseDate || null,
            balanceDueDate: acc.balanceDueDate || null,
            currentBill: acc.currentBill || null,
            bills: acc.bills || null
        }));
};

export const notificationService = {
    async registerForPushNotificationsAsync() {
        const Notifications = getNotifications();
        if (!Notifications) return false;

        try {
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Notificacoes',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                await logActivity('Permission not granted');
                return false;
            }

            return true;
        } catch (error) {
            await logActivity('Error requesting permissions', error);
            return false;
        }
    },

    async scheduleNotificationWithRetry(
        title: string,
        body: string,
        triggerDate: Date,
        options: ScheduleNotificationOptions = {}
    ) {
        const Notifications = getNotifications();
        if (!Notifications) return;

        const retries = options.retries ?? 3;

        // ❗ NÃO agendar datas passadas
        if (triggerDate.getTime() <= Date.now() - 60000) {
            await logActivity('Skipping past date', { title, triggerDate: triggerDate.toISOString() });
            return;
        }

        // ✅ PROTEÇÃO CONTRA DUPLICAÇÃO REAL
        if (options.metadata?.category) {
            const alreadyScheduled = await this.isNotificationAlreadyScheduled(
                options.metadata.category,
                options.metadata.entityId,
                options.metadata.triggerKey
            );

            if (alreadyScheduled) {
                await logActivity('Skipping duplicate scheduling', options.metadata);
                return;
            }
        }

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title,
                        body,
                        sound: true,
                        data: options.metadata
                            ? {
                                category: options.metadata.category,
                                entityId: options.metadata.entityId ?? null,
                                triggerKey: options.metadata.triggerKey ?? null,
                                userId: options.metadata.userId ?? null,
                            }
                            : undefined,
                    },
                    trigger: {
                        type: 'date',
                        date: triggerDate,
                    },
                });

                await logActivity('Notification scheduled', {
                    title,
                    triggerDate: triggerDate.toISOString(),
                    metadata: options.metadata
                });

                return;
            } catch (error) {
                await logActivity(`Attempt ${attempt} failed`, error);

                if (attempt === retries) {
                    await logActivity('All retry attempts failed for notification', { title });
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                }
            }
        }
    },

    async cancelNotificationsByCategory(categories: NotificationCategory[]) {
        const Notifications = getNotifications();
        if (!Notifications || categories.length === 0) return;

        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            let cancelledCount = 0;

            for (const item of scheduled) {
                const categoryFromData = item?.content?.data?.category as NotificationCategory | undefined;
                const category = categoryFromData || inferLegacyCategoryFromTitle(item?.content?.title);
                const identifier = item?.identifier;

                if (!category || !identifier || !categories.includes(category)) {
                    continue;
                }

                if (typeof Notifications.cancelScheduledNotificationAsync === 'function') {
                    await Notifications.cancelScheduledNotificationAsync(identifier);
                    cancelledCount++;
                }
            }

            await logActivity('Notifications cancelled by category', { categories, cancelledCount });
        } catch (error) {
            await logActivity('Error cancelling notifications by category', error);
        }
    },

    async isNotificationAlreadyScheduled(
        category: NotificationCategory,
        entityId?: string,
        triggerKey?: string
    ) {
        const Notifications = getNotifications();
        if (!Notifications) return false;

        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();

            return scheduled.some((n: any) =>
                n?.content?.data?.category === category &&
                n?.content?.data?.entityId === (entityId ?? null) &&
                n?.content?.data?.triggerKey === (triggerKey ?? null)
            );
        } catch {
            return false;
        }
    },

    async cancelAllNotifications() {
        const Notifications = getNotifications();
        if (!Notifications) return;
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            await logActivity('All notifications cancelled');
        } catch (e) {
            await logActivity('Error cancelling notifications', e);
        }
    },

    // Function for User Testing
    async scheduleTestNotification() {
        const Notifications = getNotifications();
        if (!Notifications) {
            console.warn('Notifications module not available');
            return false;
        }

        const hasPermission = await this.registerForPushNotificationsAsync();
        if (!hasPermission) {
            console.warn('No permission for notifications');
            return false;
        }

        const triggerDate = new Date(Date.now() + 5000); // 5 seconds from now

        await this.scheduleNotificationWithRetry(
            'Teste de Notificacao',
            'Se voce esta vendo isso, o sistema esta funcionando corretamente!',
            triggerDate
        );

        return true;
    },

    async getScheduledNotificationsSummary() {
        const Notifications = getNotifications();
        if (!Notifications) return 'Modulo de notificacoes indisponivel.';

        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            if (scheduled.length === 0) return 'Nenhuma notificacao agendada.';

            // Sort by date
            scheduled.sort((a: any, b: any) => getTriggerTimestamp(a.trigger) - getTriggerTimestamp(b.trigger));

            const count = scheduled.length;
            const nextFew = scheduled.slice(0, 5).map((n: any) => {
                const timestamp = getTriggerTimestamp(n.trigger);
                const date = new Date(timestamp);
                const dateStr = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                return `- ${dateStr}: ${n.content.title}`;
            }).join('\n');

            return `${count} agendamento(s) encontrado(s).\n\nProximos:\n${nextFew}${count > 5 ? '\n...' : ''}`;
        } catch (error) {
            return 'Erro ao buscar agendamentos.';
        }
    },

    async scheduleRecurrenceNotifications(items: RecurrenceItem[], userId: string, options: ScheduleCategoryOptions = {}) {
        if (!getNotifications() || !userId) return;

        if (!options.skipCategoryCleanup) {
            await this.cancelNotificationsByCategory(['recurrence']);
        }

        const safeItems = Array.isArray(items) ? items : [];
        await logActivity(`Processing ${safeItems.length} items for scheduling`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const item of safeItems) {
            if (item.status === 'paid') continue;

            try {
                const name = item.name;
                const typeLabel = item.type === 'subscription' ? 'Assinatura' : 'Lembrete';

                const parsedDueDate = parseDateOnly(item.dueDate);
                if (!parsedDueDate) continue;

                const day = parsedDueDate.getDate();
                const month = parsedDueDate.getMonth();

                let dueDate = new Date(parsedDueDate);
                dueDate.setHours(0, 0, 0, 0);

                // Recurrence Logic
                if (item.frequency === 'monthly') {
                    // Project to current month
                    let targetDate = new Date(today.getFullYear(), today.getMonth(), day);

                    // Adjust for months with fewer days (e.g., 31st in Feb)
                    if (targetDate.getDate() !== day) {
                        targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    }

                    targetDate.setHours(0, 0, 0, 0);

                    // If date has passed today, move to next month
                    if (targetDate.getTime() < today.getTime()) {
                        targetDate.setMonth(targetDate.getMonth() + 1);
                        const nextMonthMaxDays = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
                        if (day > nextMonthMaxDays) {
                            targetDate.setDate(nextMonthMaxDays);
                        } else {
                            targetDate.setDate(day);
                        }
                    }
                    dueDate = targetDate;
                } else if (item.frequency === 'yearly') {
                    dueDate = new Date(today.getFullYear(), month, day);
                    if (dueDate.getMonth() !== month) {
                        dueDate = new Date(today.getFullYear(), month + 1, 0);
                    }
                    dueDate.setHours(0, 0, 0, 0);

                    if (dueDate.getTime() < today.getTime()) {
                        dueDate = new Date(today.getFullYear() + 1, month, day);
                        if (dueDate.getMonth() !== month) {
                            dueDate = new Date(today.getFullYear() + 1, month + 1, 0);
                        }
                        dueDate.setHours(0, 0, 0, 0);
                    }
                } else {
                    // One-time
                    dueDate.setHours(0, 0, 0, 0);
                }

                // Identify if within 7 days
                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays <= 7) {
                    await logActivity(`Item '${name}' is due within 7 days (${diffDays} days)`);
                }

                // Define triggers
                const triggers = [
                    { days: -7, msg: NotificationTemplates.due[7](name) },
                    { days: -5, msg: NotificationTemplates.due[5](name) },
                    { days: -3, msg: NotificationTemplates.due[3](name) },
                    { days: -1, msg: NotificationTemplates.due[1](name) },
                    { days: 0, msg: NotificationTemplates.due[0](name, typeLabel) },
                    { days: 1, msg: NotificationTemplates.due.overdue(name, typeLabel) },
                ];

                const now = new Date();

                // Schedule Due Date Notifications
                for (const t of triggers) {
                    let triggerDate = new Date(dueDate);
                    triggerDate.setDate(dueDate.getDate() + t.days);
                    triggerDate.setHours(9, 0, 0, 0); // 9 AM
                    const triggerTypeSuffix = t.days === 0 ? 'due_today' : `due_day_${t.days}`;

                    // Check if trigger day is TODAY
                    const isTriggerToday = triggerDate.toDateString() === now.toDateString();

                    if (isTriggerToday) {
                        // If it's today and time passed, schedule immediately (with delay)
                        if (triggerDate.getTime() <= now.getTime()) {
                            const spamKey = `notified_${userId}_${item.id}_${now.toISOString().split('T')[0]}_${triggerTypeSuffix}`;

                            const alreadySent = await AsyncStorage.getItem(spamKey);

                            if (!alreadySent) {
                                await logActivity(`Scheduling immediate notification for ${name} (trigger: ${t.days} days)`);
                                triggerDate = new Date(now.getTime() + 5000); // 5 sec delay
                                await AsyncStorage.setItem(spamKey, 'true');
                            } else {
                                await logActivity(`Skipping immediate notification for ${name} (already sent today)`);
                                continue;
                            }
                        }
                    }

                    if (triggerDate.getTime() > now.getTime()) {
                        await this.scheduleNotificationWithRetry(
                            `Vencimento de ${name}`,
                            t.msg,
                            triggerDate,
                            {
                                metadata: {
                                    category: 'recurrence',
                                    entityId: item.id,
                                    triggerKey: triggerTypeSuffix,
                                    userId,
                                }
                            }
                        );
                    }
                }

                // External Logging (Non-blocking)
                this.logToExternalService(userId, item, dueDate, 'due').catch(e =>
                    logActivity('External log failed', e)
                );

                // Cancellation Notifications
                if (item.cancellationDate) {
                    const cancelDate = parseDateOnly(item.cancellationDate);
                    if (!cancelDate) continue;
                    cancelDate.setHours(0, 0, 0, 0);

                    const cancelTriggers = [
                        { days: -2, msg: NotificationTemplates.cancellation[2](name) },
                        { days: -1, msg: NotificationTemplates.cancellation[1](name) },
                    ];

                    for (const t of cancelTriggers) {
                        let triggerDate = new Date(cancelDate);
                        triggerDate.setDate(cancelDate.getDate() + t.days);
                        triggerDate.setHours(10, 0, 0, 0);
                        const triggerKey = `cancel_day_${t.days}`;

                        // Apply same immediate logic for cancellation
                        const isTriggerToday = triggerDate.toDateString() === now.toDateString();

                        if (isTriggerToday && triggerDate.getTime() <= now.getTime()) {
                            const spamKey = `notified_${userId}_${item.id}_${now.toISOString().split('T')[0]}_${triggerKey}`;
                            const alreadySent = await AsyncStorage.getItem(spamKey);

                            if (!alreadySent) {
                                triggerDate = new Date(now.getTime() + 5000);
                                await AsyncStorage.setItem(spamKey, 'true');
                            } else {
                                continue;
                            }
                        }

                        if (triggerDate.getTime() > now.getTime()) {
                            await this.scheduleNotificationWithRetry(
                                `Cancelamento de ${name}`,
                                t.msg,
                                triggerDate,
                                {
                                    metadata: {
                                        category: 'recurrence',
                                        entityId: item.id,
                                        triggerKey,
                                        userId,
                                    }
                                }
                            );
                        }
                    }

                    this.logToExternalService(userId, item, cancelDate, 'cancellation').catch(e =>
                        logActivity('External log failed', e)
                    );
                }

            } catch (itemError) {
                await logActivity(`Error processing item ${item.id}`, itemError);
            }
        }
    },

    // Schedule App Plan Notifications
    async schedulePlanNotifications(plan: any, userId: string, options: ScheduleCategoryOptions = {}) {
        if (!getNotifications() || !userId) return;

        if (!options.skipCategoryCleanup) {
            await this.cancelNotificationsByCategory(['plan']);
        }

        if (!plan) return;

        const planStatus = String(plan.status || '').toLowerCase();
        const dueDate = parsePlanDueDate(plan);
        if (!dueDate) return;

        dueDate.setHours(0, 0, 0, 0);
        await logActivity(`Scheduling Plan Notifications for ${userId}`, { dueDate: dueDate.toISOString(), planStatus });

        const now = new Date();
        const todayKey = now.toISOString().split('T')[0];

        if (planStatus === 'past_due' || planStatus === 'expired') {
            const triggerKey = 'expired_immediate';
            const spamKey = `notified_plan_${userId}_${todayKey}_${triggerKey}`;
            const alreadySent = await AsyncStorage.getItem(spamKey);

            if (!alreadySent) {
                await this.scheduleNotificationWithRetry(
                    'Aviso de Assinatura',
                    NotificationTemplates.plan[0](),
                    new Date(now.getTime() + 5000),
                    {
                        metadata: {
                            category: 'plan',
                            entityId: plan.plan || 'controlar_plus',
                            triggerKey,
                            userId,
                        }
                    }
                );

                await AsyncStorage.setItem(spamKey, 'true');
                await this.logPlanToExternalService(userId, dueDate, triggerKey);
            }

            return;
        }

        if (planStatus !== 'active' && planStatus !== 'trial') return;

        const triggers = [
            { days: -7, msg: NotificationTemplates.plan[7](), triggerKey: 'due_day_-7' },
            { days: -3, msg: NotificationTemplates.plan[3](), triggerKey: 'due_day_-3' },
            { days: -1, msg: NotificationTemplates.plan[1](), triggerKey: 'due_day_-1' },
            { days: 0, msg: NotificationTemplates.plan[0](), triggerKey: 'due_today' },
            { days: 1, msg: NotificationTemplates.plan.deactivation(), triggerKey: 'deactivation_day_1' },
        ];

        for (const t of triggers) {
            let triggerDate = new Date(dueDate);
            triggerDate.setDate(dueDate.getDate() + t.days);
            triggerDate.setHours(10, 0, 0, 0); // 10 AM

            // Immediate check logic (same as recurrences)
            const isTriggerToday = triggerDate.toDateString() === now.toDateString();

            if (isTriggerToday && triggerDate.getTime() <= now.getTime()) {
                const spamKey = `notified_plan_${userId}_${todayKey}_${t.triggerKey}`;
                const alreadySent = await AsyncStorage.getItem(spamKey);

                if (!alreadySent) {
                    triggerDate = new Date(now.getTime() + 5000);
                    await AsyncStorage.setItem(spamKey, 'true');
                } else {
                    continue;
                }
            }

            if (triggerDate.getTime() > now.getTime()) {
                await this.scheduleNotificationWithRetry(
                    'Aviso de Assinatura',
                    t.msg,
                    triggerDate,
                    {
                        metadata: {
                            category: 'plan',
                            entityId: plan.plan || 'controlar_plus',
                            triggerKey: t.triggerKey,
                            userId,
                        }
                    }
                );

                await this.logPlanToExternalService(userId, dueDate, t.triggerKey);
            }
        }
    },

    // Schedule Credit Card Invoice Notifications
    async scheduleInvoiceNotifications(
        accounts: CreditCardAccount[],
        userId: string,
        preferences: InvoiceNotificationPreferences = DEFAULT_INVOICE_NOTIFICATION_PREFERENCES,
        options: ScheduleCategoryOptions = {}
    ) {
        if (!getNotifications() || !userId) return;

        if (!options.skipCategoryCleanup) {
            await this.cancelNotificationsByCategory(['invoice']);
        }

        if (!accounts || accounts.length === 0) return;

        await logActivity(`Processing ${accounts.length} credit cards for invoice notifications`);

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        for (const account of accounts) {
            try {
                // Determine Due Date
                // Priority: balanceDueDate > currentBill.dueDate > calculated
                let dueDateStr = account.balanceDueDate || account.currentBill?.dueDate;

                if (!dueDateStr) continue;

                const dueDate = parseDateOnly(dueDateStr);
                if (!dueDate) continue;
                dueDate.setHours(10, 0, 0, 0); // Standard time

                // Filter out old invoices (e.g. more than 5 days past due)
                const diffTime = dueDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < -5) continue; // Too old

                const name = account.name || 'Cartao';

                // Determine Amount
                let amountStr = '';
                if (preferences.showAmount) {
                    const amount = account.currentBill?.totalAmount || account.balance || 0;
                    if (amount > 0) {
                        amountStr = formatCurrency(amount);
                    }
                }

                const triggers = [
                    {
                        days: -preferences.daysBeforeDue,
                        msg: NotificationTemplates.invoice.due_soon(name, preferences.daysBeforeDue, amountStr),
                        suffix: `due_minus_${preferences.daysBeforeDue}`
                    },
                    {
                        days: 0,
                        msg: NotificationTemplates.invoice.due_today(name, amountStr),
                        suffix: 'due_today'
                    },
                    {
                        days: 1,
                        msg: NotificationTemplates.invoice.overdue(name),
                        suffix: 'overdue'
                    }
                ];

                for (const t of triggers) {
                    let triggerDate = new Date(dueDate);
                    triggerDate.setDate(dueDate.getDate() + t.days);
                    triggerDate.setHours(10, 0, 0, 0);

                    const isTriggerToday = triggerDate.toDateString() === now.toDateString();

                    if (isTriggerToday && triggerDate.getTime() <= Date.now()) {
                        // Immediate trigger check (Idempotency)
                        const spamKey = `notified_invoice_${userId}_${account.id}_${now.toISOString().split('T')[0]}_${t.suffix}`;
                        const alreadySent = await AsyncStorage.getItem(spamKey);

                        if (!alreadySent) {
                            await logActivity(`Scheduling immediate invoice notification for ${name} (${t.suffix})`);
                            triggerDate = new Date(Date.now() + 5000); // 5 sec delay
                            await AsyncStorage.setItem(spamKey, 'true');
                        } else {
                            continue;
                        }
                    }

                    if (triggerDate.getTime() > Date.now()) {
                        await this.scheduleNotificationWithRetry(
                            'Fatura do Cartao',
                            t.msg,
                            triggerDate,
                            {
                                metadata: {
                                    category: 'invoice',
                                    entityId: account.id,
                                    triggerKey: t.suffix,
                                    userId,
                                }
                            }
                        );
                    }
                }

                // External Logging
                this.logInvoiceToExternalService(userId, account, dueDate).catch(e =>
                    logActivity('External invoice log failed', e)
                );

            } catch (error) {
                await logActivity(`Error processing invoice for account ${account.id}`, error);
            }
        }
    },

    // Schedule Daily Sync Credits Reset Notification (Recurring)
    async scheduleDailySyncResetNotification() {
        const Notifications = getNotifications();
        if (!Notifications) return;

        // Ensure permissions are granted
        const hasPermission = await this.registerForPushNotificationsAsync();
        if (!hasPermission) {
            await logActivity('Skipping daily reset schedule: No permission');
            return;
        }

        // Check if already scheduled to avoid duplicates
        const alreadyScheduledKey = 'daily_sync_reset_scheduled_v1';
        const isScheduled = await AsyncStorage.getItem(alreadyScheduledKey);

        if (isScheduled) return;

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Creditos Renovados! ⚡',
                    body: NotificationTemplates.sync.daily_reset,
                    sound: true,
                    data: {
                        category: 'sync',
                        triggerKey: 'daily_reset',
                    },
                },
                trigger: {
                    type: 'daily',
                    hour: 0,
                    minute: 0,
                },
            });

            await AsyncStorage.setItem(alreadyScheduledKey, 'true');
            await logActivity('Scheduled daily sync reset notification');
        } catch (error) {
            await logActivity('Error scheduling daily sync reset', error);
        }
    },

    // Schedule Bank Availability Notification (One-time for next day)
    async scheduleBankAvailabilityNotification(bankName: string) {
        const Notifications = getNotifications();
        if (!Notifications) return;

        const hasPermission = await this.registerForPushNotificationsAsync();
        if (!hasPermission) return;

        try {
            // Schedule for tomorrow at 00:01
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 1, 0, 0);

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Sincronizacao Liberada 🔔',
                    body: NotificationTemplates.sync.bank_released(bankName),
                    sound: true,
                    data: {
                        category: 'sync',
                        entityId: bankName,
                        triggerKey: 'bank_released',
                    },
                },
                trigger: {
                    type: 'date',
                    date: tomorrow,
                },
            });

            await logActivity(`Scheduled bank availability notification for ${bankName}`);
        } catch (error) {
            await logActivity('Error scheduling bank availability', error);
        }
    },

    // ====================== SYNC CONNECTION NOTIFICATIONS ======================
    async sendSyncCompleteNotification(bankName: string, success: boolean, errorMessage?: string) {
        const Notifications = getNotifications();
        if (!Notifications) return;

        const hasPermission = await this.registerForPushNotificationsAsync();
        if (!hasPermission) return;

        try {
            const title = success
                ? `${bankName} conectado! ✅`
                : `Falha na conexão ❌`;
            const body = success
                ? NotificationTemplates.sync.connection_success(bankName)
                : NotificationTemplates.sync.connection_error(bankName, errorMessage);

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                    data: {
                        category: 'sync',
                        entityId: bankName,
                        triggerKey: success ? 'connection_success' : 'connection_error',
                    },
                },
                trigger: {
                    type: 'date',
                    date: new Date(Date.now() + 1500), // 1.5s delay
                },
            });

            await logActivity(`Sync notification sent: ${success ? 'success' : 'error'} for ${bankName}`);
        } catch (error) {
            await logActivity('Error sending sync notification', error);
        }
    },

    async disablePaymentAlerts() {
        await this.cancelNotificationsByCategory(PAYMENT_NOTIFICATION_CATEGORIES);
    },

    async reschedulePaymentAlerts(params: PaymentAlertRescheduleParams) {
        if (isRescheduling) {
            await logActivity('Reschedule skipped (already running)');
            return;
        }

        isRescheduling = true;

        try {
            const { userId } = params;
            if (!getNotifications() || !userId) return;

            const enabled = params.enabled ?? true;
            if (!enabled) {
                await this.disablePaymentAlerts();
                return;
            }

            const hasPermission = await this.registerForPushNotificationsAsync();
            if (!hasPermission) {
                await logActivity('Skipping payment alert reschedule: permission not granted');
                return;
            }

            let recurrences = params.recurrences;
            if (!recurrences) {
                const recurrencesResult = await databaseService.getRecurrences(userId);
                recurrences = (recurrencesResult.success && Array.isArray(recurrencesResult.data))
                    ? recurrencesResult.data
                    : [];
            }

            let accounts = params.accounts;
            if (!accounts) {
                const accountsResult = await databaseService.getAccounts(userId);
                const rawAccounts = (accountsResult.success && Array.isArray(accountsResult.data))
                    ? accountsResult.data
                    : [];
                accounts = mapAccountsForInvoiceAlerts(rawAccounts);
            }

            let plan = params.plan;
            if (!plan) {
                const subscriptionResult = await databaseService.getSubscription(userId);
                plan = subscriptionResult.success ? subscriptionResult.data : null;
            }

            const invoicePreferences = params.invoicePreferences || DEFAULT_INVOICE_NOTIFICATION_PREFERENCES;

            await this.scheduleRecurrenceNotifications(recurrences || [], userId);
            await this.scheduleInvoiceNotifications(accounts || [], userId, invoicePreferences);
            await this.schedulePlanNotifications(plan, userId);

            await logActivity('Payment alerts rescheduled successfully');
        } catch (error) {
            await logActivity('Error during reschedulePaymentAlerts', error);
        } finally {
            isRescheduling = false;
        }
    },

    async logInvoiceToExternalService(userId: string, account: CreditCardAccount, dueDate: Date) {
        const dateStr = dueDate.toISOString().split('T')[0];
        const logKey = `firebase_log_invoice_${userId}_${account.id}_${dateStr}`;
        const hasLogged = await AsyncStorage.getItem(logKey);

        if (!hasLogged) {
            await databaseService.logNotification(userId, {
                recurrenceId: account.id, // Reusing field for ID
                name: `Fatura ${account.name}`,
                dueDate: dateStr,
                type: 'invoice'
            });
            await AsyncStorage.setItem(logKey, 'true');
        }
    },

    async logPlanToExternalService(userId: string, dueDate: Date, triggerKey: string) {
        const dateStr = dueDate.toISOString().split('T')[0];
        const logKey = `firebase_log_plan_${userId}_${dateStr}_${triggerKey}`;
        const hasLogged = await AsyncStorage.getItem(logKey);

        if (!hasLogged) {
            await databaseService.logNotification(userId, {
                recurrenceId: `plan_${triggerKey}`,
                name: 'Plano Controlar+',
                dueDate: dateStr,
                type: 'plan'
            });
            await AsyncStorage.setItem(logKey, 'true');
        }
    },

    // Separated external logging to ensure isolation
    async logToExternalService(userId: string, item: RecurrenceItem, dateTarget: Date, type: 'due' | 'cancellation') {
        const cancellationDate = normalizeDateString(item.cancellationDate || null);
        const dateStr = type === 'due' ? dateTarget.toISOString().split('T')[0] : cancellationDate;
        if (!dateStr) return;

        const logKey = `firebase_log_${userId}_${item.id}_${dateStr}_${type}`;
        const hasLogged = await AsyncStorage.getItem(logKey);

        if (!hasLogged) {
            await databaseService.logNotification(userId, {
                recurrenceId: item.id,
                name: item.name,
                dueDate: dateStr,
                type: type
            });
            await AsyncStorage.setItem(logKey, 'true');
        }
    }
};
