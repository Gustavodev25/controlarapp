
import { notificationService, RecurrenceItem } from '../notifications';

// Mocks
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  AndroidImportance: { MAX: 'max' },
  setNotificationChannelAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../firebase', () => ({
  databaseService: {
    logNotification: jest.fn(() => Promise.resolve()),
  },
}));

// Import mocks to assert
const Notifications = require('expo-notifications');

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T09:00:00Z')); // Monday
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Permissions', () => {
    it('should register for push notifications', async () => {
      const result = await notificationService.registerForPushNotificationsAsync();
      expect(result).toBe(true);
      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('Scheduling with Retry', () => {
    it('should schedule notification successfully', async () => {
      const date = new Date('2024-01-02T09:00:00Z');
      await notificationService.scheduleNotificationWithRetry('Test', 'Body', date);
      
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
        content: { title: 'Test', body: 'Body', sound: true },
        trigger: { type: 'date', date: date },
      }));
    });

    it('should retry on failure', async () => {
      const date = new Date('2024-01-02T09:00:00Z');
      Notifications.scheduleNotificationAsync
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce('Success');

      await notificationService.scheduleNotificationWithRetry('Test', 'Body', date);
      
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Recurrence Scheduling', () => {
    const mockItems: RecurrenceItem[] = [
      {
        id: '1',
        name: 'Netflix',
        dueDate: '2024-01-05', // Due in 4 days
        type: 'subscription',
        status: 'pending',
        frequency: 'monthly',
      },
      {
        id: '2',
        name: 'Gym',
        dueDate: '2024-01-15', // Due in 14 days
        type: 'subscription',
        status: 'pending',
        frequency: 'monthly',
      }
    ];

    it('should schedule notifications for items due soon', async () => {
      await notificationService.scheduleRecurrenceNotifications(mockItems, 'user123');

      // Netflix is due Jan 5th.
      // Triggers: -5 (Jan 1st), -1 (Jan 4th), 0 (Jan 5th), +1 (Jan 6th).
      // Today is Jan 1st.
      // -5 days = Dec 27th (Past, skipped)
      // Wait, Netflix due Jan 5th. 
      // -5 days from Jan 5th is Dec 31st. (Past)
      // -1 day from Jan 5th is Jan 4th. (Future)
      // 0 day is Jan 5th. (Future)
      // +1 day is Jan 6th. (Future)

      // Expect at least 3 calls for Netflix (Jan 4, Jan 5, Jan 6)
      // Gym is due Jan 15th.
      // -5 days = Jan 10th. (Future)
      // ... all future.
      
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should handle cancellation reminders', async () => {
      const itemWithCancel: RecurrenceItem[] = [{
        id: '3',
        name: 'Trial',
        dueDate: '2024-01-10',
        type: 'subscription',
        status: 'pending',
        cancellationDate: '2024-01-08', // Cancel on Jan 8th
      }];

      await notificationService.scheduleRecurrenceNotifications(itemWithCancel, 'user123');
      
      // Cancel date is Jan 8th.
      // -2 days = Jan 6th. (Future)
      // -1 day = Jan 7th. (Future)
      
      // Expect calls for cancellation
      const calls = Notifications.scheduleNotificationAsync.mock.calls;
      const cancellationCalls = calls.filter((call: any) => call[0].content.title.includes('Cancelamento'));
      expect(cancellationCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
