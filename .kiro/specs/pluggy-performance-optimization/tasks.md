# Implementation Plan: Pluggy Performance Optimization

## Overview

This implementation plan optimizes the Pluggy (Open Finance) integration through batch processing, retry logic, parallel operations, and efficient database writes. The approach is incremental, starting with utility functions and building up to the complete optimized sync flow.

## Tasks

- [x] 1. Create utility functions and helpers
  - Create `services/pluggyOptimization.ts` with batch splitting, validation, and helper functions
  - Implement `splitIntoBatches(items: any[], batchSize: number)` function
  - Implement `validateTransaction(transaction: any)` function with all required field checks
  - Implement `categorizeError(error: any)` function to distinguish network/API/database/validation errors
  - _Requirements: 2.1, 3.3, 5.6, 11.1, 11.2, 11.3, 11.4_

- [x] 1.1 Write property test for batch splitting
  - **Property 1: Batch Processing Preserves Transaction Accounting**
  - **Validates: Requirements 2.1**

- [x] 1.2 Write property test for transaction validation
  - **Property 5: Validation Rejects Invalid Transactions**
  - **Validates: Requirements 3.3, 11.1, 11.2, 11.3, 11.4, 11.5**

- [x] 1.3 Write property test for error categorization
  - **Property 9: Error Isolation in Batch Processing**
  - **Validates: Requirements 5.3, 5.4, 5.6**

- [x] 2. Implement retry handler with exponential backoff
  - Create `RetryHandler` class in `services/pluggyOptimization.ts`
  - Implement `executeWithRetry<T>(operation: () => Promise<T>, options?: RetryOptions)` method
  - Implement exponential backoff formula: `delay = min(initialDelay * 2^attempt, maxDelay)`
  - Add retry skip logic for validation and duplicate errors
  - Add retry counter reset on success
  - _Requirements: 3.1, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2.1 Write property test for retry logic with exponential backoff
  - **Property 4: Retry Logic with Exponential Backoff**
  - **Validates: Requirements 3.1, 6.1, 6.2, 6.3**

- [x] 2.2 Write property test for retry skip logic
  - **Property 10: Retry Skip for Non-Retryable Errors**
  - **Validates: Requirements 6.5**

- [x] 2.3 Write property test for retry counter reset
  - **Property 11: Retry Counter Reset on Success**
  - **Validates: Requirements 6.4**

- [~] 3. Implement performance monitor
  - Create `PerformanceMonitor` class in `services/pluggyOptimization.ts`
  - Implement `startOperation(name: string): string` method to record start timestamp
  - Implement `endOperation(operationId: string): void` method to calculate duration
  - Implement `logMetrics(): void` method to log performance data in dev mode
  - Track operation count, total duration, and average time per item
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [~] 3.1 Write property test for performance monitoring
  - **Property 15: Performance Monitoring Completeness**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [~] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 5. Implement duplicate detector
  - Create `DuplicateDetector` class in `services/pluggyOptimization.ts`
  - Implement `isDuplicate(userId: string, transactionId: string, collection: string)` method
  - Use Firestore `getDoc()` with Pluggy ID as document ID
  - Add in-memory cache for batch operations to reduce Firestore reads
  - _Requirements: 3.4, 4.1, 4.2_

- [~] 5.1 Write property test for duplicate detection
  - **Property 6: Duplicate Detection and Handling**
  - **Validates: Requirements 3.4, 4.2, 4.3, 4.4, 4.5**

- [~] 6. Implement batch transaction processor
  - Create `TransactionBatchProcessor` class in `services/pluggyOptimization.ts`
  - Implement `processBatch(userId: string, transactions: any[], accountInfo: any)` method
  - Split transactions into batches of 50 using `splitIntoBatches()`
  - Process batches with concurrency limit of 10 using `Promise.all()` with chunking
  - Validate each transaction before processing
  - Check for duplicates before saving
  - Track savedCount, skippedCount, errorCount
  - Continue processing on errors (error isolation)
  - _Requirements: 2.1, 2.2, 2.6, 3.3, 3.4, 5.3, 5.4_

- [~] 6.1 Write property test for concurrency limit
  - **Property 3: Concurrency Limit is Respected**
  - **Validates: Requirements 2.6**

- [~] 6.2 Write property test for error isolation
  - **Property 9: Error Isolation in Batch Processing**
  - **Validates: Requirements 5.3, 5.4, 5.6**

