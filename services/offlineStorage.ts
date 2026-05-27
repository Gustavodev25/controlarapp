// Offline Storage Service for Controlar+ App
// Provides persistent local cache for all Firebase data using AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_PREFIX = '@offline:';
const PENDING_OPS_KEY = '@offline:pendingOps';
const LAST_SYNC_KEY = '@offline:lastSync';
const NETWORK_STATUS_KEY = '@offline:networkStatus';

// Types for pending operations
export interface PendingOperation {
    id: string;
    timestamp: number;
    type: 'add' | 'update' | 'delete';
    collection: string;
    userId: string;
    documentId?: string;
    data?: any;
    // Extra params for complex operations
    extra?: any;
}

// Cache key generator
function cacheKey(userId: string, collection: string, subKey?: string): string {
    const base = `${OFFLINE_PREFIX}${collection}:${userId}`;
    return subKey ? `${base}:${subKey}` : base;
}

class OfflineStorageService {
    // ===== Core Cache Operations =====

    /**
     * Save data to offline cache
     */
    async saveToCache<T>(userId: string, collectionName: string, data: T, subKey?: string): Promise<void> {
        try {
            const key = cacheKey(userId, collectionName, subKey);
            const payload = JSON.stringify({
                data,
                cachedAt: Date.now(),
            });
            await AsyncStorage.setItem(key, payload);
        } catch (error) {
            console.warn('[OfflineStorage] Error saving to cache:', error);
        }
    }

