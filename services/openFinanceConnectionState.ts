import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_CONNECTION_KEY = '@open_finance_pending_connection_v2';
const CALLBACK_PAYLOAD_KEY = '@open_finance_callback_payload_v1';
const BACKGROUND_SYNC_KEY = '@open_finance_background_sync_v1';

export type OpenFinanceConnectorSnapshot = {
    id?: string | number;
    name?: string | null;
    primaryColor?: string | null;
    imageUrl?: string | null;
    type?: string | null;
};

export type SyncPhase = 'idle' | 'creating' | 'oauth_pending' | 'polling' | 'syncing' | 'saving' | 'completed' | 'error';

export type PendingOpenFinanceConnection = {
    itemId: string;
    startedAt: number;
    connector?: OpenFinanceConnectorSnapshot | null;
    userId?: string | null;
    syncPhase?: SyncPhase;
};

export type OpenFinanceCallbackPayload = {
    itemId?: string | null;
    status?: string | null;
    error?: string | null;
    receivedAt: number;
    rawUrl?: string | null;
};

export type BackgroundSyncState = {
    active: boolean;
    itemId: string;
    userId: string;
    connectorName?: string | null;
    syncPhase: SyncPhase;
    startedAt: number;
    lastUpdatedAt: number;
};

const safeParse = <T>(value: string | null): T | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const toValidItemId = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const itemId = value.trim();
    return itemId.length > 0 ? itemId : null;
};

export const openFinanceConnectionState = {
    async savePendingConnection(connection: PendingOpenFinanceConnection): Promise<void> {
        const itemId = toValidItemId(connection.itemId);
        if (!itemId) return;

        await AsyncStorage.setItem(PENDING_CONNECTION_KEY, JSON.stringify({
            itemId,
            startedAt: Number(connection.startedAt) || Date.now(),
            connector: connection.connector ?? null,
            userId: connection.userId ?? null,
            syncPhase: connection.syncPhase ?? 'idle'
        }));
    },

    async getPendingConnection(): Promise<PendingOpenFinanceConnection | null> {
        const raw = await AsyncStorage.getItem(PENDING_CONNECTION_KEY);
        const parsed = safeParse<PendingOpenFinanceConnection>(raw);
        if (!parsed) return null;
        const itemId = toValidItemId(parsed.itemId);
        if (!itemId) return null;
        return {
            itemId,
            startedAt: Number(parsed.startedAt) || Date.now(),
            connector: parsed.connector ?? null,
            userId: parsed.userId ?? null,
            syncPhase: parsed.syncPhase ?? 'idle'
        };
    },

    async updateSyncPhase(phase: SyncPhase): Promise<void> {
        const current = await this.getPendingConnection();
        if (!current) return;
        await this.savePendingConnection({ ...current, syncPhase: phase });
    },

    async clearPendingConnection(): Promise<void> {
        await AsyncStorage.removeItem(PENDING_CONNECTION_KEY);
    },

    async saveCallbackPayload(payload: OpenFinanceCallbackPayload): Promise<void> {
        await AsyncStorage.setItem(CALLBACK_PAYLOAD_KEY, JSON.stringify({
            itemId: toValidItemId(payload.itemId ?? null),
            status: payload.status ?? null,
            error: payload.error ?? null,
            receivedAt: Number(payload.receivedAt) || Date.now(),
            rawUrl: payload.rawUrl ?? null
        }));
    },

    async consumeCallbackPayload(): Promise<OpenFinanceCallbackPayload | null> {
        const raw = await AsyncStorage.getItem(CALLBACK_PAYLOAD_KEY);
        await AsyncStorage.removeItem(CALLBACK_PAYLOAD_KEY);
        const parsed = safeParse<OpenFinanceCallbackPayload>(raw);
        if (!parsed) return null;
        return {
            itemId: toValidItemId(parsed.itemId ?? null),
            status: parsed.status ?? null,
            error: parsed.error ?? null,
            receivedAt: Number(parsed.receivedAt) || Date.now(),
            rawUrl: parsed.rawUrl ?? null
        };
    },

    async clearCallbackPayload(): Promise<void> {
        await AsyncStorage.removeItem(CALLBACK_PAYLOAD_KEY);
    },

    // ====================== BACKGROUND SYNC STATE ======================
    async saveBackgroundSync(state: BackgroundSyncState): Promise<void> {
        await AsyncStorage.setItem(BACKGROUND_SYNC_KEY, JSON.stringify({
            ...state,
            lastUpdatedAt: Date.now()
        }));
    },

    async getBackgroundSync(): Promise<BackgroundSyncState | null> {
        const raw = await AsyncStorage.getItem(BACKGROUND_SYNC_KEY);
        return safeParse<BackgroundSyncState>(raw);
    },

    async updateBackgroundSyncPhase(phase: SyncPhase): Promise<void> {
        const current = await this.getBackgroundSync();
        if (!current) return;
        await this.saveBackgroundSync({ ...current, syncPhase: phase, lastUpdatedAt: Date.now() });
    },

    async clearBackgroundSync(): Promise<void> {
        await AsyncStorage.removeItem(BACKGROUND_SYNC_KEY);
    },

    async isBackgroundSyncActive(): Promise<boolean> {
        const state = await this.getBackgroundSync();
        if (!state || !state.active) return false;
        // Considerar expirado após 10 minutos sem atualização
        const TEN_MINUTES = 10 * 60 * 1000;
        return (Date.now() - state.lastUpdatedAt) < TEN_MINUTES;
    }
};
