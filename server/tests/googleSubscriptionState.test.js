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

const googleRouter = require('../api/google');

const {
  GOOGLE_PLAY_PRO_PRODUCT_ID,
  GOOGLE_PLAY_TRIAL_OFFER_ID,
  GOOGLE_PLAY_TRIAL_DAYS,
  obfuscateFirebaseUid,
  resolveGoogleSubscriptionState,
  validateGooglePlayServiceAccountIdentity,
} = googleRouter._test;

const DAY_MS = 24 * 60 * 60 * 1000;
const ORIGINAL_FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const ORIGINAL_FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;

afterEach(() => {
  if (ORIGINAL_FIREBASE_SERVICE_ACCOUNT === undefined) {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  } else {
    process.env.FIREBASE_SERVICE_ACCOUNT = ORIGINAL_FIREBASE_SERVICE_ACCOUNT;
  }

  if (ORIGINAL_FIREBASE_CLIENT_EMAIL === undefined) {
    delete process.env.FIREBASE_CLIENT_EMAIL;
  } else {
    process.env.FIREBASE_CLIENT_EMAIL = ORIGINAL_FIREBASE_CLIENT_EMAIL;
  }
});

function createPurchase({
  state = 'SUBSCRIPTION_STATE_ACTIVE',
  offerId = null,
  startTime = '2026-06-01T12:00:00.000Z',
  expiryTime = '2026-07-01T12:00:00.000Z',
  autoRenewEnabled = true,
} = {}) {
  return {
    subscriptionState: state,
    startTime,
    lineItems: [{
      productId: GOOGLE_PLAY_PRO_PRODUCT_ID,
      expiryTime,
      offerDetails: offerId ? { offerId } : {},
      autoRenewingPlan: { autoRenewEnabled },
    }],
  };
}

describe('Google Play subscription state', () => {
  test('recognizes an active seven-day free trial', () => {
    const nowMs = Date.parse('2026-06-03T12:00:00.000Z');
    const result = resolveGoogleSubscriptionState(createPurchase({
      offerId: GOOGLE_PLAY_TRIAL_OFFER_ID,
    }), nowMs);

    expect(result.hasPro).toBe(true);
    expect(result.status).toBe('trialing');
    expect(result.trialEndsMs).toBe(Date.parse('2026-06-01T12:00:00.000Z') + GOOGLE_PLAY_TRIAL_DAYS * DAY_MS);
  });

  test('keeps recognizing the legacy seven-day trial offer id', () => {
    const result = resolveGoogleSubscriptionState(createPurchase({
      offerId: 'pro-monthly-trial-7d',
    }), Date.parse('2026-06-03T12:00:00.000Z'));

    expect(result.hasPro).toBe(true);
    expect(result.status).toBe('trialing');
  });

  test('keeps access until expiration after auto-renewal is cancelled', () => {
    const result = resolveGoogleSubscriptionState(createPurchase({
      state: 'SUBSCRIPTION_STATE_CANCELED',
      autoRenewEnabled: false,
    }), Date.parse('2026-06-03T12:00:00.000Z'));

    expect(result.hasPro).toBe(true);
    expect(result.status).toBe('active');
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  test('blocks access while the subscription is on hold', () => {
    const result = resolveGoogleSubscriptionState(createPurchase({
      state: 'SUBSCRIPTION_STATE_ON_HOLD',
    }), Date.parse('2026-06-03T12:00:00.000Z'));

    expect(result.hasPro).toBe(false);
    expect(result.status).toBe('past_due');
  });

  test('uses a stable sha256 account identifier', () => {
    expect(obfuscateFirebaseUid('firebase-user-123')).toMatch(/^[a-f0-9]{64}$/);
    expect(obfuscateFirebaseUid('firebase-user-123')).toBe(obfuscateFirebaseUid('firebase-user-123'));
  });

  test('rejects Firebase Admin SDK credentials for Google Play', () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    delete process.env.FIREBASE_CLIENT_EMAIL;

    expect(() => validateGooglePlayServiceAccountIdentity(
      'firebase-adminsdk-test@controlarapp.iam.gserviceaccount.com'
    )).toThrow(/Firebase Admin SDK/);
  });

  test('rejects reusing the Firebase Admin client email for Google Play', () => {
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase-admin@controlarapp.iam.gserviceaccount.com';

    expect(() => validateGooglePlayServiceAccountIdentity(
      'firebase-admin@controlarapp.iam.gserviceaccount.com'
    )).toThrow(/same client_email/);
  });
});
