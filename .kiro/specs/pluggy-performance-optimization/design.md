# Design Document: Pluggy Performance Optimization

## Overview

This design optimizes the Pluggy (Open Finance) integration by implementing batch processing, parallel operations, retry logic, and efficient database writes. The solution focuses on three key areas: connection speed, transaction saving performance, and data integrity.

The design maintains backward compatibility with existing code while introducing performance improvements through:
- Batch processing for database writes
- Parallel processing for independent operations
- Retry logic with exponential backoff
- Efficient duplicate detection using document IDs
- Optimized aggregate updates using Firestore increments
- Queue system for offline support

## Architecture

### Current Architecture

```
User Action → Pluggy API → Sequential Processing → Individual DB Writes → Aggregate Updates
```

Problems:
- Sequential processing causes delays
- Individual writes are slow (network round-trips)
- Aggregate updates use read-modify-write (slow)
- No retry logic for failures
- Poor error handling

### Optimized Architecture

```
User Action → Pluggy API → Batch Processing → Parallel DB Writes → Async Aggregate Updates
                              ↓
                         Retry Logic
                              ↓
                      Offline Queue (if needed)
```

Improvements:
- Batch processing reduces network overhead
- Parallel writes improve throughput
- Retry logic handles transient failures
- Async aggregates don't block saves
- Offline queue ensures data persistence

## Components and Interfaces

### 1. Transaction Batch Processor

**Purpose:** Process transactions in batches to optimize database writes

**Interface:**
```typescript
interface TransactionBatchProcessor {
  processBatch(
    userId: string,
    transactions: any[],
    accountInfo: any
  ): Promise<BatchResult>;
}

interface BatchResult {
  savedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  duration: number;
}
```

**Implementation:**
- Split transactions into batches of 50
- Process each batch in parallel (max 10 concurrent)
- Use Firestore batch writes where possible
- Track metrics for each batch

### 2. Retry Handler

**Purpose:** Implement exponential backoff retry logic for failed operations

**Interface:**
```typescript
interface RetryHandler {
  executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T>;
}

interface RetryOptions {
  maxRetries: number;      // Default: 3
  initialDelay: number;    // Default: 1000ms
  maxDelay: number;        // Default: 8000ms
  shouldRetry?: (error: any) => boolean;
}
```

**Implementation:**
- Exponential backoff: delay = min(initialDelay * 2^attempt, maxDelay)
- Skip retry for validation errors and duplicates
- Log all retry attempts with context

### 3. Duplicate Detector

**Purpose:** Efficiently detect duplicate transactions using Pluggy IDs

**Interface:**
```typescript
interface DuplicateDetector {
  isDuplicate(
    userId: string,
    transactionId: string,
    collection: string
  ): Promise<boolean>;
}
```

**Implementation:**
- Use Pluggy transaction ID as Firestore document ID
- Check existence with getDoc (single read)
- No need for queries or scans
- Cache results in memory for batch operations

### 4. Aggregate Updater

**Purpose:** Efficiently update monthly analytics using Firestore increments

**Interface:**
```typescript
interface AggregateUpdater {
  updateAggregates(
    userId: string,
    transactions: Transaction[],
    isNew: boolean[]
  ): Promise<void>;
}

interface AggregateUpdate {
  monthKey: string;
  checkingIncome: number;
  checkingExpense: number;
  creditTotal: number;
  categoryTotals: Record<string, number>;
}
```

