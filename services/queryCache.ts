import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface CacheOptions {
    ttlMinutes?: number;
    persist?: boolean; // If true, save to AsyncStorage
}

class QueryCacheService {
    private memoryCache: Map<string, CacheEntry<any>> = new Map();
    private persistenceKeyPrefix = '@query_cache:';
    private subscribers: Map<string, Set<(data: any) => void>> = new Map();

    /**
     * Get data with Stale-While-Revalidate strategy.
     * Returns cached data immediately (if available), then executes fetcher.
     * If fetcher returns new data, updates cache and notifies subscribers.
     */
    async get<T>(
        key: string,
        fetcher: () => Promise<T>,
        options: CacheOptions = { ttlMinutes: 5 }
    ): Promise<T | null> {
        const now = Date.now();
        const ttl = (options.ttlMinutes || 5) * 60 * 1000;

        // 1. Try Memory Cache
        let cached = this.memoryCache.get(key);

        // 2. Try Persistent Cache if memory miss and persistence enabled
        if (!cached && options.persist) {
            try {
                const stored = await AsyncStorage.getItem(this.persistenceKeyPrefix + key);
                if (stored) {
                    cached = JSON.parse(stored);
                    // Hydrate memory cache
                    if (cached) {
                        this.memoryCache.set(key, cached);
                    }
                }
            } catch (e) {
                console.warn('[QueryCache] Error reading from storage', e);
            }
        }

        const isStale = !cached || (now - cached.timestamp > ttl);

        // 3. Define the update function (background fetch)
        const refresh = async () => {
            try {
                const freshData = await fetcher();
                this.set(key, freshData, options.persist);
                return freshData;
            } catch (err) {
                console.error('[QueryCache] Background fetch failed for', key, err);
                throw err;
            }
        };

        // 4. Return Strategy
        if (cached) {
            // Return cached data immediately
            if (isStale) {
                // Trigger background refresh if stale
                // We don't await this, it runs in background
                refresh().catch(e => console.error('[QueryCache] Background refresh error', e));
            }
            return cached.data;
        } else {
            // No cache, must wait for fetch
            return await refresh();
        }
    }

    /**
     * Subscribe to updates for a specific key.
     * Used by hooks to re-render when background fetch completes.
     */
    subscribe<T>(key: string, callback: (data: T) => void): () => void {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key)?.add(callback);

        return () => {
            this.subscribers.get(key)?.delete(callback);
            if (this.subscribers.get(key)?.size === 0) {
                this.subscribers.delete(key);
            }
        };
    }

    /**
     * Manual set (e.g. optimistic updates)
     */
    async set<T>(key: string, data: T, persist: boolean = false) {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now()
        };

        this.memoryCache.set(key, entry);

        // Notify subscribers
        const subs = this.subscribers.get(key);
        if (subs) {
            subs.forEach(cb => cb(data));
        }

        if (persist) {
            try {
                await AsyncStorage.setItem(this.persistenceKeyPrefix + key, JSON.stringify(entry));
            } catch (e) {
                console.warn('[QueryCache] Error writing to storage', e);
            }
        }
    }

    /**
     * Invalidate a key (forces next get to fetch)
     */
    async invalidate(key: string) {
        this.memoryCache.delete(key);
        try {
            await AsyncStorage.removeItem(this.persistenceKeyPrefix + key);
        } catch (e) {
            // ignore
        }
    }
}

export const queryCache = new QueryCacheService();
