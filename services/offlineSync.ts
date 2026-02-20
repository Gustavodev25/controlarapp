// Offline Sync Service for Controlar+ App
// Manages pending write operations and syncs them when back online
import { AppState, AppStateStatus } from 'react-native';
import { offlineStorage, PendingOperation } from './offlineStorage';

type SyncStatusListener = (status: { pending: number; syncing: boolean; lastError?: string }) => void;

class OfflineSyncService {
    private isSyncing = false;
    private listeners: Set<SyncStatusListener> = new Set();
    private appStateSubscription: any = null;
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private _isOnline = true;

    get isOnline(): boolean {
        return this._isOnline;
    }

    set isOnline(value: boolean) {
        const wasOffline = !this._isOnline;
        this._isOnline = value;

        // If we just came back online, trigger sync
        if (wasOffline && value) {
            console.log('[OfflineSync] Back online - triggering sync');
            this.processPendingOperations();
        }
    }

    /**
     * Start monitoring for sync opportunities
     */
    start() {
        // Monitor app state to sync when app comes to foreground
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

        // Try to sync every 30 seconds
        this.syncInterval = setInterval(() => {
            if (this._isOnline && !this.isSyncing) {
                this.processPendingOperations();
            }
        }, 30000);

        // Initial sync attempt
        this.processPendingOperations();
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Subscribe to sync status changes
     */
    subscribe(listener: SyncStatusListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Queue a write operation for later sync
     */
    async queueOperation(
        type: 'add' | 'update' | 'delete',
        collectionName: string,
        userId: string,
        data?: any,
        documentId?: string,
        extra?: any
    ): Promise<string> {
        const op: PendingOperation = {
            id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            type,
            collection: collectionName,
            userId,
            documentId,
            data,
            extra
        };

        await offlineStorage.addPendingOperation(op);
        this.notifyListeners();
        console.log(`[OfflineSync] Queued ${type} operation for ${collectionName}`);
        return op.id;
    }

    /**
     * Process ALL pending operations
     * Called when back online
     */
    async processPendingOperations(): Promise<{ processed: number; failed: number }> {
        if (this.isSyncing) {
            return { processed: 0, failed: 0 };
        }

        const operations = await offlineStorage.getPendingOperations();
        if (operations.length === 0) {
            return { processed: 0, failed: 0 };
        }

        this.isSyncing = true;
        this.notifyListeners();

        let processed = 0;
        let failed = 0;

        console.log(`[OfflineSync] Processing ${operations.length} pending operations...`);

        // Import databaseService lazily to avoid circular dependencies
        const { databaseService } = await import('./firebase');

        for (const op of operations) {
            try {
                await this.executeOperation(op, databaseService);
                await offlineStorage.removePendingOperation(op.id);
                processed++;
                console.log(`[OfflineSync] ✓ Processed: ${op.type} ${op.collection}`);
            } catch (error: any) {
                failed++;
                console.error(`[OfflineSync] ✗ Failed: ${op.type} ${op.collection}:`, error.message);

                // If it's a network error, stop trying (we're still offline)
                if (this.isNetworkError(error)) {
                    console.log('[OfflineSync] Network error detected, stopping sync');
                    this._isOnline = false;
                    break;
                }

                // If it's another type of error, remove the op to avoid infinite retries
                // (e.g., permission denied, document not found)
                if (op.timestamp < Date.now() - 24 * 60 * 60 * 1000) {
                    // Op is older than 24 hours, discard it
                    await offlineStorage.removePendingOperation(op.id);
                    console.log(`[OfflineSync] Discarded stale operation: ${op.id}`);
                }
            }
        }

        this.isSyncing = false;
        this.notifyListeners();

        console.log(`[OfflineSync] Sync complete: ${processed} processed, ${failed} failed`);
        return { processed, failed };
    }

    /**
     * Get the count of pending operations
     */
    async getPendingCount(): Promise<number> {
        const ops = await offlineStorage.getPendingOperations();
        return ops.length;
    }

    // ===== Private Methods =====

    private handleAppStateChange = (nextState: AppStateStatus) => {
        if (nextState === 'active' && this._isOnline) {
            // App came back to foreground, try syncing
            this.processPendingOperations();
        }
    };

    private async executeOperation(op: PendingOperation, databaseService: any): Promise<void> {
        switch (op.collection) {
            case 'transactions':
                return this.syncTransaction(op, databaseService);
            case 'recurrences':
            case 'subscriptions':
            case 'reminders':
                return this.syncRecurrence(op, databaseService);
            case 'investments':
                return this.syncInvestment(op, databaseService);
            case 'accounts':
                return this.syncAccount(op, databaseService);
            case 'profile':
                return this.syncProfile(op, databaseService);
            case 'categories':
                return this.syncCategory(op, databaseService);
            default:
                console.warn(`[OfflineSync] Unknown collection: ${op.collection}`);
        }
    }

    private async syncTransaction(op: PendingOperation, db: any): Promise<void> {
        switch (op.type) {
            case 'add':
                await db.addTransaction(op.userId, op.data);
                break;
            case 'update':
                await db.updateTransaction(op.userId, op.documentId!, op.data);
                break;
            case 'delete':
                await db.deleteTransaction(op.userId, op.documentId!);
                break;
        }
    }

    private async syncRecurrence(op: PendingOperation, db: any): Promise<void> {
        const recType = op.extra?.recurrenceType || 'subscription';
        switch (op.type) {
            case 'add':
                await db.addRecurrence(op.userId, op.data);
                break;
            case 'update':
                await db.updateRecurrence(op.userId, op.documentId!, op.data, recType);
                break;
            case 'delete':
                await db.deleteRecurrence(op.userId, op.documentId!, recType);
                break;
        }
    }

    private async syncInvestment(op: PendingOperation, db: any): Promise<void> {
        switch (op.type) {
            case 'add':
                await db.addInvestment(op.userId, op.data);
                break;
            case 'update':
                await db.updateInvestment(op.userId, op.documentId!, op.data);
                break;
            case 'delete':
                await db.deleteInvestment(op.userId, op.documentId!);
                break;
        }
    }

    private async syncAccount(op: PendingOperation, db: any): Promise<void> {
        switch (op.type) {
            case 'update':
                await db.updateAccount(op.userId, op.documentId!, op.data);
                break;
            case 'delete':
                await db.deleteAccount(op.userId, op.documentId!);
                break;
        }
    }

    private async syncProfile(op: PendingOperation, db: any): Promise<void> {
        if (op.type === 'update') {
            await db.setUserProfile(op.userId, op.data);
        }
    }

    private async syncCategory(op: PendingOperation, db: any): Promise<void> {
        // Categories sync on reconnect
        // The operations are handled by the category service
    }

    private isNetworkError(error: any): boolean {
        const message = (error?.message || '').toLowerCase();
        const code = error?.code || '';

        return (
            message.includes('network') ||
            message.includes('offline') ||
            message.includes('internet') ||
            message.includes('connection') ||
            message.includes('failed to fetch') ||
            message.includes('timeout') ||
            code === 'unavailable' ||
            code === 'network-request-failed'
        );
    }

    private async notifyListeners() {
        const pending = await this.getPendingCount();
        const status = {
            pending,
            syncing: this.isSyncing
        };
        this.listeners.forEach(listener => listener(status));
    }
}

export const offlineSync = new OfflineSyncService();
