import React, { createContext, useCallback, useContext, useState } from 'react';

export interface OpenFinanceSyncState {
    isActive: boolean;
    step: 'idle' | 'connecting' | 'oauth_pending' | 'success' | 'error';
    statusText: string;
    error: string | null;
    connectorName: string | null;
}

interface OpenFinanceSyncContextType {
    syncState: OpenFinanceSyncState;
    updateSyncState: (partial: Partial<OpenFinanceSyncState>) => void;
    clearSyncState: () => void;
}

const defaultState: OpenFinanceSyncState = {
    isActive: false,
    step: 'idle',
    statusText: '',
    error: null,
    connectorName: null,
};

const OpenFinanceSyncContext = createContext<OpenFinanceSyncContextType>({
    syncState: defaultState,
    updateSyncState: () => { },
    clearSyncState: () => { },
});

export const useOpenFinanceSync = () => useContext(OpenFinanceSyncContext);

export function OpenFinanceSyncProvider({ children }: { children: React.ReactNode }) {
    const [syncState, setSyncState] = useState<OpenFinanceSyncState>(defaultState);

    const updateSyncState = useCallback((partial: Partial<OpenFinanceSyncState>) => {
        setSyncState(prev => ({ ...prev, ...partial }));
    }, []);

    const clearSyncState = useCallback(() => {
        setSyncState(defaultState);
    }, []);

    return (
        <OpenFinanceSyncContext.Provider value={{ syncState, updateSyncState, clearSyncState }}>
            {children}
        </OpenFinanceSyncContext.Provider>
    );
}
