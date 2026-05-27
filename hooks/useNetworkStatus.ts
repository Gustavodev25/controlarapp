// Network Status Hook for Controlar+ App
// Detects online/offline state without external dependencies
import { offlineSync } from '@/services/offlineSync';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const CONNECTIVITY_CHECK_INTERVAL_MS = 60000;
const CONNECTIVITY_TIMEOUT_MS = 4000;

interface NetworkStatus {
    isOnline: boolean;
    isChecking: boolean;
    lastChecked: number | null;
    pendingOps: number;
    isSyncing: boolean;
}

/**
 * Hook to detect network connectivity status.
 * Uses fetch to ping a reliable endpoint instead of @react-native-community/netinfo.
 */
export function useNetworkStatus() {
    const [status, setStatus] = useState<NetworkStatus>({
        isOnline: true, // Assume online initially
        isChecking: false,
        lastChecked: null,
        pendingOps: 0,
        isSyncing: false,
    });

    const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMounted = useRef(true);
    const checkInFlight = useRef(false);

    const checkConnectivity = useCallback(async (options: { showChecking?: boolean } = {}) => {
        const appState = AppState.currentState;
        if (!isMounted.current || checkInFlight.current || appState === 'background' || appState === 'inactive') return;

        const showChecking = options.showChecking === true;
        checkInFlight.current = true;

        if (showChecking) {
            setStatus(prev => (prev.isChecking ? prev : { ...prev, isChecking: true }));
        }

        try {
            // Use Google's connectivity check endpoint (very lightweight)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);

            const response = await fetch('https://clients3.google.com/generate_204', {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store',
            });

            clearTimeout(timeoutId);

            const isOnline = response.status === 204 || response.ok;

            if (isMounted.current) {
                offlineSync.isOnline = isOnline;
                setStatus(prev => {
                    const lastChecked = prev.isOnline !== isOnline || prev.lastChecked === null ? Date.now() : prev.lastChecked;
                    if (prev.isOnline === isOnline && !prev.isChecking && prev.lastChecked === lastChecked) {
                        return prev;
                    }
                    return {
                        ...prev,
                        isOnline,
                        isChecking: false,
                        lastChecked,
                    };
                });
            }
        } catch {
            if (isMounted.current) {
                offlineSync.isOnline = false;
                setStatus(prev => {
                    const lastChecked = prev.isOnline !== false || prev.lastChecked === null ? Date.now() : prev.lastChecked;
                    if (!prev.isOnline && !prev.isChecking && prev.lastChecked === lastChecked) {
                        return prev;
                    }
                    return {
                        ...prev,
                        isOnline: false,
                        isChecking: false,
                        lastChecked,
                    };
                });
            }
        } finally {
            checkInFlight.current = false;
        }
    }, []);

    // Subscribe to offlineSync status
    useEffect(() => {
        const unsubscribe = offlineSync.subscribe((syncStatus) => {
            if (isMounted.current) {
                setStatus(prev => ({
                    ...prev,
                    pendingOps: syncStatus.pending,
                    isSyncing: syncStatus.syncing,
                }));
            }
        });

        return unsubscribe;
    }, []);

    // Check connectivity on mount and periodically
    useEffect(() => {
        isMounted.current = true;

        // Initial check
        checkConnectivity();

        // Background checks should be infrequent; Firestore operations still surface real network errors.
        checkInterval.current = setInterval(checkConnectivity, CONNECTIVITY_CHECK_INTERVAL_MS);

        // Also check on app state change
        const appStateHandler = (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                checkConnectivity();
            }
        };

        const subscription = AppState.addEventListener('change', appStateHandler);

        return () => {
            isMounted.current = false;
            if (checkInterval.current) {
                clearInterval(checkInterval.current);
            }
            subscription.remove();
        };
    }, [checkConnectivity]);

    // Manual refresh
    const refresh = useCallback(() => {
        checkConnectivity({ showChecking: true });
    }, [checkConnectivity]);

    return {
        ...status,
        refresh,
    };
}
