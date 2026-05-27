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
  buildReceiptRepairPreview,
  buildStoreKitRepairPreview,
  assertCanRepairAppleSubscription,
  resolveRepairCurrentSubscription,
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

  test('previews a receipt repair using the latest monthly Apple period', () => {
    const purchaseMs = Date.parse('2026-05-25T10:00:00.000Z');
    const expiresMs = Date.parse('2026-06-25T10:00:00.000Z');

    const preview = buildReceiptRepairPreview({
      result: { status: 0, environment: 'Production' },
      latestReceipt: {
        product_id: 'com.gustavodev25.controlarapp.pro.monthly',
        purchase_date_ms: String(purchaseMs),
        original_purchase_date_ms: String(purchaseMs),
        expires_date_ms: String(expiresMs),
        transaction_id: 'tx_apple_123',
        original_transaction_id: 'otx_apple_123',
      },
      renewalInfo: { auto_renew_status: '1' },
      nowMs: Date.parse('2026-05-26T12:00:00.000Z'),
    });

    expect(preview.source).toBe('receipt');
    expect(preview.hasPro).toBe(true);
    expect(preview.status).toBe('active');
    expect(preview.startedAt).toBe('2026-05-25T10:00:00.000Z');
    expect(preview.expiresAt).toBe('2026-06-25T10:00:00.000Z');
    expect(preview.transactionId).toBe('tx_apple_123');
    expect(preview.originalTransactionId).toBe('otx_apple_123');
  });

  test('previews a StoreKit repair with monthly fallback when expiresDate is absent', () => {
    const purchaseMs = Date.parse('2026-05-25T10:00:00.000Z');

    const preview = buildStoreKitRepairPreview({
      transactionPayload: {
        productId: 'com.gustavodev25.controlarapp.pro.monthly',
        purchaseDate: purchaseMs,
        transactionId: 'tx_storekit_123',
        originalTransactionId: 'otx_storekit_123',
      },
      purchase: {},
      nowMs: Date.parse('2026-05-26T12:00:00.000Z'),
    });

    expect(preview.source).toBe('storekit');
    expect(preview.hasPro).toBe(true);
    expect(preview.expiresMs).toBe(purchaseMs + APPLE_MONTHLY_FALLBACK_MS);
    expect(preview.appleExpirationFallbackApplied).toBe(true);
  });

  test('blocks overwriting an active non-Apple paid subscription by default', () => {
    expect(() => assertCanRepairAppleSubscription({
      currentSubscription: {
        plan: 'pro',
        status: 'active',
        provider: 'stripe',
      },
    })).toThrow(/Refusing to overwrite active stripe subscription/);

    expect(() => assertCanRepairAppleSubscription({
      currentSubscription: {
        plan: 'pro',
        status: 'active',
        provider: 'stripe',
      },
      allowProviderChange: true,
    })).not.toThrow();
  });

  test('uses profile.subscription Apple metadata when root subscription is still starter', () => {
    const selected = resolveRepairCurrentSubscription({
      subscription: {
        plan: 'starter',
        status: 'active',
      },
      profile: {
        subscription: {
          plan: 'pro',
          status: 'active',
          provider: 'apple',
          originalTransactionId: 'otx_profile_123',
        },
      },
    });

    expect(selected.originalTransactionId).toBe('otx_profile_123');
  });
});
