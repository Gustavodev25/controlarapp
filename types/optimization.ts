export interface MonthlyAnalyticsSummary {
    monthKey: string; // "YYYY-MM"
    
    // Aggregated Checking Account Data
    checkingIncome: number;
    checkingExpense: number;
    checkingCount: number;

    // Aggregated Credit Card Data
    creditTotal: number; // Total invoice amount across all cards
    creditCount: number;
    
    // Per-Card Breakdown (map by cardId)
    creditByCard: Record<string, {
        total: number;
        count: number;
    }>;

    // Category Breakdown (map by category name)
    categoryTotals: Record<string, number>;

    // Recurrence/Reminders Snapshot
    recurrencePending: number;
    recurrenceOverdue: number;
    recurrenceNext7d: number;

    updatedAt: string; // ISO Date
    schemaVersion: number;
}

export interface DashboardSnapshot {
    monthKey: string;
    analytics: MonthlyAnalyticsSummary | null;
    accountBalance: number; // Total balance of selected accounts
    isStale: boolean; // True if data is from cache and background refresh is running
}

export interface PaginatedResult<T> {
    data: T[];
    cursor: any; // Firestore DocumentSnapshot or custom cursor object
    hasMore: boolean;
}

export interface DualSourceCursor {
    checking: any; // Firestore DocumentSnapshot
    credit: any; // Firestore DocumentSnapshot
    lastDate: string; // ISO Date of last item, for resuming sort
}