    /**
     * Get data from offline cache
     * Returns null if no cached data exists
     */
    async getFromCache<T>(userId: string, collectionName: string, subKey?: string): Promise<{ data: T; cachedAt: number } | null> {
        try {
            const key = cacheKey(userId, collectionName, subKey);
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                return JSON.parse(stored);
            }
            return null;
        } catch (error) {
            console.warn('[OfflineStorage] Error reading from cache:', error);
            return null;
        }
    }

    /**
     * Remove data from cache
     */
    async removeFromCache(userId: string, collectionName: string, subKey?: string): Promise<void> {
        try {
            const key = cacheKey(userId, collectionName, subKey);
            await AsyncStorage.removeItem(key);
        } catch (error) {
            console.warn('[OfflineStorage] Error removing from cache:', error);
        }
    }

    // ===== Convenience methods for common data types =====

    async saveProfile(userId: string, profile: any): Promise<void> {
        await this.saveToCache(userId, 'profile', profile);
    }

    async getProfile(userId: string): Promise<any | null> {
        const cached = await this.getFromCache(userId, 'profile');
        return cached?.data ?? null;
    }

    async saveTransactions(userId: string, transactions: any[]): Promise<void> {
        await this.saveToCache(userId, 'transactions', transactions);
    }

    async getTransactions(userId: string): Promise<any[] | null> {
        const cached = await this.getFromCache<any[]>(userId, 'transactions');
        return cached?.data ?? null;
    }

    async saveAccounts(userId: string, accounts: any[]): Promise<void> {
        await this.saveToCache(userId, 'accounts', accounts);
    }

    async getAccounts(userId: string): Promise<any[] | null> {
        const cached = await this.getFromCache<any[]>(userId, 'accounts');
        return cached?.data ?? null;
    }

    async saveCategories(userId: string, categories: any[]): Promise<void> {
        await this.saveToCache(userId, 'categories', categories);
    }

    async getCategories(userId: string): Promise<any[] | null> {
        const cached = await this.getFromCache<any[]>(userId, 'categories');
        return cached?.data ?? null;
    }

    async saveRecurrences(userId: string, recurrences: any[]): Promise<void> {
        await this.saveToCache(userId, 'recurrences', recurrences);
    }

    async getRecurrences(userId: string): Promise<any[] | null> {
        const cached = await this.getFromCache<any[]>(userId, 'recurrences');
        return cached?.data ?? null;
    }

    async saveInvestments(userId: string, investments: any[]): Promise<void> {
        await this.saveToCache(userId, 'investments', investments);
    }

    async getInvestments(userId: string): Promise<any[] | null> {
        const cached = await this.getFromCache<any[]>(userId, 'investments');
        return cached?.data ?? null;
    }

    async saveSubscription(userId: string, subscription: any): Promise<void> {
        await this.saveToCache(userId, 'subscription', subscription);
    }

    async getSubscription(userId: string): Promise<any | null> {
        const cached = await this.getFromCache(userId, 'subscription');
        return cached?.data ?? null;
    }

    async saveFullSubscription(userId: string, data: any): Promise<void> {
        await this.saveToCache(userId, 'fullSubscription', data);
    }

    async getFullSubscription(userId: string): Promise<any | null> {
        const cached = await this.getFromCache(userId, 'fullSubscription');
        return cached?.data ?? null;
    }

    async saveDashboardSnapshot(userId: string, monthKey: string, data: any): Promise<void> {
        await this.saveToCache(userId, 'dashboard', data, monthKey);
    }

    async getDashboardSnapshot(userId: string, monthKey: string): Promise<any | null> {
        const cached = await this.getFromCache(userId, 'dashboard', monthKey);
        return cached?.data ?? null;
    }

    async saveCreditCardTransactions(userId: string, transactions: any[]): Promise<void> {
        await this.saveToCache(userId, 'creditCardTransactions', transactions);
    }

    async getCreditCardTransactions(userId: string): Promise<any[] | null> {
        const cached = await this.getFromCache<any[]>(userId, 'creditCardTransactions');
        return cached?.data ?? null;
    }

    async savePaymentHistory(userId: string, payments: any[]): Promise<void> {
        await this.saveToCache(userId, 'paymentHistory', payments);
    }

    async getPaymentHistory(userId: string): Promise<any[] | null> {
        const cached = await this.getFromCache<any[]>(userId, 'paymentHistory');
        return cached?.data ?? null;
    }

    async saveSyncCredits(userId: string, data: any): Promise<void> {
        await this.saveToCache(userId, 'syncCredits', data);
    }

    async getSyncCredits(userId: string): Promise<any | null> {
        const cached = await this.getFromCache(userId, 'syncCredits');
        return cached?.data ?? null;
    }

    // ===== Pending Operations Queue =====

    async addPendingOperation(op: PendingOperation): Promise<void> {
        try {
            const ops = await this.getPendingOperations();
            ops.push(op);
            await AsyncStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
        } catch (error) {
            console.error('[OfflineStorage] Error adding pending operation:', error);
        }
    }

    async getPendingOperations(): Promise<PendingOperation[]> {
        try {
            const stored = await AsyncStorage.getItem(PENDING_OPS_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
            return [];
        } catch (error) {
            console.warn('[OfflineStorage] Error reading pending operations:', error);
            return [];
        }
    }

    async removePendingOperation(opId: string): Promise<void> {
        try {
            const ops = await this.getPendingOperations();
            const filtered = ops.filter(op => op.id !== opId);
            await AsyncStorage.setItem(PENDING_OPS_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.warn('[OfflineStorage] Error removing pending operation:', error);
        }
    }

    async clearPendingOperations(): Promise<void> {
        try {
            await AsyncStorage.removeItem(PENDING_OPS_KEY);
        } catch (error) {
            console.warn('[OfflineStorage] Error clearing pending operations:', error);
        }
    }

    // ===== Network Status =====

    async setNetworkStatus(isOnline: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem(NETWORK_STATUS_KEY, JSON.stringify({ isOnline, updatedAt: Date.now() }));
        } catch (error) {
            // Ignore
        }
    }

    // ===== Last Sync Tracking =====

    async setLastSync(userId: string, collectionName: string): Promise<void> {
        try {
            const key = `${LAST_SYNC_KEY}:${userId}:${collectionName}`;
            await AsyncStorage.setItem(key, JSON.stringify({ syncedAt: Date.now() }));
        } catch (error) {
            // Ignore
        }
    }

    async getLastSync(userId: string, collectionName: string): Promise<number | null> {
        try {
            const key = `${LAST_SYNC_KEY}:${userId}:${collectionName}`;
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.syncedAt;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    // ===== Utility =====

    /**
     * Get how long ago data was cached (in minutes)
     */
    async getCacheAge(userId: string, collectionName: string, subKey?: string): Promise<number | null> {
        const cached = await this.getFromCache(userId, collectionName, subKey);
        if (cached?.cachedAt) {
            return (Date.now() - cached.cachedAt) / (1000 * 60);
        }
        return null;
    }

    /**
     * Clear ALL offline data for a user (called on sign out)
     */
    async clearUserData(userId: string): Promise<void> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const userKeys = allKeys.filter(key =>
                key.includes(`:${userId}`)
            );
            if (userKeys.length > 0) {
                await AsyncStorage.multiRemove(userKeys);
            }
        } catch (error) {
            console.warn('[OfflineStorage] Error clearing user data:', error);
        }
    }

    /**
     * Clear ALL offline data (nuclear option)
     */
    async clearAll(): Promise<void> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const offlineKeys = allKeys.filter(key => key.startsWith(OFFLINE_PREFIX));
            if (offlineKeys.length > 0) {
                await AsyncStorage.multiRemove(offlineKeys);
            }
        } catch (error) {
            console.warn('[OfflineStorage] Error clearing all data:', error);
        }
    }
}

export const offlineStorage = new OfflineStorageService();
