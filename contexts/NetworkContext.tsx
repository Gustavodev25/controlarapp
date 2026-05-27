// Network Context for Controlar+ App
// Provides network status to the entire app via React Context
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import React, { createContext, ReactNode, useContext } from 'react';

interface NetworkContextType {
    isOnline: boolean;
    isChecking: boolean;
    lastChecked: number | null;
    pendingOps: number;
    isSyncing: boolean;
    refresh: () => void;
}

const NetworkContext = createContext<NetworkContextType>({
    isOnline: true,
    isChecking: false,
    lastChecked: null,
    pendingOps: 0,
    isSyncing: false,
    refresh: () => { },
});

export function NetworkProvider({ children }: { children: ReactNode }) {
    const networkStatus = useNetworkStatus();

    return (
        <NetworkContext.Provider value={networkStatus}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    return useContext(NetworkContext);
}
