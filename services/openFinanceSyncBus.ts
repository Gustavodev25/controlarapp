// Lightweight in-memory pub/sub for the active Open Finance sync state.
// ConnectedBankCard publishes phase/progress while syncing; banners and other
// screens subscribe to render real-time progress.

export type OpenFinanceSyncPhase =
    | 'idle'
    | 'connecting'
    | 'fetching_accounts'
    | 'saving_accounts'
    | 'fetching_transactions'
    | 'saving_transactions'
    | 'done'
    | 'error';

export type OpenFinanceSyncState = {
    active: boolean;
    phase: OpenFinanceSyncPhase;
    message: string;
    progress: number; // 0..1
    bankName?: string | null;
    accountsProcessed?: number;
    creditAccountsProcessed?: number;
};

const initialState: OpenFinanceSyncState = {
    active: false,
    phase: 'idle',
    message: '',
    progress: 0,
};

let currentState: OpenFinanceSyncState = { ...initialState };
const listeners = new Set<(state: OpenFinanceSyncState) => void>();

export const openFinanceSyncBus = {
    getState(): OpenFinanceSyncState {
        return currentState;
    },
    setState(next: Partial<OpenFinanceSyncState>): void {
        currentState = { ...currentState, ...next };
        listeners.forEach((listener) => listener(currentState));
    },
    reset(): void {
        currentState = { ...initialState };
        listeners.forEach((listener) => listener(currentState));
    },
    subscribe(listener: (state: OpenFinanceSyncState) => void): () => void {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