**Implementation:**
- Group transactions by month
- Use Firestore increment() for atomic updates
- Process asynchronously (don't block transaction saves)
- Handle errors gracefully (log but don't fail)

### 5. Offline Queue Manager

**Purpose:** Queue transactions when offline for later processing

**Interface:**
```typescript
interface OfflineQueueManager {
  enqueue(operation: QueuedOperation): Promise<void>;
  processQueue(): Promise<QueueResult>;
  getQueueSize(): Promise<number>;
}

interface QueuedOperation {
  id: string;
  type: 'transaction' | 'account';
  data: any;
  timestamp: number;
  retryCount: number;
}

interface QueueResult {
  processed: number;
  failed: number;
  remaining: number;
}
```

**Implementation:**
- Store queue in AsyncStorage
- Process on network reconnection
- Maintain FIFO order
- Limit queue size to 500 items

### 6. Performance Monitor

**Purpose:** Track and log performance metrics for optimization

**Interface:**
```typescript
interface PerformanceMonitor {
  startOperation(name: string): string;
  endOperation(operationId: string): void;
  logMetrics(): void;
}

interface PerformanceMetrics {
  operationName: string;
  duration: number;
  timestamp: number;
  itemCount?: number;
  avgTimePerItem?: number;
}
```

**Implementation:**
- Track operation start/end times
- Calculate durations and averages
- Log metrics in development mode
- Store metrics for analysis

## Data Models

### Enhanced Transaction Document

```typescript
interface EnhancedTransaction {
  // Existing fields
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category: string | null;
  
  // Account reference
  accountId: string;
  accountName: string | null;
  
  // Source metadata
  source: 'openfinance';
  pluggyTransactionId: string;
  pluggyAccountId: string;
  
  // Connector info
  connector: {
    id: string;
    name: string;
    imageUrl: string;
    primaryColor: string;
  } | null;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  syncedAt: string;
  
  // New: Processing metadata
  processingMetadata?: {
    batchId: string;
    processingTime: number;
    retryCount: number;
  };
}
```

### Batch Processing State

```typescript
interface BatchProcessingState {
  batchId: string;
  userId: string;
  totalTransactions: number;
  processedCount: number;
  savedCount: number;
  skippedCount: number;
  errorCount: number;
  startTime: number;
  endTime?: number;
  errors: Array<{
    transactionId: string;
    error: string;
    timestamp: number;
  }>;
}
```

### Sync Operation Result

```typescript
interface SyncOperationResult {
  success: boolean;
  savedCount: number;
  skippedCount: number;
  errorCount: number;
  duration: number;
  details: {
    checkingTransactions: number;
    creditCardTransactions: number;
    savingsAccountTransactions: number;
    errors: string[];
  };
  performance: {
    avgTimePerTransaction: number;
    totalDbWrites: number;
    avgDbWriteTime: number;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Batch Processing Preserves Transaction Accounting

*For any* list of transactions, processing them in batches of 50 should result in savedCount + skippedCount + errorCount = total transaction count, with the same final database state as sequential processing.

**Validates: Requirements 2.1**

### Property 2: Parallel Processing Maintains Data Integrity

*For any* set of independent accounts or transactions processed in parallel, the final database state should be equivalent to processing them sequentially, with no data corruption or race conditions.

**Validates: Requirements 1.4, 2.5**

### Property 3: Concurrency Limit is Respected

*For any* batch of database operations, at no point during execution should there be more than 10 concurrent write operations in flight.

**Validates: Requirements 2.6**

### Property 4: Retry Logic with Exponential Backoff

*For any* retryable operation that fails, the system should retry up to 3 times with delays following the pattern 1s, 2s, 4s (exponential backoff), and either succeed or fail definitively after exhausting retries.

**Validates: Requirements 3.1, 6.1, 6.2, 6.3**

### Property 5: Validation Rejects Invalid Transactions

*For any* transaction missing required fields (id, amount, date, accountId) or with invalid data formats, the validation should reject it, skip the save operation, and log a validation error.

**Validates: Requirements 3.3, 11.1, 11.2, 11.3, 11.4, 11.5**

### Property 6: Duplicate Detection and Handling

*For any* transaction with a Pluggy ID that already exists in the database, the system should skip the save operation, increment the skipped counter, not update aggregates, and preserve the original creation timestamp if updating.

**Validates: Requirements 3.4, 4.2, 4.3, 4.4, 4.5**

### Property 7: Successful Save Returns Transaction ID

*For any* transaction that is successfully saved to the database, the operation should return a success response containing the transaction ID.

**Validates: Requirements 3.5**

### Property 8: Network Errors Trigger Offline Queue

*For any* transaction save operation that fails due to a network error, the system should add the transaction to the offline queue for later processing.

**Validates: Requirements 3.6, 9.1**

### Property 9: Error Isolation in Batch Processing

*For any* batch of transactions where some fail, the system should continue processing the remaining transactions, collect all errors, and return results for all attempted operations with proper error categorization.

**Validates: Requirements 5.3, 5.4, 5.6**

### Property 10: Retry Skip for Non-Retryable Errors

*For any* operation that fails due to validation errors or duplicate detection, the system should not retry the operation.

**Validates: Requirements 6.5**

### Property 11: Retry Counter Reset on Success

*For any* operation that succeeds after one or more retries, the retry counter should be reset to zero for subsequent operations.

**Validates: Requirements 6.4**

### Property 12: Aggregate Updates Only for New Transactions

*For any* set of transactions in a given month, the system should update monthly aggregates only for new transactions (not duplicates), with the sum of aggregate updates equaling the sum of new transaction amounts, and aggregate failures should not fail transaction saves.

**Validates: Requirements 8.2, 8.3, 8.5**

### Property 13: Offline Queue FIFO Order

*For any* sequence of transactions queued while offline, processing the queue should save transactions in the same order they were queued (FIFO), and successfully saved transactions should be removed from the queue.

**Validates: Requirements 9.2, 9.3, 9.4**

### Property 14: Queue Size Limit

*For any* offline queue, the number of queued transactions should never exceed 500 items.

**Validates: Requirements 9.5**

### Property 15: Performance Monitoring Completeness

*For any* sync operation, the performance monitor should record start timestamp, end timestamp, duration (endTime - startTime), average time per transaction (totalTime / transactionCount), and database write count and duration.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 16: Connector Logo Caching

*For any* connector displayed multiple times, the logo URL should be generated exactly once and cached, with all subsequent displays using the cached URL, resulting in at most one URL generation per unique connector ID.

**Validates: Requirements 12.1, 12.2, 12.3**

## Error Handling

### Error Categories

1. **Network Errors** (Retryable)
   - Connection timeout
   - DNS resolution failure
   - Network unavailable
   - Action: Retry with exponential backoff

2. **API Errors** (Conditionally Retryable)
   - 429 Rate Limit: Retry with backoff
   - 500 Server Error: Retry with backoff
   - 401 Unauthorized: Don't retry, re-authenticate
   - 400 Bad Request: Don't retry, log error

3. **Database Errors** (Retryable)
   - Write timeout
   - Quota exceeded
   - Temporary unavailable
   - Action: Retry with exponential backoff

4. **Validation Errors** (Not Retryable)
   - Missing required fields
   - Invalid data format
   - Action: Skip transaction, log error

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  errorCategory: 'network' | 'api' | 'database' | 'validation';
  retryable: boolean;
  context: {
    operation: string;
    transactionId?: string;
    accountId?: string;
    timestamp: number;
  };
}
```

### Error Logging

All errors should be logged with:
- Error message and stack trace
- Operation context (what was being attempted)
- Timestamp
- User ID (for support)
- Transaction/Account IDs (if applicable)

## Testing Strategy

### Unit Tests

1. **Batch Processor Tests**
   - Test batch splitting (51 transactions → 2 batches)
   - Test empty batch handling
   - Test batch size limits

2. **Retry Handler Tests**
   - Test exponential backoff timing
   - Test max retry limit
   - Test retry skip for validation errors

3. **Duplicate Detector Tests**
   - Test duplicate detection with existing ID
   - Test new transaction detection
   - Test cache behavior

4. **Aggregate Updater Tests**
   - Test monthly grouping
   - Test increment calculations
   - Test category totals

5. **Validation Tests**
   - Test missing ID rejection
   - Test invalid amount rejection
   - Test invalid date format rejection

### Property-Based Tests

Each correctness property should be implemented as a property-based test with minimum 100 iterations:

1. **Property 1 Test**: Generate random transaction lists, process in batches, verify counts
2. **Property 2 Test**: Generate transactions with duplicate IDs, verify single save
3. **Property 3 Test**: Generate operations with random failures, verify retry behavior
4. **Property 4 Test**: Generate transactions, verify aggregate sums match
5. **Property 5 Test**: Generate transaction sequences, verify queue order
6. **Property 6 Test**: Generate invalid transactions, verify rejection
7. **Property 7 Test**: Generate independent transactions, verify parallel processing
8. **Property 8 Test**: Generate batches with errors, verify continued processing
9. **Property 9 Test**: Generate operations, verify performance tracking
10. **Property 10 Test**: Generate connectors, verify logo caching

### Integration Tests

1. **End-to-End Sync Test**
   - Connect mock bank account
   - Fetch mock transactions
   - Verify all transactions saved
   - Verify aggregates updated
   - Verify performance metrics logged

2. **Offline Queue Test**
   - Simulate offline state
   - Queue transactions
   - Simulate online state
   - Verify queue processing
   - Verify correct order

3. **Error Recovery Test**
   - Simulate network failures
   - Verify retry attempts
   - Verify eventual success or failure
   - Verify error logging

### Performance Tests

1. **Batch Processing Performance**
   - Measure time to process 100 transactions
   - Target: < 10 seconds
   - Verify batch optimization

2. **Parallel Processing Performance**
   - Measure time with sequential vs parallel
   - Target: 50% improvement with parallel
   - Verify no race conditions

3. **Aggregate Update Performance**
   - Measure time for aggregate updates
   - Target: < 1 second for 100 transactions
   - Verify async execution

## Implementation Notes

### Firestore Batch Writes

Firestore batch writes have a limit of 500 operations per batch. Our design uses batches of 50 transactions to stay well under this limit and allow for additional operations (aggregate updates, etc.).

### Parallel Processing Limits

We limit concurrent database writes to 10 to avoid:
- Rate limiting from Firestore
- Memory pressure on the device
- Network congestion

### Exponential Backoff Formula

```
delay = min(initialDelay * 2^attempt, maxDelay)
```

Example with initialDelay=1000ms, maxDelay=8000ms:
- Attempt 1: 1000ms
- Attempt 2: 2000ms
- Attempt 3: 4000ms
- Attempt 4: 8000ms (capped)

### Offline Queue Storage

The offline queue is stored in AsyncStorage with a key format:
```
@pluggy_queue:{userId}
```

Queue items are stored as JSON array with metadata:
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "transaction",
      "data": {...},
      "timestamp": 1234567890,
      "retryCount": 0
    }
  ],
  "version": 1
}
```

### Performance Monitoring in Production

In production, performance metrics should be:
- Aggregated locally
- Sent to analytics service periodically
- Used to identify performance regressions
- Monitored for SLA compliance

Target SLAs:
- Bank connection: < 10 seconds (p95)
- Transaction batch save: < 5 seconds per 50 transactions (p95)
- Sync operation: < 30 seconds for 200 transactions (p95)

## Migration Strategy

### Phase 1: Add New Functions (No Breaking Changes)

1. Create new batch processing functions
2. Create retry handler utility
3. Create performance monitor
4. Keep existing functions unchanged

### Phase 2: Update saveOpenFinanceTransactions

1. Modify to use batch processing
2. Add retry logic
3. Add performance monitoring
4. Maintain backward compatibility

### Phase 3: Optimize Aggregate Updates

1. Change to async execution
2. Use Firestore increments
3. Add error handling

### Phase 4: Add Offline Queue

1. Implement queue manager
2. Integrate with existing sync flow
3. Add queue UI indicators

### Rollback Plan

If issues occur:
1. Feature flag to disable batch processing
2. Revert to sequential processing
3. Keep retry logic (safe improvement)
4. Keep performance monitoring (observability)

## Security Considerations

1. **Data Validation**: All transaction data from Pluggy must be validated before saving
2. **User Isolation**: All database operations must include userId to prevent cross-user data access
3. **Error Messages**: Don't expose sensitive data in error messages
4. **Logging**: Sanitize logs to remove PII (account numbers, etc.)
5. **Queue Security**: Encrypt offline queue data in AsyncStorage

## Accessibility Considerations

1. **Loading States**: Screen readers should announce sync progress
2. **Error Messages**: Error messages should be clear and actionable
3. **Progress Indicators**: Visual progress should have text alternatives
4. **Success Feedback**: Success messages should be announced to screen readers
