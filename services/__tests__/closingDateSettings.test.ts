import { createClosingDateUpdatePayload, validateClosingDateForMonth, validateClosingDay, validateMonthKey } from '../closingDateSettings';
import { CreditCardAccount } from '../invoiceBuilder';

describe('Closing Date Settings Service', () => {
  describe('Validation', () => {
    it('should validate closing day correctly', () => {
      expect(validateClosingDay(1)).toBe(true);
      expect(validateClosingDay(31)).toBe(true);
      expect(validateClosingDay(15)).toBe(true);
      
      expect(validateClosingDay(0)).toBe(false);
      expect(validateClosingDay(32)).toBe(false);
      expect(validateClosingDay(-5)).toBe(false);
      expect(validateClosingDay(15.5)).toBe(false);
    });

    it('should validate month key format', () => {
      expect(validateMonthKey('2026-01')).toBe(true);
      expect(validateMonthKey('2026-12')).toBe(true);
      
      expect(validateMonthKey('2026-1')).toBe(false); // Needs 2 digits
      expect(validateMonthKey('2026-13')).toBe(false);
      expect(validateMonthKey('2026/01')).toBe(false);
      expect(validateMonthKey('invalid')).toBe(false);
    });

    it('should validate closing date against month days', () => {
      // 31 days months
      expect(validateClosingDateForMonth(31, '2026-01').isValid).toBe(true);
      expect(validateClosingDateForMonth(31, '2026-03').isValid).toBe(true);
      
      // 30 days months
      expect(validateClosingDateForMonth(31, '2026-04').isValid).toBe(false);
      expect(validateClosingDateForMonth(30, '2026-04').isValid).toBe(true);
      
      // February
      expect(validateClosingDateForMonth(29, '2026-02').isValid).toBe(false); // 2026 is not leap year
      expect(validateClosingDateForMonth(28, '2026-02').isValid).toBe(true);
      
      // Leap year 2024
      expect(validateClosingDateForMonth(29, '2024-02').isValid).toBe(true);
    });
  });

  describe('Payload Generation', () => {
    const mockAccount: CreditCardAccount = {
        id: 'card1',
        type: 'credit',
        closingDateSettings: {
            closingDay: 10,
            applyToAll: true,
            updatedAt: '2026-01-01T00:00:00.000Z'
        }
    };

    it('should create payload for "Apply to All"', () => {
        const payload = createClosingDateUpdatePayload(mockAccount, 25, true);
        expect(payload).not.toBeNull();
        
        const nextSettings = payload!.closingDateSettings;
        expect(nextSettings.applyToAll).toBe(true);
        expect(nextSettings.closingDay).toBe(25);
        // Should preserve existing overrides if any? Or clear them?
        // Current implementation preserves spread ...currentSettings.
        // If applyToAll is true, overrides might still be relevant for past exceptions, 
        // but usually "Apply to all" establishes a new baseline.
        // The implementation spreads currentSettings, so monthOverrides are kept.
        
        expect(nextSettings.updatedAt).not.toBe(mockAccount.closingDateSettings?.updatedAt);
    });

    it('should create payload for single month override', () => {
        const payload = createClosingDateUpdatePayload(mockAccount, 20, false, '2026-05');
        expect(payload).not.toBeNull();
        
        const nextSettings = payload!.closingDateSettings;
        expect(nextSettings.monthOverrides).toBeDefined();
        expect(nextSettings.monthOverrides!['2026-05']).toBeDefined();
        expect(nextSettings.monthOverrides!['2026-05'].closingDay).toBe(20);
        
        // Ensure other settings are preserved
        expect(nextSettings.closingDay).toBe(10);
    });

    it('should fail if month key is missing for single month override', () => {
        const payload = createClosingDateUpdatePayload(mockAccount, 20, false, undefined);
        expect(payload).toBeNull();
    });

    it('should fail if date is invalid for the target month', () => {
        const payload = createClosingDateUpdatePayload(mockAccount, 31, false, '2026-02');
        expect(payload).toBeNull();
    });
  });
});
