import { notificationService } from '../services/notifications';

// Mocks
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(),
  },
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 'max' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/firebase', () => ({
  databaseService: {
    logNotification: jest.fn(() => Promise.resolve({ success: true })),
    getRecurrences: jest.fn(() => Promise.resolve({ success: true, data: [] })),
    getAccounts: jest.fn(() => Promise.resolve({ success: true, data: [] })),
    getSubscription: jest.fn(() => Promise.resolve({ success: true, data: null })),
  }
}));

describe('Notification Service - Payment Alerts', () => {
  let Notifications: any;
  let AsyncStorage: any;

  const buildScheduled = (id: string, category: string) => ({
    identifier: id,
    content: { data: { category }, title: `${category}-title` }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Notifications = require('expo-notifications');
    AsyncStorage = require('@react-native-async-storage/async-storage');

    const storage = new Map<string, string>();
    AsyncStorage.getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    AsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });

    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('should cancel only recurrence notifications when rescheduling recurrences', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      buildScheduled('recurrence-1', 'recurrence'),
      buildScheduled('invoice-1', 'invoice'),
      buildScheduled('plan-1', 'plan'),
    ]);

    await notificationService.scheduleRecurrenceNotifications([], 'user123');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('recurrence-1');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('invoice-1');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('plan-1');
  });

  it('should cancel only invoice notifications when rescheduling invoices', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      buildScheduled('invoice-1', 'invoice'),
      buildScheduled('sync-1', 'sync'),
    ]);

    await notificationService.scheduleInvoiceNotifications([], 'user123');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('invoice-1');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('sync-1');
  });

  it('should disable only payment alerts and preserve sync notifications', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      buildScheduled('recurrence-1', 'recurrence'),
      buildScheduled('invoice-1', 'invoice'),
      buildScheduled('plan-1', 'plan'),
      buildScheduled('sync-1', 'sync'),
    ]);

    await notificationService.disablePaymentAlerts();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('recurrence-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('invoice-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('plan-1');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('sync-1');
  });

  it('should schedule 5 plan notifications for active plan', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const plan = {
      status: 'active',
      nextBillingDate: dueDateStr,
      plan: 'pro',
    };

    await notificationService.schedulePlanNotifications(plan, 'user123');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(5);
    const calls = Notifications.scheduleNotificationAsync.mock.calls;
    const allPlanCategory = calls.every((call: any) => call[0].content.data?.category === 'plan');
    expect(allPlanCategory).toBe(true);
  });

  it('should send immediate overdue plan alert only once per day for past_due/expired', async () => {
    const plan = {
      status: 'past_due',
      nextBillingDate: new Date().toISOString().split('T')[0],
      plan: 'pro',
    };

    await notificationService.schedulePlanNotifications(plan, 'user123');
    await notificationService.schedulePlanNotifications(plan, 'user123');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const firstCall = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(firstCall.content.data?.category).toBe('plan');
    expect(firstCall.content.data?.triggerKey).toBe('expired_immediate');
  });

  it('should parse legacy date format with spaces when scheduling recurrence notifications', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');

    const items: any[] = [{
      id: 'legacy-1',
      name: 'Internet',
      dueDate: `${yyyy} - ${mm} - ${dd} `,
      type: 'reminder',
      status: 'pending',
      frequency: 'monthly',
    }];

    await notificationService.scheduleRecurrenceNotifications(items, 'user123');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });
});

describe('Notification Service - Sync Notifications', () => {
  let Notifications: any;
  let AsyncStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Notifications = require('expo-notifications');
    AsyncStorage = require('@react-native-async-storage/async-storage');
  });

  it('should schedule daily reset notification if not already scheduled', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);

    await notificationService.scheduleDailySyncResetNotification();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({
        data: expect.objectContaining({
          category: 'sync',
          triggerKey: 'daily_reset',
        })
      }),
      trigger: expect.objectContaining({
        type: 'daily',
        hour: 0,
        minute: 0
      })
    }));
  });
});
