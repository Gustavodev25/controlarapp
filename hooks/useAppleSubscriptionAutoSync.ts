import { syncAppleSubscriptionStatus } from '@/services/iapService';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

type SyncReason = 'app_open' | 'foreground';

interface AppleSubscriptionAutoSyncOptions {
    userId?: string | null;
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    enabled?: boolean;
    onSynced?: () => Promise<void> | void;
}

interface AppleSubscriptionAutoSyncState {
    isInitialSyncing: boolean;
    hasCompletedInitialSync: boolean;
    syncedHasPro: boolean | null;
}

export function useAppleSubscriptionAutoSync({
    userId,
    isAuthenticated,
    isAuthLoading,
    enabled = true,
    onSynced,
}: AppleSubscriptionAutoSyncOptions): AppleSubscriptionAutoSyncState {
    const [isInitialSyncing, setIsInitialSyncing] = useState(false);
    const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(Platform.OS !== 'ios');
    const [syncedHasPro, setSyncedHasPro] = useState<boolean | null>(null);

    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const initialSyncUserRef = useRef<string | null>(null);
    const currentUserIdRef = useRef<string | null>(userId ?? null);
    const inFlightUserIdRef = useRef<string | null>(null);
    const inFlightPromiseRef = useRef<Promise<void> | null>(null);
    const inFlightTokenRef = useRef<symbol | null>(null);
    const onSyncedRef = useRef(onSynced);

    useEffect(() => {
        currentUserIdRef.current = userId ?? null;
    }, [userId]);

    useEffect(() => {
        onSyncedRef.current = onSynced;
    }, [onSynced]);

    const canSync =
        enabled &&
        Platform.OS === 'ios' &&
        isAuthenticated &&
        !isAuthLoading &&
        Boolean(userId);

    const runSync = useCallback((reason: SyncReason) => {
        if (!canSync || !userId) {
            return Promise.resolve();
        }

        if (inFlightPromiseRef.current && inFlightUserIdRef.current === userId) {
            return inFlightPromiseRef.current;
        }

        if (reason === 'app_open') {
            setIsInitialSyncing(true);
        }

        inFlightUserIdRef.current = userId;
        const syncToken = Symbol('apple-subscription-sync');
        inFlightTokenRef.current = syncToken;

        const syncPromise = (async () => {
            try {
                const result = await syncAppleSubscriptionStatus(userId);
                if (currentUserIdRef.current !== userId) return;

                if (result.success) {
                    setSyncedHasPro(result.hasPro);
                    await onSyncedRef.current?.();
                }
            } catch (error) {
                console.warn('[IAP] automatic Apple subscription sync failed:', error);
            } finally {
                if (currentUserIdRef.current === userId && reason === 'app_open') {
                    initialSyncUserRef.current = userId;
                    setHasCompletedInitialSync(true);
                    setIsInitialSyncing(false);
                }

                if (inFlightTokenRef.current === syncToken) {
                    inFlightPromiseRef.current = null;
                    inFlightUserIdRef.current = null;
                    inFlightTokenRef.current = null;
                }
            }
        })();

        inFlightPromiseRef.current = syncPromise;
        return syncPromise;
    }, [canSync, userId]);

    useEffect(() => {
        if (!canSync || !userId) {
            initialSyncUserRef.current = null;
            setIsInitialSyncing(false);
            setHasCompletedInitialSync(true);
            setSyncedHasPro(null);
            return;
        }

        if (initialSyncUserRef.current === userId) return;

        setHasCompletedInitialSync(false);
        setSyncedHasPro(null);
        runSync('app_open');
    }, [canSync, runSync, userId]);

    useEffect(() => {
        if (Platform.OS !== 'ios') return undefined;

        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;

            const wasInBackground = previousState === 'inactive' || previousState === 'background';
            if (wasInBackground && nextState === 'active') {
                runSync('foreground');
            }
        });

        return () => subscription.remove();
    }, [runSync]);

    return {
        isInitialSyncing,
        hasCompletedInitialSync,
        syncedHasPro,
    };
}
