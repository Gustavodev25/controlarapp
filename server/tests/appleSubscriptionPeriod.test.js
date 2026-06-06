jest.mock('express', () => ({
  Router: () => ({
    get: jest.fn(),
    post: jest.fn(),
  }),
}), { virtual: true });

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
}), { virtual: true });

const appleRouter = require('../api/apple');

const {
  APPLE_MONTHLY_FALLBACK_MS,
  assertAppleAppAccountTokenMatches,
  getExpectedAppleAppAccountToken,
  inferAppleNotificationStatusCode,
  isAppleFreeTrial,
  resolveMonthlyEntitlementPeriod,
} = appleRouter._test;

describe('Apple subscription entitlement period', () => {
  test('uses the App Store expiration when it is present', () => {
    const purchaseMs = Date.parse('2026-05-22T12:00:00.000Z');
    const explicitExpiresMs = Date.parse('2026-06-22T12:00:00.000Z');

    const period = resolveMonthlyEntitlementPeriod({
      explicitExpiresMs,
      purchaseMs,
      nowMs: Date.parse('2026-05-24T12:00:00.000Z'),
    });

    expect(period.expiresMs).toBe(explicitExpiresMs);
    expect(period.periodStartMs).toBe(purchaseMs);
    expect(period.usedFallbackExpiration).toBe(false);
  });

  test('grants a monthly period for valid Apple purchases without an expiration date', () => {
    const purchaseMs = Date.parse('2026-05-22T12:00:00.000Z');

    const period = resolveMonthlyEntitlementPeriod({
      explicitExpiresMs: null,
      purchaseMs,
      nowMs: Date.parse('2026-05-24T12:00:00.000Z'),
    });

    expect(period.expiresMs).toBe(purchaseMs + APPLE_MONTHLY_FALLBACK_MS);
    expect(period.periodStartMs).toBe(purchaseMs);
    expect(period.usedFallbackExpiration).toBe(true);
  });

  test('falls back to the StoreKit signed date when purchase date is missing', () => {
    const signedMs = Date.parse('2026-05-22T12:00:00.000Z');

    const period = resolveMonthlyEntitlementPeriod({
      explicitExpiresMs: null,
      purchaseMs: null,
      signedMs,
      nowMs: Date.parse('2026-05-24T12:00:00.000Z'),
    });

    expect(period.expiresMs).toBe(signedMs + APPLE_MONTHLY_FALLBACK_MS);
    expect(period.periodStartMs).toBe(signedMs);
    expect(period.usedFallbackExpiration).toBe(true);
  });

  test('recognizes App Store free trials from receipts and StoreKit transactions', () => {
    expect(isAppleFreeTrial({ receipt: { is_trial_period: 'true' } })).toBe(true);
    expect(isAppleFreeTrial({ transactionPayload: { offerDiscountType: 'FREE_TRIAL' } })).toBe(true);
    expect(isAppleFreeTrial({ transactionPayload: { rawOfferDiscountType: 'free_trial' } })).toBe(true);
    expect(isAppleFreeTrial({ transactionPayload: { offerType: 1, offerIdentifier: 'intro-free-trial' } })).toBe(true);
    expect(isAppleFreeTrial({ purchase: { offerIOS: { paymentMode: 'freeTrial' } } })).toBe(true);
    expect(isAppleFreeTrial({ transactionPayload: { offerDiscountType: 'PAY_AS_YOU_GO' } })).toBe(false);
  });

  test('validates deterministic Apple app account tokens when StoreKit provides one', () => {
    const firebaseUid = 'firebase-user-123';
    const token = getExpectedAppleAppAccountToken(firebaseUid);

    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(assertAppleAppAccountTokenMatches(firebaseUid, { appAccountToken: token })).toBe(true);
    expect(assertAppleAppAccountTokenMatches(firebaseUid, {})).toBe(false);
    expect(() => {
      assertAppleAppAccountTokenMatches(firebaseUid, { appAccountToken: getExpectedAppleAppAccountToken('other-user') });
    }).toThrow('Apple transaction account token does not match the signed-in user');
  });

  test('infers App Store notification statuses for renewal lifecycle events', () => {
    expect(inferAppleNotificationStatusCode({ notificationType: 'DID_RENEW', data: {} }, {})).toBe(1);
    expect(inferAppleNotificationStatusCode({ notificationType: 'DID_FAIL_TO_RENEW', data: {} }, {})).toBe(3);
    expect(inferAppleNotificationStatusCode({ notificationType: 'EXPIRED', data: {} }, {})).toBe(2);
    expect(inferAppleNotificationStatusCode({ notificationType: 'REFUND', data: {} }, {})).toBe(5);
    expect(inferAppleNotificationStatusCode({ notificationType: 'DID_RENEW', data: { status: 4 } }, {})).toBe(4);
  });
});
