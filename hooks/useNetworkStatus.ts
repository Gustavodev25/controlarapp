// Network Status Hook for Controlar+ App
// Detects online/offline state without external dependencies
import { offlineSync } from '@/services/offlineSync';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

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

    const checkConnectivity = useCallback(async () => {
        if (!isMounted.current) return;

        setStatus(prev => ({ ...prev, isChecking: true }));

        try {
            // Use Google's connectivity check endpoint (very lightweight)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('https://clients3.google.com/generate_204', {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-store',
            });

            clearTimeout(timeoutId);

            const isOnline = response.status === 204 || response.ok;

            if (isMounted.current) {
                offlineSync.isOnline = isOnline;
                setStatus(prev => ({
                    ...prev,
                    isOnline,
                    isChecking: false,
                    lastChecked: Date.now(),
                }));
            }
        } catch {
            if (isMounted.current) {
                offlineSync.isOnline = false;
                setStatus(prev => ({
                    ...prev,
                    isOnline: false,
                    isChecking: false,
                    lastChecked: Date.now(),
                }));
            }
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

        // Check every 15 seconds
        checkInterval.current = setInterval(checkConnectivity, 15000);

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
        checkConnectivity();
    }, [checkConnectivity]);

    return {
        ...status,
        refresh,
    };
}
