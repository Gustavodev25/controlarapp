/**
 * Unit tests for Pluggy Optimization Utilities
 */

import { categorizeError, RetryHandler, splitIntoBatches, validateTransaction } from '../pluggyOptimization';

describe('Pluggy Optimization Utilities', () => {
  describe('splitIntoBatches', () => {
    it('should split array into batches of specified size', () => {
      const items = [1, 2, 3, 4, 5];
      const batches = splitIntoBatches(items, 2);
      
      expect(batches).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      const batches = splitIntoBatches([], 2);
      expect(batches).toEqual([]);
    });

    it('should handle batch size larger than array', () => {
      const items = [1, 2, 3];
      const batches = splitIntoBatches(items, 10);
      
      expect(batches).toEqual([[1, 2, 3]]);
    });

    it('should handle batch size of 1', () => {
      const items = [1, 2, 3];
      const batches = splitIntoBatches(items, 1);
      
      expect(batches).toEqual([[1], [2], [3]]);
    });

    it('should throw error for invalid batch size', () => {
      expect(() => splitIntoBatches([1, 2, 3], 0)).toThrow('Batch size must be greater than 0');
      expect(() => splitIntoBatches([1, 2, 3], -1)).toThrow('Batch size must be greater than 0');
    });

    it('should handle exactly divisible array', () => {
      const items = [1, 2, 3, 4, 5, 6];
      const batches = splitIntoBatches(items, 3);
      
      expect(batches).toEqual([[1, 2, 3], [4, 5, 6]]);
    });
  });

  describe('validateTransaction', () => {
    it('should validate a valid transaction', () => {
      const transaction = {
        id: 'tx-123',
        amount: 100.50,
        date: '2024-01-15T10:30:00Z',
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject transaction without ID', () => {
      const transaction = {
        amount: 100.50,
        date: '2024-01-15T10:30:00Z',
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction ID is required');
    });

    it('should reject transaction with invalid amount', () => {
      const transaction = {
        id: 'tx-123',
        amount: 'invalid',
        date: '2024-01-15T10:30:00Z',
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction amount must be a valid number');
    });

    it('should reject transaction with NaN amount', () => {
      const transaction = {
        id: 'tx-123',
        amount: NaN,
        date: '2024-01-15T10:30:00Z',
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction amount must be a valid number');
    });

    it('should reject transaction without date', () => {
      const transaction = {
        id: 'tx-123',
        amount: 100.50,
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction date is required');
    });

    it('should reject transaction with invalid date format', () => {
      const transaction = {
        id: 'tx-123',
        amount: 100.50,
        date: '15/01/2024',
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction date must be in ISO 8601 format');
    });

    it('should accept date in YYYY-MM-DD format', () => {
      const transaction = {
        id: 'tx-123',
        amount: 100.50,
        date: '2024-01-15',
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(true);
    });

    it('should accept date in full ISO 8601 format', () => {
      const transaction = {
        id: 'tx-123',
        amount: 100.50,
        date: '2024-01-15T10:30:00.123Z',
        accountId: 'acc-456'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(true);
    });

    it('should reject transaction without accountId', () => {
      const transaction = {
        id: 'tx-123',
        amount: 100.50,
        date: '2024-01-15T10:30:00Z'
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction accountId is required');
    });

    it('should reject null transaction', () => {
      const result = validateTransaction(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction ID is required');
    });

    it('should reject undefined transaction', () => {
      const result = validateTransaction(undefined);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Transaction ID is required');
    });
  });

  describe('categorizeError', () => {
    it('should categorize network errors as retryable', () => {
      const error = new Error('network timeout');
      const result = categorizeError(error);

      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('should categorize ECONNREFUSED as network error', () => {
      const error = { message: 'ECONNREFUSED', code: 'ECONNREFUSED' };
      const result = categorizeError(error);

      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('should categorize ETIMEDOUT as network error', () => {
      const error = { message: 'ETIMEDOUT', code: 'ETIMEDOUT' };
      const result = categorizeError(error);

      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('should categorize rate limit errors as retryable API errors', () => {
      const error = { message: 'Too many requests', code: '429' };
      const result = categorizeError(error);

      expect(result.category).toBe('api');
      expect(result.retryable).toBe(true);
    });

    it('should categorize 500 errors as retryable API errors', () => {
      const error = { message: 'Internal server error', code: '500' };
      const result = categorizeError(error);

      expect(result.category).toBe('api');
      expect(result.retryable).toBe(true);
    });

    it('should categorize 401 errors as non-retryable API errors', () => {
      const error = { message: 'Unauthorized', code: '401' };
      const result = categorizeError(error);

      expect(result.category).toBe('api');
      expect(result.retryable).toBe(false);
    });

    it('should categorize 400 errors as non-retryable API errors', () => {
      const error = { message: 'Bad request', code: '400' };
      const result = categorizeError(error);

      expect(result.category).toBe('api');
      expect(result.retryable).toBe(false);
    });

    it('should categorize Firestore errors as retryable database errors', () => {
      const error = { message: 'firestore unavailable', code: 'unavailable' };
      const result = categorizeError(error);

      expect(result.category).toBe('database');
      expect(result.retryable).toBe(true);
    });

    it('should categorize quota exceeded as retryable database error', () => {
      const error = { message: 'quota exceeded', code: 'resource-exhausted' };
      const result = categorizeError(error);

      expect(result.category).toBe('database');
      expect(result.retryable).toBe(true);
    });

    it('should categorize validation errors as non-retryable', () => {
      const error = new Error('validation failed: amount is required');
      const result = categorizeError(error);

      expect(result.category).toBe('validation');
      expect(result.retryable).toBe(false);
    });

    it('should categorize invalid field errors as validation errors', () => {
      const error = new Error('Field must be a number');
      const result = categorizeError(error);

      expect(result.category).toBe('validation');
      expect(result.retryable).toBe(false);
    });

    it('should default unknown errors to non-retryable API errors', () => {
      const error = new Error('Unknown error');
      const result = categorizeError(error);

      expect(result.category).toBe('api');
      expect(result.retryable).toBe(false);
    });

    it('should preserve original error', () => {
      const error = new Error('Test error');
      const result = categorizeError(error);

      expect(result.originalError).toBe(error);
    });

    it('should handle string errors', () => {
      const result = categorizeError('network timeout');

      expect(result.category).toBe('network');
      expect(result.message).toBe('network timeout');
    });

    it('should handle errors without message', () => {
      const error = { code: '500' };
      const result = categorizeError(error);

      expect(result.category).toBe('api');
      expect(result.message).toBeTruthy();
    });
  });

  describe('RetryHandler', () => {
    let retryHandler: RetryHandler;

    beforeEach(() => {
      retryHandler = new RetryHandler();
      jest.clearAllMocks();
    });

    it('should execute operation successfully on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(retryHandler.getRetryCount()).toBe(0);
    });

    it('should retry on network error and succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      const result = await retryHandler.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(retryHandler.getRetryCount()).toBe(0); // Reset on success
    });

    it('should use exponential backoff delays', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await retryHandler.executeWithRetry(operation, {
        initialDelay: 100,
        maxDelay: 1000
      });
      const duration = Date.now() - startTime;

      // Should wait ~100ms + ~200ms = ~300ms total
      expect(duration).toBeGreaterThanOrEqual(250);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maxRetries limit', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network timeout'));

      await expect(
        retryHandler.executeWithRetry(operation, { maxRetries: 2, initialDelay: 10 })
      ).rejects.toThrow('network timeout');

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry validation errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('validation failed: amount is required'));

      await expect(
        retryHandler.executeWithRetry(operation)
      ).rejects.toThrow('validation failed');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should not retry duplicate errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('duplicate transaction'));

      await expect(
        retryHandler.executeWithRetry(operation)
      ).rejects.toThrow('duplicate transaction');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should respect maxDelay cap', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await retryHandler.executeWithRetry(operation, {
        initialDelay: 1000,
        maxDelay: 2000,
        maxRetries: 3
      });
      const duration = Date.now() - startTime;

      // Delays: 1000ms, 2000ms (capped), 2000ms (capped) = ~5000ms total
      expect(duration).toBeGreaterThanOrEqual(4500);
      expect(duration).toBeLessThan(6000);
    }, 10000); // Increase timeout to 10 seconds

    it('should use custom shouldRetry function', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('custom error'));
      const shouldRetry = jest.fn().mockReturnValue(false);

      await expect(
        retryHandler.executeWithRetry(operation, { shouldRetry })
      ).rejects.toThrow('custom error');

      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should reset retry counter after successful operation', async () => {
      const operation1 = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      await retryHandler.executeWithRetry(operation1);
      expect(retryHandler.getRetryCount()).toBe(0);

      const operation2 = jest.fn().mockResolvedValue('success');
      await retryHandler.executeWithRetry(operation2);
      expect(retryHandler.getRetryCount()).toBe(0);
    });

    it('should handle API rate limit errors with retry', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({ message: 'Too many requests', code: '429' })
        .mockResolvedValueOnce('success');

      const result = await retryHandler.executeWithRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry 401 unauthorized errors', async () => {
      const operation = jest.fn().mockRejectedValue({ message: 'Unauthorized', code: '401' });

      await expect(
        retryHandler.executeWithRetry(operation)
      ).rejects.toEqual({ message: 'Unauthorized', code: '401' });

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry database errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({ message: 'firestore unavailable', code: 'unavailable' })
        .mockResolvedValueOnce('success');

      const result = await retryHandler.executeWithRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should track retry count during retries', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      let retryCountDuringExecution = 0;
      const wrappedOperation = async () => {
        retryCountDuringExecution = retryHandler.getRetryCount();
        return operation();
      };

      await retryHandler.executeWithRetry(wrappedOperation, { initialDelay: 10 });

      expect(retryHandler.getRetryCount()).toBe(0); // Reset after success
    });

    it('should handle default options correctly', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      const result = await retryHandler.executeWithRetry(operation);

      expect(result).toBe('success');
      // Default maxRetries is 3, initialDelay is 1000ms
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should manually reset retry counter', () => {
      retryHandler['retryCount'] = 5;
      expect(retryHandler.getRetryCount()).toBe(5);

      retryHandler.resetRetryCount();
      expect(retryHandler.getRetryCount()).toBe(0);
    });

    it('should log errors after exhausting retries', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const operation = jest.fn().mockRejectedValue(new Error('network timeout'));

      await expect(
        retryHandler.executeWithRetry(operation, { maxRetries: 2, initialDelay: 10 })
      ).rejects.toThrow('network timeout');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed after 2 retries'),
        expect.objectContaining({
          category: 'network',
          attempts: 3
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it('should log retry attempts', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      await retryHandler.executeWithRetry(operation, { initialDelay: 10 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retry attempt 1/3'),
        expect.objectContaining({
          category: 'network'
        })
      );

      consoleLogSpy.mockRestore();
    });
  });
});