- [~] 7. Implement aggregate updater
  - Create `AggregateUpdater` class in `services/pluggyOptimization.ts`
  - Implement `updateAggregates(userId: string, transactions: Transaction[], isNew: boolean[])` method
  - Group transactions by month key (YYYY-MM)
  - Use Firestore `increment()` for atomic updates
  - Update only for new transactions (not duplicates)
  - Execute asynchronously (don't block transaction saves)
  - Handle errors gracefully (log but don't fail)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [~] 7.1 Write property test for aggregate updates
  - **Property 12: Aggregate Updates Only for New Transactions**
  - **Validates: Requirements 8.2, 8.3, 8.5**

- [~] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 9. Implement offline queue manager
  - Create `OfflineQueueManager` class in `services/pluggyOptimization.ts`
  - Implement `enqueue(operation: QueuedOperation)` method to add to AsyncStorage
  - Implement `processQueue()` method to process queued operations on reconnect
  - Implement `getQueueSize()` method to check queue length
  - Maintain FIFO order using array structure
  - Limit queue size to 500 items
  - Remove successfully processed items from queue
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [~] 9.1 Write property test for offline queue FIFO order
  - **Property 13: Offline Queue FIFO Order**
  - **Validates: Requirements 9.2, 9.3, 9.4**

- [~] 9.2 Write property test for queue size limit
  - **Property 14: Queue Size Limit**
  - **Validates: Requirements 9.5**

- [~] 9.3 Write property test for network error queueing
  - **Property 8: Network Errors Trigger Offline Queue**
  - **Validates: Requirements 3.6, 9.1**

- [~] 10. Update saveAccount method for parallel processing
  - Modify `databaseService.saveAccount` in `services/firebase.ts`
  - Add retry logic using `RetryHandler`
  - Add performance monitoring using `PerformanceMonitor`
  - Add error logging with categorization
  - Return success confirmation with account ID
  - _Requirements: 1.2, 3.1, 3.5, 5.1, 5.2, 10.1_

- [~] 10.1 Write property test for successful save returns ID
  - **Property 7: Successful Save Returns Transaction ID**
  - **Validates: Requirements 3.5**

- [~] 11. Update saveOpenFinanceTransactions for batch processing
  - Modify `databaseService.saveOpenFinanceTransactions` in `services/firebase.ts`
  - Use `TransactionBatchProcessor` for batch processing
  - Process credit card and checking transactions in parallel
  - Use `RetryHandler` for failed operations
  - Use `PerformanceMonitor` to track sync duration
  - Use `AggregateUpdater` for monthly aggregates
  - Use `OfflineQueueManager` for network errors
  - Track and return detailed results (savedCount, skippedCount, errorCount, duration)
  - _Requirements: 2.1, 2.2, 2.5, 3.1, 3.6, 8.2, 9.1, 10.2_

- [~] 11.1 Write property test for parallel processing
  - **Property 2: Parallel Processing Maintains Data Integrity**
  - **Validates: Requirements 1.4, 2.5**

- [~] 12. Update saveOpenFinanceTransaction for optimization
  - Modify `databaseService.saveOpenFinanceTransaction` in `services/firebase.ts`
  - Add validation using `validateTransaction()`
  - Add duplicate check using `DuplicateDetector`
  - Add retry logic using `RetryHandler`
  - Skip aggregate updates for duplicates
  - Add error logging with categorization
  - Queue for offline sync on network errors
  - _Requirements: 3.3, 3.4, 4.2, 4.4, 5.2, 11.1, 11.2, 11.3, 11.4_

- [~] 13. Update saveOpenFinanceCreditCardTransaction for optimization
  - Modify `databaseService.saveOpenFinanceCreditCardTransaction` in `services/firebase.ts`
  - Add validation using `validateTransaction()`
  - Add duplicate check using `DuplicateDetector`
  - Add retry logic using `RetryHandler`
  - Skip aggregate updates for duplicates
  - Preserve original createdAt timestamp on updates
  - Add error logging with categorization
  - Queue for offline sync on network errors
  - _Requirements: 3.3, 3.4, 4.2, 4.3, 4.4, 5.2, 11.1, 11.2, 11.3, 11.4_

- [~] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 15. Optimize connector logo caching
  - Modify `normalizeConnectorForStorage` in `services/firebase.ts`
  - Add in-memory cache for connector logo URLs using Map
  - Generate logo URL once per connector ID
  - Reuse cached URL for subsequent calls
  - Add cache preloading on app startup
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [~] 15.1 Write property test for connector logo caching
  - **Property 16: Connector Logo Caching**
  - **Validates: Requirements 12.1, 12.2, 12.3**

- [~] 16. Add loading states and user feedback
  - Update Open Finance sync UI components
  - Add loading indicator with "Sincronizando..." text on sync start
  - Update progress with transaction count during processing
  - Display success message with saved count on completion
  - Display error message with failed count on errors
  - Hide loading indicator within 1 second of completion
  - _Requirements: 7.1, 7.3, 7.4, 7.6_

- [~] 16.1 Write unit tests for loading state UI
  - Test loading indicator display on sync start
  - Test success message display with correct count
  - Test error message display with correct count
  - _Requirements: 7.1, 7.3, 7.4_

- [~] 17. Add progress indicator for long operations
  - Update sync UI to show detailed progress for operations > 10 seconds
  - Display status updates during connection (e.g., "Conectando...", "Buscando contas...", "Salvando transações...")
  - Show progress percentage or transaction count
  - _Requirements: 1.5, 7.5_

- [~] 18. Integrate offline queue with network status
  - Update `NetworkContext` to trigger queue processing on reconnect
  - Call `OfflineQueueManager.processQueue()` when network becomes available
  - Display notification when queued transactions are being processed
  - Display success/error message after queue processing completes
  - _Requirements: 9.2_

- [~] 19. Add error logging and monitoring
  - Ensure all Pluggy API errors are logged with request details and timestamp
  - Ensure all database errors are logged with document ID and operation type
  - Ensure all validation errors are logged with transaction details
  - Add error tracking for manual recovery (failed after 3 retries)
  - _Requirements: 3.2, 5.1, 5.2, 11.5_

- [~] 19.1 Write unit tests for error logging
  - Test API error logging includes request details
  - Test database error logging includes document ID
  - Test validation error logging includes transaction details
  - _Requirements: 5.1, 5.2, 11.5_

- [~] 20. Final checkpoint - Integration testing
  - Test complete sync flow with mock Pluggy API
  - Test batch processing with 100+ transactions
  - Test retry logic with simulated failures
  - Test offline queue with network disconnect/reconnect
  - Test duplicate detection with repeated syncs
  - Test aggregate updates with multiple months
  - Test error handling with various error types
  - Verify performance improvements (measure sync duration)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- The implementation is backward compatible with existing code
- Performance monitoring helps identify bottlenecks
- Retry logic improves reliability for transient failures
- Batch processing significantly improves sync speed
