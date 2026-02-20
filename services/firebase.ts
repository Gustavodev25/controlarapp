// Firebase Configuration for Controlar+ App
import { DashboardSnapshot, MonthlyAnalyticsSummary } from '@/types/optimization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import {
    Auth,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    getAuth,
    initializeAuth,
    inMemoryPersistence,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    User
} from 'firebase/auth';
import {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    Firestore,
    getDoc,
    getDocs,
    getFirestore,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import { getConnectorLogoUrl } from '../utils/connectorLogo';
import { isNonInstallmentMerchant } from './installmentRules';
import { offlineStorage } from './offlineStorage';
import { offlineSync } from './offlineSync';
declare const __DEV__: boolean;

type FirebaseAuthModuleWithRnPersistence = {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => any;
};

const normalizeConnectorForStorage = (connector: any) => {
    if (!connector) return null;

    const connectorObject = typeof connector === 'object'
        ? connector
        : { id: connector };

    return {
        ...connectorObject,
        id: connectorObject.id ?? null,
        name: connectorObject.name ?? null,
        primaryColor: connectorObject.primaryColor ?? null,
        imageUrl: getConnectorLogoUrl(connectorObject)
    };
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trial', 'trialing']);

const normalizeSubscriptionStatus = (status: any): string => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized || normalized === '-') return '';
    if (normalized === 'canceled') return 'cancelled';
    if (normalized === 'trial_expired' || normalized === 'trial-expired') return 'expired';
    return normalized;
};

const normalizeSubscriptionPlan = (plan: any): string => {
    const normalized = String(plan || '').trim().toLowerCase();
    return normalized || '';
};

const inferMissingSubscriptionStatus = (subscription: any, normalizedPlan: string): string => {
    if (!subscription || typeof subscription !== 'object') return '';

    if (subscription.cancelledAt || subscription.cancellationDate || subscription.cancelReason) {
        return 'cancelled';
    }

    if (normalizedPlan === 'pro' || normalizedPlan === 'premium') {
        return 'active';
    }

    return '';
};

const parseComparableDate = (value: any): number => {
    if (!value) return 0;

    if (typeof value?.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date?.getTime?.()) ? 0 : date.getTime();
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? 0 : value.getTime();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const asString = String(value).trim();
    if (!asString) return 0;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(asString)) {
        const [dd, mm, yyyy] = asString.split('/').map(Number);
        const parsed = new Date(yyyy, mm - 1, dd);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }

    const parsed = new Date(asString);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const getSubscriptionCompletenessScore = (subscription: any): number => {
    if (!subscription || typeof subscription !== 'object') return -1;

    let score = 0;
    const plan = normalizeSubscriptionPlan(subscription.plan);
    const status = normalizeSubscriptionStatus(subscription.status);

    if (plan) score += 4;
    if (status) score += 3;
    if (ACTIVE_SUBSCRIPTION_STATUSES.has(status)) score += 3;

    if (
        subscription.nextBillingDate ||
        subscription.renewalDate ||
        subscription.expiresAt ||
        subscription.trialEndsAt
    ) {
        score += 3;
    }

    if (subscription.startedAt || subscription.startDate || subscription.createdAt) score += 1;
    if (subscription.updatedAt || subscription.lastUpdatedAt) score += 1;
    if (subscription.billingCycle) score += 1;
    if (typeof subscription.price === 'number' && Number.isFinite(subscription.price)) score += 1;
    if (subscription.subscriptionId || subscription.customerId) score += 1;

    return score;
};

const mergeSubscriptions = (primary: any, fallback: any) => {
    if (!primary && !fallback) return null;

    const merged = {
        ...(fallback && typeof fallback === 'object' ? fallback : {}),
        ...(primary && typeof primary === 'object' ? primary : {}),
    };

    const primaryPlan = normalizeSubscriptionPlan(primary?.plan);
    const fallbackPlan = normalizeSubscriptionPlan(fallback?.plan);
    const normalizedPlan = primaryPlan || fallbackPlan;
    if (normalizedPlan) {
        merged.plan = normalizedPlan;
    } else {
        delete merged.plan;
    }

    const primaryStatus = normalizeSubscriptionStatus(primary?.status);
    const fallbackStatus = normalizeSubscriptionStatus(fallback?.status);
    const inferredPrimaryStatus = inferMissingSubscriptionStatus(primary, normalizedPlan);
    const inferredFallbackStatus = inferMissingSubscriptionStatus(fallback, normalizedPlan);
    const normalizedStatus = primaryStatus || fallbackStatus || inferredPrimaryStatus || inferredFallbackStatus;
    if (normalizedStatus) {
        merged.status = normalizedStatus;
    } else {
        delete merged.status;
    }

    return merged;
};

const resolveUserSubscription = (userData: Record<string, any> | undefined | null) => {
    if (!userData) return null;

    const rootSub = userData.subscription;
    const profileSub = userData.profile?.subscription;

    if (!rootSub && !profileSub) return null;
    if (rootSub && !profileSub) return mergeSubscriptions(rootSub, null);
    if (!rootSub && profileSub) return mergeSubscriptions(profileSub, null);

    const rootScore = getSubscriptionCompletenessScore(rootSub);
    const profileScore = getSubscriptionCompletenessScore(profileSub);

    if (profileScore > rootScore) {
        return mergeSubscriptions(profileSub, rootSub);
    }

    if (rootScore > profileScore) {
        return mergeSubscriptions(rootSub, profileSub);
    }

    const rootUpdatedAt = parseComparableDate(rootSub?.updatedAt || rootSub?.lastUpdatedAt);
    const profileUpdatedAt = parseComparableDate(profileSub?.updatedAt || profileSub?.lastUpdatedAt);

    if (profileUpdatedAt > rootUpdatedAt) {
        return mergeSubscriptions(profileSub, rootSub);
    }

    if (rootUpdatedAt > profileUpdatedAt) {
        return mergeSubscriptions(rootSub, profileSub);
    }

    const rootStatus = normalizeSubscriptionStatus(rootSub?.status);
    const profileStatus = normalizeSubscriptionStatus(profileSub?.status);
    const rootIsActive = ACTIVE_SUBSCRIPTION_STATUSES.has(rootStatus);
    const profileIsActive = ACTIVE_SUBSCRIPTION_STATUSES.has(profileStatus);

    if (profileIsActive && !rootIsActive) {
        return mergeSubscriptions(profileSub, rootSub);
    }

    return mergeSubscriptions(rootSub, profileSub);
};


// Firebase Configuration - Shared with web app
const firebaseConfig = {
    apiKey: "AIzaSyBGhm5J90b4fVlhmyP7bhVPliQZmQUSmmo",
    authDomain: "financeiro-609e1.firebaseapp.com",
    databaseURL: "https://financeiro-609e1-default-rtdb.firebaseio.com",
    projectId: "financeiro-609e1",
    storageBucket: "financeiro-609e1.firebasestorage.app",
    messagingSenderId: "412536649666",
    appId: "1:412536649666:web:f630c5be490c5539f1485b",
    measurementId: "G-QSH7W2GYXD"
};

// Initialize Firebase - singleton pattern
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);

    const getReactNativePersistence = (FirebaseAuth as FirebaseAuthModuleWithRnPersistence).getReactNativePersistence;
    if (typeof getReactNativePersistence === 'function') {
        auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage)
        });
    } else {
        auth = initializeAuth(app, {
            persistence: inMemoryPersistence
        });
        if (__DEV__) {
            console.warn('[Firebase] React Native persistence unavailable. Using in-memory auth persistence.');
        }
    }

    db = getFirestore(app);
} else {
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
}

export { app, auth, db };
export type { User };

// ===== Authentication Service =====

export const authService = {
    // Sign in with email and password
    signIn: async (email: string, password: string) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error: any) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    },

    // Create new account
    signUp: async (email: string, password: string) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error: any) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    },

    // Sign out
    signOut: async () => {
        try {
            await firebaseSignOut(auth);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Reset password
    resetPassword: async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    },

    // Get current user
    getCurrentUser: () => auth.currentUser,

    // Subscribe to auth state changes
    onAuthStateChange: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, callback);
    }
};

// Helper function to get user-friendly error messages
function getAuthErrorMessage(code: string): string {
    switch (code) {
        case 'auth/invalid-email':
            return 'E-mail inválido.';
        case 'auth/user-disabled':
            return 'Esta conta foi desativada.';
        case 'auth/user-not-found':
            return 'Usuário não encontrado.';
        case 'auth/wrong-password':
            return 'Senha incorreta.';
        case 'auth/invalid-credential':
            return 'E-mail ou senha incorretos.';
        case 'auth/email-already-in-use':
            return 'Este e-mail já está em uso.';
        case 'auth/weak-password':
            return 'A senha deve ter pelo menos 6 caracteres.';
        case 'auth/too-many-requests':
            return 'Muitas tentativas. Tente novamente mais tarde.';
        case 'auth/network-request-failed':
            return 'Erro de conexão. Verifique sua internet.';
        default:
            return 'Ocorreu um erro. Tente novamente.';
    }
}

// ===== Database Service =====

