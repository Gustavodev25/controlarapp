/**
 * Pluggy Performance Optimization Utilities
 * 
 * This module provides utility functions for optimizing Pluggy (Open Finance) integration:
 * - Batch processing for efficient database writes
 * - Transaction validation
 * - Error categorization for proper retry logic
 * - Performance monitoring
 * - Retry handling with exponential backoff
 */

// ===== Batch Processing Utilities =====

/**
 * Split an array into batches of specified size
 * 
 * @param items - Array of items to split
 * @param batchSize - Size of each batch
 * @returns Array of batches
 * 
 * @example
 * splitIntoBatches([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  if (batchSize <= 0) {
    throw new Error('Batch size must be greater than 0');
  }

  if (items.length === 0) {
    return [];
  }

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches;
}

// ===== Transaction Validation =====

/**
 * Validate a transaction has all required fields
 * 
 * Requirements validated:
 * - Transaction ID must be present (Req 11.1)
 * - Amount must be a valid number (Req 11.2)
 * - Date must be in ISO 8601 format (Req 11.3)
 * - Account ID must be present (Req 11.4)
 * 
 * @param transaction - Transaction object to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateTransaction(transaction: any): { isValid: boolean; error?: string } {
  // Check transaction ID (Req 11.1)
  if (!transaction || !transaction.id) {
    return { isValid: false, error: 'Transaction ID is required' };
  }

  // Check amount is a valid number (Req 11.2)
  if (typeof transaction.amount !== 'number' || isNaN(transaction.amount) || !isFinite(transaction.amount)) {
    return { isValid: false, error: 'Transaction amount must be a valid number' };
  }

  // Check date is in ISO 8601 format (Req 11.3)
  if (!transaction.date) {
    return { isValid: false, error: 'Transaction date is required' };
  }

  // Validate ISO 8601 format (basic check for years 0000-9999)
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!iso8601Regex.test(transaction.date)) {
    return { isValid: false, error: 'Transaction date must be in ISO 8601 format' };
  }

  // Check account ID (Req 11.4)
  if (!transaction.accountId) {
    return { isValid: false, error: 'Transaction accountId is required' };
  }

  return { isValid: true };
}

// ===== Error Categorization =====

export type ErrorCategory = 'network' | 'api' | 'database' | 'validation';

export interface CategorizedError {
  category: ErrorCategory;
  retryable: boolean;
  message: string;
  originalError: any;
}

/**
 * Categorize an error to determine if it's retryable and what type it is
 * 
 * Error categories (Req 5.6):
 * - Network errors: Connection issues, timeouts, DNS failures (retryable)
 * - API errors: Rate limits, server errors (conditionally retryable)
 * - Database errors: Write timeouts, quota exceeded (retryable)
 * - Validation errors: Invalid data (not retryable)
 * 
 * @param error - Error object to categorize
 * @returns Categorized error with retry information
 */
export function categorizeError(error: any): CategorizedError {
  let errorMessage: string;
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error?.message) {
    errorMessage = error.message;
  } else {
    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = 'Unknown error';
    }
  }
  
  const errorCode = error?.code || '';

  // Network errors (retryable)
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('fetch failed') ||
    errorCode === 'NETWORK_ERROR'
  ) {
    return {
      category: 'network',
      retryable: true,
      message: errorMessage,
      originalError: error
    };
  }

  // API errors (conditionally retryable)
  if (
    errorCode === '429' || // Rate limit
    errorCode === '500' || // Server error
    errorCode === '502' || // Bad gateway
    errorCode === '503' || // Service unavailable
    errorCode === '504' || // Gateway timeout
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('server error')
  ) {
    return {
      category: 'api',
      retryable: errorCode !== '401' && errorCode !== '400', // Don't retry auth or bad request
      message: errorMessage,
      originalError: error
    };
  }

  // Database errors (retryable)
  if (
    errorMessage.includes('firestore') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('unavailable') ||
    errorCode === 'unavailable' ||
    errorCode === 'deadline-exceeded' ||
    errorCode === 'resource-exhausted'
  ) {
    return {
      category: 'database',
      retryable: true,
      message: errorMessage,
      originalError: error
    };
  }

  // Validation errors (not retryable)
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('required') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('must be')
  ) {
    return {
      category: 'validation',
      retryable: false,
      message: errorMessage,
      originalError: error
    };
  }

  // Default to API error (not retryable by default)
  return {
    category: 'api',
    retryable: false,
    message: errorMessage,
    originalError: error
  };
}

// ===== Retry Handler =====

export interface RetryOptions {
  maxRetries?: number;      // Default: 3
  initialDelay?: number;    // Default: 1000ms
  maxDelay?: number;        // Default: 8000ms
  shouldRetry?: (error: any) => boolean;
}

/**
 * Retry handler with exponential backoff
 * 
 * Implements retry logic for failed operations with exponential backoff:
 * - Retries up to maxRetries times (default: 3)
 * - Uses exponential backoff: delay = min(initialDelay * 2^attempt, maxDelay)
 * - Skips retry for validation and duplicate errors
 * - Resets retry counter on success
 * 
 * Requirements:
 * - 3.1: Retry failed operations up to 3 times
 * - 6.1: Retry network requests with exponential backoff starting at 1 second
 * - 6.2: Wait 2^attempt seconds before next retry (1s, 2s, 4s)
 * - 6.3: Fail after maximum retry count and log error
 * - 6.4: Reset retry counter on success
 * - 6.5: Don't retry validation errors or duplicates
 */
export class RetryHandler {
  private retryCount: number = 0;

  /**
   * Execute an operation with retry logic and exponential backoff
   * 
   * @param operation - Async operation to execute
   * @param options - Retry configuration options
   * @returns Result of the operation
   * @throws Error after all retries are exhausted
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const initialDelay = options?.initialDelay ?? 1000;
    const maxDelay = options?.maxDelay ?? 8000;
    const shouldRetry = options?.shouldRetry;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset retry counter on success (Req 6.4)
        this.retryCount = 0;
        
        return result;
      } catch (error) {
        lastError = error;

        // Categorize the error to determine if it's retryable
        const categorized = categorizeError(error);

        // Check if we should retry (Req 6.5: skip validation and duplicate errors)
        const shouldRetryError = shouldRetry 
          ? shouldRetry(error)
          : categorized.retryable;

        // If not retryable or we've exhausted retries, throw the error
        if (!shouldRetryError || attempt >= maxRetries) {
          // Log error after exhausting retries (Req 6.3)
          if (attempt >= maxRetries) {
            console.error(`[RetryHandler] Operation failed after ${maxRetries} retries:`, {
              error: categorized.message,
              category: categorized.category,
              attempts: attempt + 1
            });
          }
          throw error;
        }

        // Calculate exponential backoff delay (Req 6.1, 6.2)
        // Formula: delay = min(initialDelay * 2^attempt, maxDelay)
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

        console.log(`[RetryHandler] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: categorized.message,
          category: categorized.category
        });

        // Track retry count
        this.retryCount = attempt + 1;

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
  }

  /**
   * Get the current retry count
   * @returns Current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Reset the retry counter manually
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }

  /**
   * Sleep for a specified duration
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