export const databaseService = {
    // Get user profile
    // IMPORTANT: Subscription and paymentMethod can be stored at root level OR inside profile
    getUserProfile: async (userId: string) => {
        try {
            const docRef = doc(db, 'users', userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as Record<string, any>;
                const profile = { ...(data.profile || {}) } as Record<string, any>;
                const mergedData: Record<string, any> = { ...data, ...profile };



                // IMPORTANT: subscription can be stored at root level (for family members)
                // or inside profile. Resolve by completeness/recency and merge missing fields.
                mergedData.subscription = resolveUserSubscription(data);

                // PaymentMethod: check root, then profile.paymentMethod, then profile.paymentMethodDetails
                mergedData.paymentMethod = data.paymentMethod || data.profile?.paymentMethod || data.profile?.paymentMethodDetails || null;




                // Keep root-level financial/preference sources as canonical to avoid stale nested shadowing.
                if (data.financial !== undefined) {
                    mergedData.financial = data.financial;
                }
                if (data.preferences !== undefined) {
                    mergedData.preferences = data.preferences;
                }

                // Legacy salary fields can be duplicated at root and inside profile.
                // Prefer root values when they exist.
                const legacyFinancialKeys = [
                    'baseSalary',
                    'salaryPaymentDay',
                    'salaryExemptFromDiscounts',
                    'salaryAdvanceDay',
                    'salaryAdvancePercent',
                    'salaryAdvanceValue'
                ];
                for (const key of legacyFinancialKeys) {
                    if (data[key] !== undefined) {
                        mergedData[key] = data[key];
                    }
                }

                // Cache for offline use
                offlineStorage.saveProfile(userId, mergedData);
                return { success: true, data: mergedData };
            } else {
                return { success: false, error: 'Perfil não encontrado' };
            }
        } catch (error: any) {
            // OFFLINE FALLBACK: Return cached profile
            const cached = await offlineStorage.getProfile(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached profile');
                return { success: true, data: cached };
            }
            return { success: false, error: error.message };
        }
    },

    // Create or update user profile
    setUserProfile: async (userId: string, data: any) => {
        try {
            const docRef = doc(db, 'users', userId);
            await setDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            }, { merge: true });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Update specific fields inside preferences without overwriting others
    // Uses Firestore dot notation for safe partial updates
    updatePreference: async (userId: string, fields: Record<string, any>) => {
        try {
            const docRef = doc(db, 'users', userId);
            const dotNotation: Record<string, any> = {};
            for (const [key, value] of Object.entries(fields)) {
                dotNotation[`preferences.${key}`] = value;
            }
            dotNotation['updatedAt'] = Timestamp.now();
            await updateDoc(docRef, dotNotation);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Internal helper to update monthly aggregates
    updateMonthlyAggregates: async (userId: string, date: string, updates: Partial<MonthlyAnalyticsSummary>) => {
        try {
            const monthKey = date.substring(0, 7); // YYYY-MM
            const docRef = doc(db, 'users', userId, 'analytics_monthly', monthKey);

            // Use setDoc with merge to ensure document exists
            await setDoc(docRef, {
                monthKey,
                ...updates,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('[Firebase] Error updating aggregates:', error);
            // Non-blocking error
        }
    },

    // Get Dashboard Snapshot (Aggregated Data)
    getDashboardSnapshot: async (userId: string, monthKey: string): Promise<{ success: boolean; data?: DashboardSnapshot; error?: string }> => {
        try {
            const analyticsRef = doc(db, 'users', userId, 'analytics_monthly', monthKey);
            const analyticsSnap = await getDoc(analyticsRef);

            let analytics: MonthlyAnalyticsSummary | null = null;
            if (analyticsSnap.exists()) {
                analytics = analyticsSnap.data() as MonthlyAnalyticsSummary;
            }

            const accountsResult = await databaseService.getAccounts(userId);
            let accountBalance = 0;
            if (accountsResult.success && accountsResult.data) {
                const bankAccounts = accountsResult.data.filter((acc: any) =>
                    acc.subtype === 'CHECKING_ACCOUNT'
                );
                accountBalance = bankAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
            }

            const snapshot = {
                monthKey,
                analytics,
                accountBalance,
                isStale: false
            };

            // Cache for offline use
            offlineStorage.saveDashboardSnapshot(userId, monthKey, snapshot);

            return { success: true, data: snapshot };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getDashboardSnapshot(userId, monthKey);
            if (cached) {
                console.log('[Firebase] Offline - returning cached dashboard snapshot');
                return { success: true, data: { ...cached, isStale: true } };
            }
            return { success: false, error: error.message };
        }
    },

    // Get user transactions
    getTransactions: async (userId: string, limitCount: number = 50) => {
        try {
            const transactionsRef = collection(db, 'users', userId, 'transactions');
            const q = query(
                transactionsRef,
                orderBy('date', 'desc'),
                limit(limitCount)
            );
            const querySnapshot = await getDocs(q);

            const transactions = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache for offline use
            offlineStorage.saveTransactions(userId, transactions);
            return { success: true, data: transactions };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getTransactions(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached transactions');
                return { success: true, data: cached };
            }
            return { success: false, error: error.message };
        }
    },

    // Add transaction
    addTransaction: async (userId: string, transaction: any) => {
        try {
            const transactionsRef = collection(db, 'users', userId, 'transactions');
            const newDocRef = doc(transactionsRef);

            await setDoc(newDocRef, {
                ...transaction,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });

            // Update Aggregates
            if (transaction.type === 'expense' || transaction.type === 'income') {
                const isExpense = transaction.type === 'expense';
                const amount = Number(transaction.amount);

                await databaseService.updateMonthlyAggregates(userId, transaction.date, {
                    checkingIncome: isExpense ? 0 : increment(amount) as any,
                    checkingExpense: isExpense ? increment(amount) as any : 0,
                    checkingCount: increment(1) as any,
                    categoryTotals: {
                        [transaction.category || 'Outros']: increment(amount)
                    } as any
                });
            }

            return { success: true, id: newDocRef.id };
        } catch (error: any) {
            // OFFLINE: Queue for later sync
            if (!offlineSync.isOnline) {
                const opId = await offlineSync.queueOperation('add', 'transactions', userId, transaction);
                // Optimistic: add to local cache
                const cached = await offlineStorage.getTransactions(userId);
                if (cached) {
                    const tempId = `offline_${Date.now()}`;
                    cached.unshift({ ...transaction, id: tempId, _pendingSync: true });
                    await offlineStorage.saveTransactions(userId, cached);
                }
                return { success: true, id: `pending_${opId}` };
            }
            return { success: false, error: error.message };
        }
    },

    // Update transaction
    updateTransaction: async (userId: string, transactionId: string, data: any) => {
        try {
            const docRef = doc(db, 'users', userId, 'transactions', transactionId);

            // 1. Read old data for aggregation delta
            const oldDoc = await getDoc(docRef);
            let oldData: any = null;
            if (oldDoc.exists()) {
                oldData = oldDoc.data();
            }

            // 2. Update the transaction
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            });

            // 3. Update monthly aggregates (Delta)
            if (oldData && (oldData.type === 'income' || oldData.type === 'expense')) {
                const isSameMonth = data.date ? data.date.substring(0, 7) === oldData.date.substring(0, 7) : true;

                if (isSameMonth) {
                    const monthDate = data.date || oldData.date;
                    const oldAmount = Number(oldData.amount);
                    const newAmount = Number(data.amount !== undefined ? data.amount : oldData.amount);
                    const diff = newAmount - oldAmount;

                    if (diff !== 0) {
                        const isExpense = (data.type || oldData.type) === 'expense';

                        await databaseService.updateMonthlyAggregates(userId, monthDate, {
                            checkingIncome: isExpense ? 0 : increment(diff) as any,
                            checkingExpense: isExpense ? increment(diff) as any : 0,
                            categoryTotals: {
                                [data.category || oldData.category || 'Outros']: increment(diff)
                            } as any
                        });
                    }
                }
            }

            // Update local cache
            const cached = await offlineStorage.getTransactions(userId);
            if (cached) {
                const idx = cached.findIndex((t: any) => t.id === transactionId);
                if (idx !== -1) {
                    cached[idx] = { ...cached[idx], ...data };
                    await offlineStorage.saveTransactions(userId, cached);
                }
            }

            return { success: true };
        } catch (error: any) {
            // OFFLINE: Queue for later sync
            if (!offlineSync.isOnline) {
                await offlineSync.queueOperation('update', 'transactions', userId, data, transactionId);
                // Optimistic update in cache
                const cached = await offlineStorage.getTransactions(userId);
                if (cached) {
                    const idx = cached.findIndex((t: any) => t.id === transactionId);
                    if (idx !== -1) {
                        cached[idx] = { ...cached[idx], ...data, _pendingSync: true };
                        await offlineStorage.saveTransactions(userId, cached);
                    }
                }
                return { success: true };
            }
            return { success: false, error: error.message };
        }
    },

    // Delete transaction
    deleteTransaction: async (userId: string, transactionId: string) => {
        try {
            const docRef = doc(db, 'users', userId, 'transactions', transactionId);

            // 1. Read document BEFORE deleting to get values for aggregation
            const docSnap = await getDoc(docRef);
            let transactionData: any = null;
            if (docSnap.exists()) {
                transactionData = docSnap.data();
            }

            // 2. Delete the document
            await deleteDoc(docRef);

            // 3. Decrement Aggregates
            if (transactionData && (transactionData.type === 'expense' || transactionData.type === 'income')) {
                const isExpense = transactionData.type === 'expense';
                const amount = Number(transactionData.amount);

                await databaseService.updateMonthlyAggregates(userId, transactionData.date, {
                    checkingIncome: isExpense ? 0 : increment(-amount) as any,
                    checkingExpense: isExpense ? increment(-amount) as any : 0,
                    checkingCount: increment(-1) as any,
                    categoryTotals: {
                        [transactionData.category || 'Outros']: increment(-amount)
                    } as any
                });
            }

            // Remove from local cache
            const cached = await offlineStorage.getTransactions(userId);
            if (cached) {
                await offlineStorage.saveTransactions(userId, cached.filter((t: any) => t.id !== transactionId));
            }

            return { success: true };
        } catch (error: any) {
            // OFFLINE: Queue for later sync
            if (!offlineSync.isOnline) {
                await offlineSync.queueOperation('delete', 'transactions', userId, undefined, transactionId);
                // Optimistic delete from cache
                const cached = await offlineStorage.getTransactions(userId);
                if (cached) {
                    await offlineStorage.saveTransactions(userId, cached.filter((t: any) => t.id !== transactionId));
                }
                return { success: true };
            }
            return { success: false, error: error.message };
        }
    },

    // Get user accounts (bank accounts, credit cards)
    getAccounts: async (userId: string) => {
        try {
            const accountsRef = collection(db, 'users', userId, 'accounts');
            const querySnapshot = await getDocs(accountsRef);

            const accounts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache for offline use
            offlineStorage.saveAccounts(userId, accounts);
            return { success: true, data: accounts };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getAccounts(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached accounts');
                return { success: true, data: cached };
            }
            return { success: false, error: error.message };
        }
    },

    // Delete user account
    deleteAccount: async (userId: string, accountId: string) => {
        try {
            const docRef = doc(db, 'users', userId, 'accounts', accountId);
            await deleteDoc(docRef);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Update specific fields of an account
    updateAccount: async (userId: string, accountId: string, data: any) => {
        console.log('[Firebase] updateAccount chamado:', { userId, accountId, data });
        try {
            const docRef = doc(db, 'users', userId, 'accounts', accountId);
            console.log('[Firebase] Referência do documento:', docRef.path);
            
            const updateData = {
                ...data,
                updatedAt: Timestamp.now()
            };
            console.log('[Firebase] Dados a atualizar:', updateData);
            
            await updateDoc(docRef, updateData);
            console.log('[Firebase] Documento atualizado com sucesso!');
            
            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Erro ao atualizar conta:', error);
            console.error('[Firebase] Detalhes do erro:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            return { success: false, error: error.message };
        }
    },

    // Save account from Pluggy (Open Finance)
    saveAccount: async (userId: string, accountData: any, connector?: any) => {
        try {
            // Use Pluggy account ID as document ID for consistency
            const accountId = accountData.id;
            const docRef = doc(db, 'users', userId, 'accounts', accountId);
            const effectiveConnector = accountData.connector ?? connector ?? null;
            const normalizedConnector = normalizeConnectorForStorage(effectiveConnector);

            // Find current/latest bill from bills array (if available)
            let currentBill = null;
            if (accountData.bills && accountData.bills.length > 0) {
                const now = new Date();
                // Sort bills by dueDate descending
                const sortedBills = [...accountData.bills].sort((a, b) =>
                    new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
                );

                // Find the first bill with dueDate >= today (current open bill)
                currentBill = sortedBills.find(bill => new Date(bill.dueDate) >= now);

                // If no future bill found, use the most recent one
                if (!currentBill && sortedBills.length > 0) {
                    currentBill = sortedBills[0];
                }


            }

            // Map Pluggy account to our account structure
            const accountDoc = {
                // Basic info
                id: accountId,
                name: accountData.name || normalizedConnector?.name || 'Conta',
                type: accountData.type === 'CREDIT' ? 'credit' : 'checking',
                subtype: accountData.subtype || null,
                number: accountData.number || null,

                // Balance info
                balance: accountData.balance ?? 0,
                currencyCode: accountData.currencyCode || 'BRL',

                // Credit card specific
                creditLimit: accountData.creditData?.creditLimit ?? null,
                availableCreditLimit: accountData.creditData?.availableCreditLimit ?? null,
                // Datas de fechamento e vencimento do creditData
                balanceCloseDate: accountData.creditData?.balanceCloseDate ?? null,
                balanceDueDate: accountData.creditData?.balanceDueDate ?? null,

                // Bills (faturas) do Pluggy - dados da fatura atual
                currentBill: currentBill ? {
                    id: currentBill.id ?? null,
                    dueDate: currentBill.dueDate ? currentBill.dueDate.split('T')[0] : null,
                    // Try to get closing date from 'date' (Pluggy standard) or 'closeDate'
                    closeDate: currentBill.date ? currentBill.date.split('T')[0] : (currentBill.closeDate ? currentBill.closeDate.split('T')[0] : null),
                    // IMPORTANTE: periodStart e periodEnd são usados pelo invoiceBuilder para cálculo preciso
                    periodStart: currentBill.periodStart ? currentBill.periodStart.split('T')[0] : null,
                    periodEnd: currentBill.periodEnd ? currentBill.periodEnd.split('T')[0] : null,
                    totalAmount: currentBill.totalAmount ?? null,
                    minimumPaymentAmount: currentBill.minimumPaymentAmount ?? null,
                    allowsInstallments: currentBill.allowsInstallments ?? null,
                } : null,
                // Array de todas as bills para histórico
                bills: accountData.bills ? accountData.bills.map((bill: any) => ({
                    id: bill.id ?? null,
                    dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : null,
                    closeDate: bill.date ? bill.date.split('T')[0] : (bill.closeDate ? bill.closeDate.split('T')[0] : null),
                    periodStart: bill.periodStart ? bill.periodStart.split('T')[0] : null,
                    periodEnd: bill.periodEnd ? bill.periodEnd.split('T')[0] : null,
                    totalAmount: bill.totalAmount ?? null,
                    minimumPaymentAmount: bill.minimumPaymentAmount ?? null,
                })) : null,

                // Pluggy/Open Finance metadata
                source: 'pluggy',
                pluggyItemId: accountData.itemId || null,
                connector: normalizedConnector,

                // Timestamps
                lastSyncedAt: new Date().toISOString(),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await setDoc(docRef, accountDoc, { merge: true });

            return { success: true, id: accountId };
        } catch (error: any) {
            console.error('[Firebase] Error saving account:', error);
            return { success: false, error: error.message };
        }
    },

    // Get user categories
    getCategories: async (userId: string) => {
        try {
            const categoriesRef = collection(db, 'users', userId, 'categories');
            const querySnapshot = await getDocs(categoriesRef);

            const categories = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache for offline use
            offlineStorage.saveCategories(userId, categories);
            return { success: true, data: categories };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getCategories(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached categories');
                return { success: true, data: cached };
            }
            return { success: false, error: error.message };
        }
    },

    // Get user subscription
    // IMPORTANT: Subscription can be at root OR inside profile
    getSubscription: async (userId: string) => {
        try {
            const docRef = doc(db, 'users', userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const subscription = resolveUserSubscription(data as Record<string, any>);
                // Cache for offline use
                offlineStorage.saveSubscription(userId, subscription);
                return { success: true, data: subscription };
            }
            return { success: true, data: null };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getSubscription(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached subscription');
                return { success: true, data: cached };
            }
            return { success: false, error: error.message };
        }
    },

    // Get full subscription data including payment methods
    // IMPORTANT: Data can be at root OR inside profile, check both
    getFullSubscription: async (userId: string) => {
        try {
            const docRef = doc(db, 'users', userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                const subscription = resolveUserSubscription(data as Record<string, any>);
                const paymentMethod = data.paymentMethod || data.profile?.paymentMethod || data.profile?.paymentMethodDetails || null;

                const result = {
                    subscription,
                    paymentMethod,
                    _rawData: data,
                };

                // Cache for offline use
                offlineStorage.saveFullSubscription(userId, result);

                return { success: true, data: result };
            }
            return { success: true, data: { subscription: null, paymentMethod: null } };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getFullSubscription(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached full subscription');
                return { success: true, data: cached };
            }
            console.error('[Firebase] Error getting subscription:', error);
            return { success: false, error: error.message };
        }
    },

    // Get payment history from multiple possible sources
    getPaymentHistory: async (userId: string, limitCount: number = 10) => {
        try {
            // Source 1: Try subcollection 'payments'
            let payments: any[] = [];
            try {
                const paymentsRef = collection(db, 'users', userId, 'payments');
                const q = query(
                    paymentsRef,
                    orderBy('createdAt', 'desc'),
                    limit(limitCount)
                );
                const querySnapshot = await getDocs(q);
                payments = querySnapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                }));
            } catch (subErr: any) {

            }

            // Source 2: Check inside user document for payment history arrays
            if (payments.length === 0) {
                try {
                    const userDocRef = doc(db, 'users', userId);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();

                        const historyArray =
                            data.paymentHistory ||
                            data.payments ||
                            data.profile?.paymentHistory ||
                            data.profile?.payments ||
                            data.subscription?.paymentHistory ||
                            data.subscription?.payments ||
                            null;

                        if (Array.isArray(historyArray) && historyArray.length > 0) {
                            payments = historyArray
                                .map((item: any, index: number) => ({
                                    id: item.id || `payment_${index}`,
                                    amount: item.amount || item.value || item.price || 0,
                                    status: item.status || 'paid',
                                    createdAt: item.createdAt || item.date || item.paidAt || item.paymentDate || null,
                                    paymentMethod: item.paymentMethod || null,
                                    invoiceUrl: item.invoiceUrl || item.receiptUrl || null,
                                    description: item.description || null,
                                    ...item,
                                }))
                                .sort((a: any, b: any) => {
                                    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                    return dateB - dateA;
                                })
                                .slice(0, limitCount);
                        }
                    }
                } catch (docErr: any) {

                }
            }

            // Cache for offline use
            offlineStorage.savePaymentHistory(userId, payments);
            return { success: true, data: payments };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getPaymentHistory(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached payment history');
                return { success: true, data: cached };
            }
            console.error('[Firebase] Error getting payment history:', error);
            return { success: false, error: error.message, data: [] };
        }
    },

    // Save invoice view mode preference
    saveInvoiceViewMode: async (userId: string, mode: string) => {
        try {
            const docRef = doc(db, 'users', userId);
            await setDoc(docRef, {
                dashboardPreferences: {
                    invoiceViewMode: mode
                },
                updatedAt: Timestamp.now()
            }, { merge: true });
            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Error saving invoice view mode:', error);
            return { success: false, error: error.message };
        }
    },

    // Save Open Finance transaction (checking account) to 'transactions' collection
    saveOpenFinanceTransaction: async (userId: string, transaction: any, accountInfo?: any) => {
        try {
            // Use Pluggy transaction ID as document ID to avoid duplicates
            const transactionId = transaction.id;
            const docRef = doc(db, 'users', userId, 'transactions', transactionId);

            // Map Pluggy transaction to our transaction structure
            const transactionDoc = {
                id: transactionId,
                description: transaction.description || transaction.descriptionRaw || 'Transação',
                amount: Math.abs(transaction.amount || 0),
                type: (transaction.amount || 0) >= 0 ? 'income' : 'expense',
                date: transaction.date || new Date().toISOString(),
                category: transaction.category || null,
                categoryId: transaction.categoryId || null,

                // Account reference
                accountId: transaction.accountId || accountInfo?.id || null,
                accountName: accountInfo?.name || null,

                // Source metadata
                source: 'openfinance',
                pluggyTransactionId: transactionId,
                pluggyAccountId: transaction.accountId || null,

                // Additional Pluggy data
                currencyCode: transaction.currencyCode || 'BRL',
                merchant: transaction.merchant || null,
                paymentMethod: transaction.paymentData?.paymentMethod || null,

                // Connector info
                connector: normalizeConnectorForStorage(accountInfo?.connector),

                // Timestamps
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                syncedAt: new Date().toISOString()
            };

            // Check if transaction already exists to avoid double counting in aggregates
            const existingDoc = await getDoc(docRef);
            const isNew = !existingDoc.exists();

            await setDoc(docRef, transactionDoc, { merge: true });

            // Update Aggregates for Open Finance
            if (isNew && (transactionDoc.type === 'expense' || transactionDoc.type === 'income')) {
                const isExpense = transactionDoc.type === 'expense';
                const amount = Number(transactionDoc.amount);

                await databaseService.updateMonthlyAggregates(userId, transactionDoc.date, {
                    checkingIncome: isExpense ? 0 : increment(amount) as any,
                    checkingExpense: isExpense ? increment(amount) as any : 0,
                    checkingCount: increment(1) as any,
                    categoryTotals: {
                        [transactionDoc.category || 'Outros']: increment(amount)
                    } as any
                });
            }

            return { success: true, id: transactionId };
        } catch (error: any) {
            console.error('[Firebase] Error saving open finance transaction:', error);
            return { success: false, error: error.message };
        }
    },

    // Save Open Finance credit card transaction to 'creditCardTransactions' collection
    // Format matches exactly what the web app saves
    saveOpenFinanceCreditCardTransaction: async (userId: string, transaction: any, accountInfo?: any) => {
        try {
            // Use Pluggy transaction ID as document ID to avoid duplicates
            const transactionId = transaction.id;
            const docRef = doc(db, 'users', userId, 'creditCardTransactions', transactionId);

            // Extract date in YYYY-MM-DD format (same as web)
            const transactionDate = transaction.date
                ? transaction.date.split('T')[0]
                : new Date().toISOString().split('T')[0];

            const description = transaction.description || transaction.descriptionRaw || 'Transação';
            const ignoreInstallments = isNonInstallmentMerchant(description);
            const installmentNumber = ignoreInstallments
                ? 1
                : (transaction.creditCardMetadata?.installmentNumber || 1);
            const totalInstallments = ignoreInstallments
                ? 1
                : (transaction.creditCardMetadata?.totalInstallments || 1);

            // Calculate invoice month key from billId date or transaction date
            // Web uses format "YYYY-MM"
            const invoiceMonthKey = (() => {
                // Try to get from creditCardMetadata.billId date context
                // Default to transaction month
                const [year, month] = transactionDate.split('-');
                return `${year}-${month}`;
            })();

            // Map Pluggy transaction to credit card transaction structure
            // This format is IDENTICAL to what the web app saves
            const transactionDoc = {
                // Core transaction fields (same as web)
                amount: Math.abs(transaction.amount || 0),
                cardId: transaction.accountId || accountInfo?.id || null,
                category: transaction.category || null,
                date: transactionDate,
                description: description,
                installmentNumber: installmentNumber,
                invoiceMonthKey: invoiceMonthKey,
                invoiceMonthKeyManual: false,
                isRefund: transaction.isRefund || false,
                originalTransactionId: transaction.originalTransactionId || null,

                // Complete Pluggy raw data (same as web)
                pluggyRaw: {
                    accountId: transaction.accountId || null,
                    acquirerData: transaction.acquirerData ?? null,
                    amount: transaction.amount || 0,
                    amountInAccountCurrency: transaction.amountInAccountCurrency ?? null,
                    balance: transaction.balance ?? null,
                    category: transaction.category || null,
                    categoryId: transaction.categoryId || null,
                    createdAt: transaction.createdAt || new Date().toISOString(),
                    creditCardMetadata: transaction.creditCardMetadata ? {
                        billId: transaction.creditCardMetadata.billId ?? null,
                        cardNumber: transaction.creditCardMetadata.cardNumber ?? null,
                        payeeMCC: transaction.creditCardMetadata.payeeMCC ?? null,
                    } : null,
                    currencyCode: transaction.currencyCode || 'BRL',
                    date: transaction.date || new Date().toISOString(),
                    description: transaction.description || null,
                    descriptionRaw: transaction.descriptionRaw || null,
                    id: transactionId,
                    merchant: transaction.merchant ?? null,
                    operationType: transaction.operationType ?? null,
                    order: transaction.order ?? 0,
                    paymentData: transaction.paymentData ?? null,
                    providerCode: transaction.providerCode ?? null,
                    providerId: transaction.providerId || null,
                    status: transaction.status || 'POSTED',
                    type: transaction.type || 'DEBIT',
                    updatedAt: transaction.updatedAt || new Date().toISOString(),
                },

                status: 'completed',
                totalInstallments: totalInstallments,
                type: (transaction.amount || 0) >= 0 ? 'income' : 'expense',
            };

            // Check if transaction already exists
            const existingDoc = await getDoc(docRef);
            const isNew = !existingDoc.exists();

            await setDoc(docRef, transactionDoc, { merge: true });

            // Update Aggregates for Credit Card
            // Determine invoice month for aggregation
            // Update Aggregates ONLY if it's a new transaction
            if (isNew) {
                // Credit card expenses are aggregated by their invoice month usually, 
                // OR by their purchase date?
                // For "Spending this month", we usually look at purchase date.
                // But for "Invoice total", we look at invoice month.
                // The `MonthlyAnalyticsSummary` has `creditTotal`.
                // Let's aggregate by Purchase Date for "Spending" and maintain a separate "Invoice" aggregate if needed.
                // Actually, the requirement says "aggregados mensais... creditTotal, creditByCard".
                // creditTotal usually means Total Invoice Amount for that month?
                // If `analytics_monthly` is by Month Key (YYYY-MM), 
                // `creditTotal` inside `2024-02` should probably be "Invoices Due in Feb" or "Purchases in Feb"?
                // Visualizing Dashboard: "Expenses" chart.
                // Usually shows "Spending in February".
                // So we should aggregate by `transactionDate`.

                const amount = Number(transactionDoc.amount);
                // Credit card is usually expense
                await databaseService.updateMonthlyAggregates(userId, transactionDate, {
                    creditTotal: increment(amount) as any,
                    creditCount: increment(1) as any,
                    creditByCard: {
                        [transactionDoc.cardId || 'unknown']: {
                            total: increment(amount),
                            count: increment(1)
                        }
                    } as any,
                    categoryTotals: {
                        [transactionDoc.category || 'Outros']: increment(amount)
                    } as any
                });
            }

            return { success: true, id: transactionId };
        } catch (error: any) {
            console.error('[Firebase] Error saving credit card transaction:', error);
            return { success: false, error: error.message };
        }
    },

    // Delete Open Finance credit card transaction
    deleteOpenFinanceCreditCardTransaction: async (userId: string, transactionId: string) => {
        try {
            const docRef = doc(db, 'users', userId, 'creditCardTransactions', transactionId);
            await deleteDoc(docRef);
            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Error deleting credit card transaction:', error);
            return { success: false, error: error.message };
        }
    },

    // Update Open Finance credit card transaction (partial update)
    updateCreditCardTransaction: async (userId: string, transactionId: string, data: any) => {
        try {
            const docRef = doc(db, 'users', userId, 'creditCardTransactions', transactionId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Error updating credit card transaction:', error);
            return { success: false, error: error.message };
        }
    },

    // Batch save Open Finance transactions - routes to correct collection based on account type
    // Para conta corrente: filtra apenas PIX, transferências e compras com débito
    saveOpenFinanceTransactions: async (
        userId: string,
        accounts: any[],
        connector?: any
    ) => {
        try {
            let savedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;
            const results = {
                checkingTransactions: 0,
                creditCardTransactions: 0,
                savingsAccountTransactions: 0,
                skippedTransactionTypes: 0,
                errors: [] as string[]
            };

            // Tipos de operação permitidos para conta corrente
            // PIX, TED, DOC, Transferência mesma instituição e Cartão (débito)
            const ALLOWED_CHECKING_OPERATIONS = [
                'PIX',
                'TED',
                'DOC',
                'TRANSFERENCIA_MESMA_INSTITUICAO',
                'CARTAO', // Compra com débito
            ];

            // Função para verificar se transação é relevante para conta corrente
            const isRelevantCheckingTransaction = (tx: any): boolean => {
                const operationType = tx.operationType?.toUpperCase();
                const paymentMethod = tx.paymentData?.paymentMethod?.toUpperCase();

                // Verifica pelo operationType (principal)
                if (operationType && ALLOWED_CHECKING_OPERATIONS.includes(operationType)) {
                    return true;
                }

                // Fallback: verifica pelo paymentMethod (PIX, TED)
                if (paymentMethod && ['PIX', 'TED', 'DOC'].includes(paymentMethod)) {
                    return true;
                }

                // Fallback: verifica se descrição contém indicadores
                const description = (tx.description || tx.descriptionRaw || '').toUpperCase();
                if (description.includes('PIX') ||
                    description.includes('TED') ||
                    description.includes('DOC') ||
                    description.includes('TRANSF') ||
                    description.includes('DÉBITO') ||
                    description.includes('DEBITO')) {
                    return true;
                }

                return false;
            };

            for (const account of accounts) {
                const transactions = account.transactions || [];
                const isCreditCard = account.type === 'CREDIT';
                const isSavingsAccount = account.subtype === 'SAVINGS_ACCOUNT';
                const effectiveConnector = account.connector ?? connector ?? null;
                const normalizedConnector = normalizeConnectorForStorage(effectiveConnector);

                // Processar conta poupança como Caixinha
                if (isSavingsAccount) {
                    try {
                        // 1. Criar/Atualizar caixinha a partir da conta poupança
                        await databaseService.syncSavingsAccountAsInvestment(userId, account, effectiveConnector);

                        // 2. Salvar transações da poupança no histórico da caixinha
                        if (transactions.length > 0) {
                            const txResult = await databaseService.saveSavingsAccountTransactions(
                                userId,
                                account.id,
                                transactions
                            );
                            savedCount += txResult.savedCount || 0;
                            skippedCount += txResult.skippedCount || 0;
                        }

                        results.savingsAccountTransactions = (results.savingsAccountTransactions || 0) + transactions.length;
                    } catch (savingsError: any) {
                        console.error('[Firebase] Error processing savings account:', savingsError);
                        results.errors.push(`Savings ${account.id}: ${savingsError.message}`);
                    }
                    continue;
                }

                // Prepare account info for transaction context
                const accountInfo = {
                    id: account.id,
                    name: account.name || normalizedConnector?.name,
                    number: account.number,
                    creditData: account.creditData,
                    connector: normalizedConnector
                };

                for (const tx of transactions) {
                    try {
                        if (isCreditCard) {
                            // Cartão de crédito: salva todas as transações
                            await databaseService.saveOpenFinanceCreditCardTransaction(userId, tx, accountInfo);
                            results.creditCardTransactions++;
                            savedCount++;
                        } else {
                            // Conta corrente: filtra apenas PIX, transferências e débito
                            if (isRelevantCheckingTransaction(tx)) {
                                await databaseService.saveOpenFinanceTransaction(userId, tx, accountInfo);
                                results.checkingTransactions++;
                                savedCount++;
                            } else {
                                results.skippedTransactionTypes++;
                                skippedCount++;

                            }
                        }
                    } catch (error: any) {
                        errorCount++;
                        results.errors.push(`Transaction ${tx.id}: ${error.message}`);
                    }
                }
            }


            return {
                success: true,
                savedCount,
                skippedCount,
                errorCount,
                details: results
            };
        } catch (error: any) {
            console.error('[Firebase] Error batch saving transactions:', error);
            return { success: false, error: error.message };
        }
    },

    // ===== Sync Credits System =====
    // Users get 3 credits per day, reset at midnight (00:00)
    // 1 credit = 1 connection OR 1 sync
    // Sync button available once per day (resets at midnight)

    // Get the current date string in YYYY-MM-DD format (user's local timezone)
    _getTodayDateString: () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Get user's sync credits info
    // Now supports per-bank sync tracking via syncedItems map
    getSyncCredits: async (userId: string) => {
        try {
            const docRef = doc(db, 'users', userId);
            const docSnap = await getDoc(docRef);

            const today = databaseService._getTodayDateString();

            if (docSnap.exists()) {
                const data = docSnap.data();
                const syncCredits = data.syncCredits || {};
                const isAdmin = data.isAdmin === true || data.profile?.isAdmin === true;

                // Admin users are unlimited for Open Finance actions.
                if (isAdmin) {
                    return {
                        success: true,
                        data: {
                            credits: Math.max(syncCredits.credits ?? 3, 3),
                            lastResetDate: syncCredits.lastResetDate || today,
                            lastSyncDate: syncCredits.lastSyncDate || null,
                            syncedItems: syncCredits.syncedItems || {},
                            canSync: true,
                            isAdmin: true,
                            unlimited: true,
                        }
                    };
                }

                // Check if credits need to be reset (new day)
                if (syncCredits.lastResetDate !== today) {
                    // Reset credits for new day - also clear syncedItems for new day
                    const newCredits = {
                        credits: 3,
                        lastResetDate: today,
                        lastSyncDate: null, // Reset global sync date
                        syncedItems: {}, // Clear per-bank sync tracking for new day
                    };
                    await databaseService.setUserProfile(userId, { syncCredits: newCredits });
                    return {
                        success: true,
                        data: {
                            credits: 3,
                            lastResetDate: today,
                            lastSyncDate: null,
                            syncedItems: {},
                            canSync: true, // Global flag for backwards compatibility
                            isAdmin: false,
                            unlimited: false,
                        }
                    };
                }

                const creditsData = {
                    credits: syncCredits.credits ?? 3,
                    lastResetDate: syncCredits.lastResetDate || today,
                    lastSyncDate: syncCredits.lastSyncDate || null,
                    syncedItems: syncCredits.syncedItems || {},
                    canSync: true,
                    isAdmin: false,
                    unlimited: false,
                };
                // Cache for offline use
                offlineStorage.saveSyncCredits(userId, creditsData);
                return {
                    success: true,
                    data: creditsData
                };
            }

            // New user - initialize with 3 credits
            const initialCredits = {
                credits: 3,
                lastResetDate: today,
                lastSyncDate: null,
                syncedItems: {},
            };
            await databaseService.setUserProfile(userId, { syncCredits: initialCredits });
            return {
                success: true,
                data: {
                    credits: 3,
                    lastResetDate: today,
                    lastSyncDate: null,
                    syncedItems: {},
                    canSync: true,
                    isAdmin: false,
                    unlimited: false,
                }
            };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getSyncCredits(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached sync credits');
                return { success: true, data: cached };
            }
            console.error('[Firebase] Error getting sync credits:', error);
            return { success: false, error: error.message };
        }
    },

    // Check if user has available credits
    hasSyncCredits: async (userId: string) => {
        const result = await databaseService.getSyncCredits(userId);
        if (!result.success) return false;
        if (result.data?.unlimited) return true;
        return (result.data?.credits ?? 0) > 0;
    },

    // Check if sync button is available today (global - backwards compatibility)
    canSyncToday: async (userId: string) => {
        // Now always returns true - actual check is done per itemId
        return true;
    },

    // Check if a specific bank (itemId) can sync today
    canSyncItem: async (userId: string, itemId: string) => {
        const result = await databaseService.getSyncCredits(userId);
        if (!result.success || !result.data) return true;
        if (result.data.unlimited) return true;

        const syncedItems = result.data.syncedItems || {};
        const today = databaseService._getTodayDateString();

        // If this itemId was synced today, return false
        return syncedItems[itemId] !== today;
    },

    // Check if an item was synced today (sync return)
    wasItemSyncedToday: (syncedItems: { [key: string]: string } | undefined, itemId: string) => {
        if (!syncedItems || !itemId) return false;
        const today = databaseService._getTodayDateString();
        return syncedItems[itemId] === today;
    },

    // Consume 1 credit (for connection or sync)
    // Now accepts optional itemId for per-bank sync tracking
    consumeSyncCredit: async (userId: string, action: 'connect' | 'sync', itemId?: string) => {

        try {
            const creditsResult = await databaseService.getSyncCredits(userId);


            if (!creditsResult.success || !creditsResult.data) {
                console.error('[Firebase] Failed to get credits');
                return { success: false, error: 'Não foi possível verificar os créditos' };
            }

            const currentCredits = creditsResult.data.credits;
            const currentSyncedItems = creditsResult.data.syncedItems || {};
            if (creditsResult.data.unlimited) {
                return {
                    success: true,
                    remainingCredits: currentCredits,
                    action,
                    itemId,
                    unlimited: true
                };
            }


            if (currentCredits <= 0) {
                console.warn('[Firebase] No credits available');
                return { success: false, error: 'Você não tem créditos suficientes. Aguarde até meia-noite para renovar.' };
            }

            const today = databaseService._getTodayDateString();

            // For sync action with itemId, check if this specific bank was already synced today
            if (action === 'sync' && itemId && currentSyncedItems[itemId] === today) {
                console.warn(`[Firebase] Bank ${itemId} already synced today`);
                return { success: false, error: 'Este banco já foi sincronizado hoje. Tente novamente amanhã.' };
            }

            // Update credits and syncedItems
            const newSyncedItems = { ...currentSyncedItems };
            if (action === 'sync' && itemId) {
                newSyncedItems[itemId] = today;
            }

            const updateData: any = {
                syncCredits: {
                    credits: currentCredits - 1,
                    lastResetDate: today,
                    lastSyncDate: action === 'sync' ? today : creditsResult.data.lastSyncDate,
                    syncedItems: newSyncedItems,
                }
            };

            await databaseService.setUserProfile(userId, updateData);


            return {
                success: true,
                remainingCredits: currentCredits - 1,
                action,
                itemId
            };
        } catch (error: any) {
            console.error('[Firebase] Error consuming sync credit:', error);
            return { success: false, error: error.message };
        }
    },

    // Get time until next reset (for UI display)
    getTimeUntilReset: () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const diffMs = tomorrow.getTime() - now.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return { hours, minutes, formatted: `${hours}h ${minutes}m` };
    },

    // ===== Recurrences (Subscriptions & Reminders) =====

    // Get user recurrences
    getRecurrences: async (userId: string) => {
        try {
            // 0. Get blacklist of deleted virtual items
            const blacklistRef = collection(db, 'users', userId, 'recurrence_blacklist');
            const blacklistSnap = await getDocs(blacklistRef);
            const blacklistedIds = new Set(blacklistSnap.docs.map(doc => doc.data().recurrenceId));

            // 1. Get manual recurrences (new collection)
            const recurrencesRef = collection(db, 'users', userId, 'recurrences');
            const qRec = query(recurrencesRef, orderBy('dueDate', 'asc'));
            const recSnap = await getDocs(qRec);
            const manualItems = recSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 2. Get items from 'subscriptions' collection (if exists)
            // 2. Get items from 'subscriptions' collection (if exists)
            const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
            const subsSnap = await getDocs(subscriptionsRef);
            const existingSubs = subsSnap.docs.map(doc => {
                const data = doc.data();
                const currentMonth = new Date().toISOString().slice(0, 7);
                const isPaid = ((data.status && data.status.toLowerCase() === 'paid') || data.paid === true) ||
                    (data.paidMonths && Array.isArray(data.paidMonths) && data.paidMonths.includes(currentMonth));

                return {
                    id: doc.id,
                    name: data.name || data.title || data.description || data.serviceName || 'Assinatura',
                    amount: Number(data.amount || data.value || data.price || 0),
                    dueDate: data.dueDate || data.date || data.nextPaymentDate || new Date().toISOString(),
                    type: 'subscription',
                    status: isPaid ? 'paid' : 'pending',
                    frequency: data.frequency || data.cycle || 'monthly',
                    category: data.category || 'Assinaturas',
                    paidMonths: data.paidMonths || []
                };
            });

            // 2.1 Get items from 'reminders' collection (if exists)
            const remindersRef = collection(db, 'users', userId, 'reminders');
            const remSnap = await getDocs(remindersRef);
            const existingReminders = remSnap.docs.map(doc => {
                const data = doc.data();
                const rawDate = data.dueDate || data.date || new Date().toISOString();

                // Logic updated to trust DB date (Simplified Flow)
                // No more smart projection to current month for reminders

                return {
                    id: doc.id,
                    name: data.name || data.title || data.description || 'Lembrete',
                    amount: Number(data.amount || data.value || 0),
                    dueDate: rawDate.split('T')[0],
                    type: 'reminder',
                    status: ((data.status && data.status.toLowerCase() === 'paid') || data.paid === true) ? 'paid' : 'pending',
                    frequency: data.frequency || data.cycle || data.recurrence || 'monthly',
                    category: data.category || 'Lembretes',
                    logo: data.logo || data.icon || null,
                    cancellationDate: data.cancellationDate || null,
                    paidMonths: data.paidMonths || [],
                    transactionType: data.type === 'income' ? 'income' : 'expense'
                };
            });

            // 3. Auto-detect from Credit Card Transactions
            const subKeywords = [
                'netflix', 'spotify', 'apple', 'icloud', 'amazon prime', 'prime video',
                'disney', 'hbo', 'star+', 'globoplay', 'youtube', 'adobe', 'canva',
                'smartfit', 'chatgpt', 'openai', 'midjourney', 'google storage'
            ];

            const ccRef = collection(db, 'users', userId, 'creditCardTransactions');
            const qCC = query(ccRef, orderBy('date', 'desc'), limit(150));
            const ccSnap = await getDocs(qCC);

            const detectedSubs: any[] = [];
            // Create set of normalized names from existing sources to avoid duplicates
            const existingNames = new Set([
                ...manualItems.map((i: any) => (i.name || '').toLowerCase()),
                ...existingSubs.map((i: any) => (i.name || '').toLowerCase())
            ]);

            ccSnap.docs.forEach(doc => {
                const data = doc.data();
                const desc = (data.description || '').toLowerCase();
                const match = subKeywords.find(k => desc.includes(k));

                if (match) {
                    // Check partial match
                    const alreadyExists = Array.from(existingNames).some(name => name.includes(match) || match.includes(name));

                    if (!alreadyExists) {
                        existingNames.add(match); // prevent adding same detected sub twice

                        // Calculate next due date
                        const lastDate = new Date(data.date);
                        const nextDue = new Date(lastDate);
                        nextDue.setMonth(nextDue.getMonth() + 1);

                        // Simple logic to ensure date is future or current month
                        const now = new Date();
                        if (nextDue < now) {
                            nextDue.setMonth(now.getMonth());
                            if (nextDue < now) nextDue.setMonth(now.getMonth() + 1);
                        }

                        detectedSubs.push({
                            id: `auto_${doc.id}`,
                            name: data.description,
                            amount: Math.abs(data.amount),
                            dueDate: nextDue.toISOString().split('T')[0],
                            type: 'subscription',
                            status: 'pending',
                            frequency: 'monthly',
                            isAuto: true
                        });
                    }
                }
            });

            // 4. Reminders from Future Transactions (Checking Account)
            const today = new Date().toISOString().split('T')[0];
            const txRef = collection(db, 'users', userId, 'transactions');
            const qTx = query(txRef, where('date', '>', today), orderBy('date', 'asc'));
            const txSnap = await getDocs(qTx);

            const reminders = txSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((data: any) => data.type !== 'income') // Exclude income (refunds/deposits)
                .map((data: any) => ({
                    id: `tx_${data.id}`,
                    name: data.description,
                    amount: Math.abs(data.amount),
                    dueDate: data.date.split('T')[0],
                    type: 'reminder',
                    status: 'pending',
                    frequency: 'monthly',
                    isAuto: true
                }));

            // 5. Reminders from Credit Card Bills
            const accountsRef = collection(db, 'users', userId, 'accounts');
            const accSnap = await getDocs(accountsRef);
            const billReminders: any[] = [];

            accSnap.docs.forEach(doc => {
                const acc = doc.data();
                // Include credit card bills
                if (acc.type === 'credit' && acc.currentBill) {
                    const dueDateStr = acc.currentBill.dueDate;
                    if (dueDateStr) {
                        billReminders.push({
                            id: `bill_${acc.id}`,
                            name: `Fatura ${acc.name}`,
                            amount: acc.currentBill.totalAmount || 0,
                            dueDate: dueDateStr,
                            type: 'reminder',
                            status: 'pending',
                            frequency: 'monthly',
                            isBill: true
                        });
                    }
                }
            });

            // 6. Filter out blacklisted items
            const allItems = [...manualItems, ...existingSubs, ...existingReminders, ...detectedSubs, ...reminders, ...billReminders];
            const filteredItems = allItems.filter(item => !blacklistedIds.has(item.id));

            // Cache for offline use
            offlineStorage.saveRecurrences(userId, filteredItems);

            return {
                success: true,
                data: filteredItems
            };

        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getRecurrences(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached recurrences');
                return { success: true, data: cached };
            }
            console.error('[Firebase] Error getting recurrences:', error);
            return { success: false, error: error.message };
        }
    },

    // Add new recurrence
    addRecurrence: async (userId: string, recurrence: any) => {
        try {
            // Determine collection based on type to match web app
            const collectionName = recurrence.type === 'subscription' ? 'subscriptions' : 'reminders';

            const collectionRef = collection(db, 'users', userId, collectionName);
            const newDocRef = doc(collectionRef);

            // Prepare data compatible with Web App (which likely expects title, date, value, type='expense')
            let dataToSave: any;

            // Lógica Específica para Lembretes (Estrutura Web)
            if (recurrence.type === 'reminder') {
                dataToSave = {
                    amount: Number(recurrence.amount),
                    category: recurrence.category || 'Outros',
                    description: recurrence.name, // O App manda 'name', o Web usa 'description'
                    dueDate: recurrence.dueDate,
                    frequency: recurrence.frequency,
                    isRecurring: recurrence.frequency && recurrence.frequency !== 'once',
                    memberId: userId, // Web usa memberId
                    type: recurrence.transactionType || 'expense', // Respect selected type, default to expense
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };
            } else {
                // Mantém lógica antiga para Assinaturas (com campos de compatibilidade)
                dataToSave = {
                    ...recurrence,
                    title: recurrence.name,
                    description: recurrence.name,
                    amount: Number(recurrence.amount),
                    value: Number(recurrence.amount),
                    price: Number(recurrence.amount),
                    dueDate: recurrence.dueDate, // YYYY-MM-DD
                    date: recurrence.dueDate,
                    userId: userId,
                    ownerId: userId,
                    category: recurrence.category || 'Outros',
                    status: 'pending', // or 'active'
                    isRecurrence: true,
                    recurrence: recurrence.frequency, // Duplicate frequency info
                    type: 'subscription',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };
            }

            await setDoc(newDocRef, dataToSave);

            return { success: true, id: newDocRef.id };
        } catch (error: any) {
            console.error('[Firebase] Error adding recurrence:', error);
            return { success: false, error: error.message };
        }
    },

    // Update recurrence
    // Update recurrence
    updateRecurrence: async (userId: string, recurrenceId: string, data: any, type: 'subscription' | 'reminder' = 'subscription') => {
        try {
            const collectionName = type === 'subscription' ? 'subscriptions' : 'reminders';
            const docRef = doc(db, 'users', userId, collectionName, recurrenceId);

            // Sync status and paid boolean for compatibility with Web App
            const updateData = { ...data };
            if (updateData.status) {
                updateData.paid = updateData.status === 'paid';
            }
            // If paid is explicitly passed, ensure status matches
            if (updateData.paid !== undefined) {
                updateData.status = updateData.paid ? 'paid' : 'pending';
            }

            await updateDoc(docRef, {
                ...updateData,
                updatedAt: Timestamp.now()
            });
            return { success: true };
        } catch (error: any) {
            // Fallback to 'recurrences' if not found? No, let's stick to the new structure.
            console.error('[Firebase] Error updating recurrence:', error);
            return { success: false, error: error.message };
        }
    },

    // Process payment for recurrence (Add Transaction + Update Recurrence)
    payRecurrence: async (userId: string, item: any) => {
        try {
            // Check for virtual items (auto-detected, future transactions, or bills)
            // If virtual, materialize them into real documents first
            let recurrenceId = item.id;
            const isVirtual = item.id.startsWith('auto_') || item.id.startsWith('tx_') || item.id.startsWith('bill_');

            if (isVirtual) {
                const collectionName = item.type === 'subscription' ? 'subscriptions' : 'reminders';
                const colRef = collection(db, 'users', userId, collectionName);
                const newDocRef = doc(colRef);

                const newData = {
                    name: item.name,
                    amount: Number(item.amount),
                    dueDate: item.dueDate,
                    category: item.category || (item.type === 'subscription' ? 'Assinaturas' : 'Lembretes'),
                    type: item.type,
                    status: 'pending', // Will be updated to paid below
                    frequency: item.frequency || 'monthly',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    paidMonths: [],
                    transactionType: item.transactionType || 'expense',
                    isAuto: false // Materialized
                };

                await setDoc(newDocRef, newData);
                recurrenceId = newDocRef.id;
            }

            // Lógica simplificada para Lembretes (Não cria transação)
            if (item.type === 'reminder') {
                // 1. Atualizar o item ATUAL para pago (Manter histórico)
                const itemRef = doc(db, 'users', userId, 'reminders', recurrenceId);
                await updateDoc(itemRef, {
                    status: 'paid',
                    paid: true, // Compatibilidade
                    updatedAt: Timestamp.now()
                });

                const isRecurring = item.frequency && item.frequency !== 'once';

                if (isRecurring) {
                    // 2. Se recorrente: Criar um NOVO item para o próximo mês
                    const [year, month, day] = (item.dueDate || new Date().toISOString().split('T')[0]).split('-').map(Number);
                    const currentDate = new Date(year, month - 1, day);

                    const nextDate = new Date(currentDate);
                    if (item.frequency === 'yearly') {
                        nextDate.setFullYear(nextDate.getFullYear() + 1);
                    } else {
                        // Default: Monthly
                        nextDate.setMonth(nextDate.getMonth() + 1);
                    }

                    const nextDateStr = nextDate.toISOString().split('T')[0];

                    // Criar novo documento duplicado
                    const remindersRef = collection(db, 'users', userId, 'reminders');
                    const newDocRef = doc(remindersRef);

                    await setDoc(newDocRef, {
                        amount: Number(item.amount),
                        category: item.category || 'Lembretes',
                        description: item.name,
                        dueDate: nextDateStr,
                        frequency: item.frequency,
                        isRecurring: true,
                        memberId: userId,
                        type: item.transactionType || 'expense', // Propagate the original type
                        status: 'pending',
                        previousRecurrenceId: recurrenceId, // Link to previous recurrence (materialized)
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                }

                return { success: true };
            }

            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];

            // Use the ITEM's due date for the period context
            const itemDate = item.dueDate || dateStr;
            const itemMonth = itemDate.slice(0, 7); // YYYY-MM

            // 1. Create Transaction (Expense)
            const transactionRef = collection(db, 'users', userId, 'transactions');
            const newTxRef = doc(transactionRef);
            await setDoc(newTxRef, {
                description: item.name,
                amount: Number(item.amount),
                date: dateStr, // Transaction date is ALWAYS today
                category: item.category || (item.type === 'subscription' ? 'Assinatura' : 'Lembrete'),
                type: item.transactionType || 'expense', // Use item type if available
                transactionType: item.transactionType || 'expense', // Compatibility with Web App
                status: 'completed',
                accountId: null,
                accountType: 'CHECKING_ACCOUNT',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                relatedRecurrenceId: recurrenceId
            });

            // 2. Update Recurrence Item (Unified for both types)
            const collectionName = item.type === 'subscription' ? 'subscriptions' : 'reminders';
            const itemRef = doc(db, 'users', userId, collectionName, recurrenceId);

            // Add to paidMonths using arrayUnion - DO NOT change dueDate
            await updateDoc(itemRef, {
                status: 'paid', // Atualizar status para sincronizar com web
                paid: true, // Compatibilidade
                paidMonths: arrayUnion(itemMonth),
                lastPaymentDate: Timestamp.now(), // Compatibility with Web App
                updatedAt: Timestamp.now()
            });

            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    // Revert payment for recurrence (Delete Transaction + Revert Recurrence)
    unpayRecurrence: async (userId: string, item: any) => {
        try {
            // 0. If Reminder, delete the forward-generated recurrence
            if (item.type === 'reminder') {
                const remindersRef = collection(db, 'users', userId, 'reminders');
                const qNext = query(remindersRef, where('previousRecurrenceId', '==', item.id));
                const snapNext = await getDocs(qNext);

                if (!snapNext.empty) {
                    await Promise.all(snapNext.docs.map(d => deleteDoc(d.ref)));
                }
            }

            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];

            // 1. Delete Transaction
            const transactionRef = collection(db, 'users', userId, 'transactions');
            // Remove orderBy to avoid composite index requirement
            const q = query(
                transactionRef,
                where('relatedRecurrenceId', '==', item.id)
            );

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                // Find the most recent transaction in memory
                const txDoc = snapshot.docs.sort((a, b) => {
                    const dateA = a.data().createdAt?.toMillis() || 0;
                    const dateB = b.data().createdAt?.toMillis() || 0;
                    return dateB - dateA; // Descending
                })[0];

                await deleteDoc(txDoc.ref);
            }

            // 2. Update Recurrence Item (Unified)
            const collectionName = item.type === 'subscription' ? 'subscriptions' : 'reminders';
            const itemRef = doc(db, 'users', userId, collectionName, item.id);

            // Use the Month from the ITEM's due date (which reflects the period we are unpaying)
            const itemDate = item.dueDate || dateStr;
            const itemMonth = itemDate.slice(0, 7); // YYYY-MM

            await updateDoc(itemRef, {
                paidMonths: arrayRemove(itemMonth),
                status: 'pending',
                paid: false,
                updatedAt: Timestamp.now()
            });

            return { success: true };
        } catch (e: any) {
            console.error('[Firebase] Error unpaying recurrence:', e);
            return { success: false, error: e.message };
        }
    },

    // Delete recurrence
    // Delete recurrence
    deleteRecurrence: async (userId: string, recurrenceId: string, type: 'subscription' | 'reminder' = 'subscription') => {
        try {
            // Check if this is a virtual item (auto-detected, future transaction, or bill)
            const isVirtual = recurrenceId.startsWith('auto_') || recurrenceId.startsWith('tx_') || recurrenceId.startsWith('bill_');

            if (isVirtual) {
                // Virtual items don't exist in Firebase, they're generated dynamically
                // To "delete" them, we need to add them to a blacklist
                const blacklistRef = collection(db, 'users', userId, 'recurrence_blacklist');
                const blacklistDocRef = doc(blacklistRef, recurrenceId);

                await setDoc(blacklistDocRef, {
                    recurrenceId: recurrenceId,
                    type: type,
                    deletedAt: Timestamp.now()
                });

                return { success: true };
            }

            // For real documents, delete normally
            const collectionName = type === 'subscription' ? 'subscriptions' : 'reminders';
            const docRef = doc(db, 'users', userId, collectionName, recurrenceId);
            await deleteDoc(docRef);
            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Error deleting recurrence:', error);
            return { success: false, error: error.message };
        }
    },

    // Log Notification Schedule
    logNotification: async (userId: string, data: { recurrenceId: string, name: string, dueDate: string, type: 'due' | 'cancellation' | 'invoice' | 'plan' }) => {
        try {
            // Create a deterministic ID to avoid duplicates
            // ID format: recurrenceId_dueDate_type
            const safeDate = data.dueDate.replace(/\//g, '-');
            const docId = `${data.recurrenceId}_${safeDate}_${data.type}`;

            const docRef = doc(db, 'users', userId, 'notification_logs', docId);

            await setDoc(docRef, {
                ...data,
                status: 'scheduled',
                lastScheduledAt: Timestamp.now(),
                userId: userId
            }, { merge: true }); // Merge to update timestamp if rescheduled

            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Error logging notification:', error);
            // Don't block flow if logging fails
            return { success: false, error: error.message };
        }
    },

    // ===== Investments (Caixinhas) =====

    // Get investments
    getInvestments: async (userId: string) => {
        try {
            const investmentsRef = collection(db, 'users', userId, 'investments');
            const q = query(investmentsRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const investments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache for offline use
            offlineStorage.saveInvestments(userId, investments);
            return { success: true, data: investments };
        } catch (error: any) {
            // OFFLINE FALLBACK
            const cached = await offlineStorage.getInvestments(userId);
            if (cached) {
                console.log('[Firebase] Offline - returning cached investments');
                return { success: true, data: cached };
            }
            console.error('[Firebase] Error getting investments:', error);
            return { success: false, error: error.message };
        }
    },

    // Add investment
    addInvestment: async (userId: string, investment: any) => {
        try {
            const investmentsRef = collection(db, 'users', userId, 'investments');
            const newDocRef = doc(investmentsRef);

            await setDoc(newDocRef, {
                ...investment,
                createdAt: investment.createdAt || new Date().toISOString().split('T')[0],
                currentAmount: Number(investment.currentAmount || 0),
                targetAmount: Number(investment.targetAmount || 0),
                updatedAt: Timestamp.now()
            });

            return { success: true, id: newDocRef.id };
        } catch (error: any) {
            console.error('[Firebase] Error adding investment:', error);
            return { success: false, error: error.message };
        }
    },

    // Update investment
    updateInvestment: async (userId: string, investmentId: string, data: any) => {
        try {
            const docRef = doc(db, 'users', userId, 'investments', investmentId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: Timestamp.now()
            });
            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Error updating investment:', error);
            return { success: false, error: error.message };
        }
    },

    // Add investment transaction (history)
    addInvestmentTransaction: async (userId: string, investmentId: string, transaction: { amount: number, type: 'deposit' | 'withdraw', date: string }) => {
        try {
            const historyRef = collection(db, 'users', userId, 'investments', investmentId, 'history');
            const newDocRef = doc(historyRef);

            await setDoc(newDocRef, {
                ...transaction,
                createdAt: Timestamp.now()
            });

            return { success: true, id: newDocRef.id };
        } catch (error: any) {
            console.error('[Firebase] Error adding investment transaction:', error);
            return { success: false, error: error.message };
        }
    },

    // Get investment transactions (history)
    // Para poupanças, busca também da coleção de transações
    getInvestmentTransactions: async (userId: string, investmentId: string) => {
        try {
            let transactions: any[] = [];

            // Se é uma poupança (id começa com savings_), buscar transações da conta
            if (investmentId.startsWith('savings_')) {
                const accountId = investmentId.replace('savings_', '');
                console.log('[Firebase] Buscando transações para poupança:', accountId);

                // Buscar do histórico do investment (se existir)
                try {
                    const historyRef = collection(db, 'users', userId, 'investments', investmentId, 'history');
                    const qHistory = query(historyRef, orderBy('createdAt', 'desc'));
                    const historySnapshot = await getDocs(qHistory);

                    const historyTransactions = historySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log('[Firebase] Transações do histórico:', historyTransactions.length);
                    transactions = [...historyTransactions];
                } catch (historyError) {
                    console.log('[Firebase] Sem histórico de investment ainda');
                }

                // Buscar também da coleção de transações (usando accountId)
                try {
                    const transactionsRef = collection(db, 'users', userId, 'transactions');
                    const qTx = query(transactionsRef, where('accountId', '==', accountId), limit(100));
                    const txSnapshot = await getDocs(qTx);
                    console.log('[Firebase] Transações com accountId:', txSnapshot.size);

                    const accountTransactions = txSnapshot.docs.map(doc => {
                        const data = doc.data();
                        const amount = Number(data.amount ?? 0);
                        return {
                            id: doc.id,
                            amount: Math.abs(amount),
                            type: amount >= 0 ? 'deposit' : 'withdraw',
                            date: data.date || data.createdAt,
                            description: data.description || data.descriptionRaw || null,
                            source: 'pluggy',
                            createdAt: data.createdAt
                        };
                    });

                    // Evitar duplicatas
                    const existingIds = new Set(transactions.map((t: any) => t.pluggyTransactionId || t.id));
                    const uniqueAccountTx = accountTransactions.filter(t => !existingIds.has(t.id));
                    transactions = [...transactions, ...uniqueAccountTx];
                } catch (txError) {
                    console.log('[Firebase] Erro ao buscar transações:', txError);
                }

                // Buscar também da coleção de transações (usando pluggyAccountId como fallback)
                try {
                    const transactionsRef = collection(db, 'users', userId, 'transactions');
                    const qTx2 = query(transactionsRef, where('pluggyAccountId', '==', accountId), limit(100));
                    const txSnapshot2 = await getDocs(qTx2);
                    console.log('[Firebase] Transações com pluggyAccountId:', txSnapshot2.size);

                    const accountTransactions2 = txSnapshot2.docs.map(doc => {
                        const data = doc.data();
                        const amount = Number(data.amount ?? 0);
                        return {
                            id: doc.id,
                            amount: Math.abs(amount),
                            type: amount >= 0 ? 'deposit' : 'withdraw',
                            date: data.date || data.createdAt,
                            description: data.description || data.descriptionRaw || null,
                            source: 'pluggy',
                            createdAt: data.createdAt
                        };
                    });

                    // Evitar duplicatas
                    const existingIds = new Set(transactions.map((t: any) => t.id));
                    const uniqueAccountTx = accountTransactions2.filter(t => !existingIds.has(t.id));
                    transactions = [...transactions, ...uniqueAccountTx];
                } catch (txError) {
                    console.log('[Firebase] Erro ao buscar por pluggyAccountId:', txError);
                }

                console.log('[Firebase] Total de transações encontradas:', transactions.length);

                // Ordenar por data/createdAt
                transactions.sort((a, b) => {
                    const getTime = (item: any) => {
                        if (item.createdAt?.toDate) return item.createdAt.toDate().getTime();
                        if (item.createdAt?.seconds) return item.createdAt.seconds * 1000;
                        if (item.date) return new Date(item.date).getTime();
                        return 0;
                    };
                    return getTime(b) - getTime(a);
                });
            } else {
                // Caixinha manual - buscar apenas do histórico
                const historyRef = collection(db, 'users', userId, 'investments', investmentId, 'history');
                const q = query(historyRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);

                transactions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }

            return { success: true, data: transactions };
        } catch (error: any) {
            console.error('[Firebase] Error getting investment transactions:', error);
            return { success: false, error: error.message };
        }
    },

    // Delete investment
    deleteInvestment: async (userId: string, investmentId: string) => {
        try {
            const docRef = doc(db, 'users', userId, 'investments', investmentId);
            await deleteDoc(docRef);
            return { success: true };
        } catch (error: any) {
            console.error('[Firebase] Error deleting investment:', error);
            return { success: false, error: error.message };
        }
    },

    // Sync savings account as investment (Caixinha) from Pluggy
    syncSavingsAccountAsInvestment: async (userId: string, account: any, connector?: any) => {
        try {
            // Use Pluggy account ID as document ID to avoid duplicates
            const investmentId = `savings_${account.id}`;
            const docRef = doc(db, 'users', userId, 'investments', investmentId);
            const effectiveConnector = account.connector ?? connector ?? null;
            const normalizedConnector = normalizeConnectorForStorage(effectiveConnector);

            // Check if already exists
            const existingDoc = await getDoc(docRef);
            const existingData = existingDoc.exists() ? existingDoc.data() : null;

            // Build investment data
            const bankName = normalizedConnector?.name || account.name || 'Banco';
            const accountNumber = account.number ? ` (${account.number})` : '';

            const investmentData = {
                // Keep existing name if user renamed it, otherwise use bank name
                name: existingData?.name || `Poupança ${bankName}${accountNumber}`,
                currentAmount: Number(account.balance ?? 0),
                // Keep existing target if set, otherwise set to 0 (no target for synced accounts)
                targetAmount: existingData?.targetAmount ?? 0,
                color: normalizedConnector?.primaryColor || '#D97757',
                icon: 'savings',

                // Pluggy metadata
                source: 'pluggy',
                pluggyAccountId: account.id,
                pluggyItemId: account.itemId || null,
                connector: normalizedConnector,

                // Sync info
                lastSyncedAt: new Date().toISOString(),
                updatedAt: Timestamp.now(),
                // Only set createdAt on first creation
                ...(existingData ? {} : { createdAt: new Date().toISOString().split('T')[0] })
            };

            await setDoc(docRef, investmentData, { merge: true });

            return { success: true, id: investmentId, isNew: !existingData };
        } catch (error: any) {
            console.error('[Firebase] Error syncing savings account as investment:', error);
            return { success: false, error: error.message };
        }
    },

    // Save savings account transactions as investment history
    saveSavingsAccountTransactions: async (userId: string, accountId: string, transactions: any[]) => {
        try {
            const investmentId = `savings_${accountId}`;
            const historyRef = collection(db, 'users', userId, 'investments', investmentId, 'history');

            let savedCount = 0;
            let skippedCount = 0;

            for (const tx of transactions) {
                try {
                    // Use Pluggy transaction ID as document ID to avoid duplicates
                    const txId = tx.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const docRef = doc(historyRef, txId);

                    // Check if transaction already exists
                    const existingDoc = await getDoc(docRef);
                    if (existingDoc.exists()) {
                        skippedCount++;
                        continue;
                    }

                    // Determine if it's a deposit or withdraw based on amount
                    // Positive amount = deposit, Negative amount = withdraw
                    const amount = Number(tx.amount ?? 0);
                    const type: 'deposit' | 'withdraw' = amount >= 0 ? 'deposit' : 'withdraw';

                    const transactionData = {
                        amount: Math.abs(amount),
                        type,
                        date: tx.date || new Date().toISOString(),
                        description: tx.description || tx.descriptionRaw || null,
                        category: tx.category || null,

                        // Pluggy metadata
                        pluggyTransactionId: txId,
                        source: 'pluggy',

                        createdAt: Timestamp.now()
                    };

                    await setDoc(docRef, transactionData);
                    savedCount++;
                } catch (txError: any) {
                    console.error('[Firebase] Error saving savings transaction:', txError);
                }
            }

            return { success: true, savedCount, skippedCount };
        } catch (error: any) {
            console.error('[Firebase] Error saving savings account transactions:', error);
            return { success: false, error: error.message };
        }
    },

    // Real-time listener for investments (includes savings accounts from Open Finance)
    onInvestmentsChange: (userId: string, callback: (items: any[]) => void) => {
        const investmentsRef = collection(db, 'users', userId, 'investments');
        const accountsRef = collection(db, 'users', userId, 'accounts');

        // State to hold data from multiple sources
        let manualInvestments: any[] = [];
        let savingsAccounts: any[] = [];

        const notify = () => {
            // IDs de investimentos que já foram criados a partir de contas poupança
            const existingSavingsIds = new Set(
                manualInvestments
                    .filter(i => i.source === 'pluggy' && i.pluggyAccountId)
                    .map(i => i.pluggyAccountId)
            );

            // Converter contas poupança que ainda não existem como investments
            // Filtrar apenas poupanças com saldo > 0
            const newSavingsAsInvestments = savingsAccounts
                .filter(acc => !existingSavingsIds.has(acc.id) && Number(acc.balance ?? 0) > 0)
                .map(acc => ({
                    id: `savings_${acc.id}`,
                    name: acc.name || `Poupança ${acc.connector?.name || 'Banco'}`,
                    currentAmount: Number(acc.balance ?? 0),
                    targetAmount: 0,
                    color: acc.connector?.primaryColor || '#D97757',
                    icon: 'savings',
                    createdAt: acc.createdAt || new Date().toISOString().split('T')[0],
                    source: 'pluggy',
                    pluggyAccountId: acc.id,
                    pluggyItemId: acc.pluggyItemId || null,
                    connector: acc.connector || null,
                    lastSyncedAt: acc.lastSyncedAt || null
                }));

            // Combinar: investments manuais/existentes + poupanças novas
            const allItems = [...manualInvestments, ...newSavingsAsInvestments];

            // Ordenar por createdAt
            allItems.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });

            callback(allItems);
        };

        // Listener para investments (caixinhas manuais e poupanças já convertidas)
        const unsubInvestments = onSnapshot(investmentsRef, (snapshot) => {
            manualInvestments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            notify();
        });

        // Listener para accounts (buscar contas poupança)
        const qSavings = query(accountsRef, where('subtype', '==', 'SAVINGS_ACCOUNT'));
        const unsubSavings = onSnapshot(qSavings, (snapshot) => {
            savingsAccounts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            notify();
        });

        // Retornar função para cancelar ambos os listeners
        return () => {
            unsubInvestments();
            unsubSavings();
        };
    },

    // Real-time listener for recurrences
    onRecurrencesChange: (userId: string, callback: (items: any[]) => void) => {
        const recurrencesRef = collection(db, 'users', userId, 'recurrences');
        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const remindersRef = collection(db, 'users', userId, 'reminders');

        // Internal state to hold data from listeners
        let manualItems: any[] = [];
        let subItems: any[] = [];
        let remItems: any[] = [];
        let autoItems: any[] = [];
        let isAutoLoaded = false;

        const notify = () => {
            // Combine unique items
            const allItems = [...manualItems, ...subItems, ...remItems, ...autoItems];
            callback(allItems);
        };

        // Fetch auto-detected items once
        databaseService.getRecurrences(userId).then(result => {
            if (result.success && result.data) {
                // Filter items that are Auto or Bill
                autoItems = (result.data as any[]).filter(i => i.isAuto || i.isBill);
                isAutoLoaded = true;
                notify();
            }
        });

        const unsubRec = onSnapshot(recurrencesRef, (snapshot) => {
            manualItems = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    status: ((data.status && data.status.toLowerCase() === 'paid') || data.paid === true) ? 'paid' : 'pending'
                };
            });
            notify();
        });

        const unsubSub = onSnapshot(subscriptionsRef, (snapshot) => {
            subItems = snapshot.docs.map(doc => {
                const data = doc.data();
                const rawDate = data.dueDate || data.date || data.nextPaymentDate || new Date().toISOString();

                // Allow RecurrenceView to handle projection logic based on frequency
                // We just pass the raw source of truth from DB

                return {
                    id: doc.id,
                    name: data.name || data.title || data.description || data.serviceName || 'Assinatura',
                    amount: Number(data.amount || data.value || data.price || 0),
                    dueDate: rawDate.split('T')[0],
                    type: 'subscription',
                    status: ((data.status && data.status.toLowerCase() === 'paid') || data.paid === true) ? 'paid' : 'pending',
                    frequency: data.frequency || data.cycle || 'monthly',
                    category: data.category || 'Assinaturas',
                    logo: data.logo || data.icon || null,
                    cancellationDate: data.cancellationDate || null,
                    paidMonths: data.paidMonths || []
                };
            });
            notify();
        });

        const unsubRem = onSnapshot(remindersRef, (snapshot) => {
            remItems = snapshot.docs.map(doc => {
                const data = doc.data();
                const rawDate = data.dueDate || data.date || new Date().toISOString();

                // Logic updated to trust DB date (Simplified Flow)
                // No more smart projection to current month for reminders

                return {
                    id: doc.id,
                    name: data.name || data.title || data.description || 'Lembrete',
                    amount: Number(data.amount || data.value || 0),
                    dueDate: rawDate.split('T')[0],
                    type: 'reminder',
                    status: ((data.status && data.status.toLowerCase() === 'paid') || data.paid === true) ? 'paid' : 'pending',
                    frequency: data.frequency || data.cycle || data.recurrence || 'monthly',
                    category: data.category || 'Lembretes',
                    logo: data.logo || data.icon || null,
                    cancellationDate: data.cancellationDate || null,
                    paidMonths: data.paidMonths || [],
                    transactionType: data.type === 'income' ? 'income' : 'expense' // Read type correctly from DB
                };
            });
            notify();
        });

        return () => {
            unsubRec();
            unsubSub();
            unsubRem();
        };
    }
};

// Export types for convenience


