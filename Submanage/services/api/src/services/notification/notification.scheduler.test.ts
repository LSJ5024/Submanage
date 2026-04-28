import { NotificationScheduler } from './notification.scheduler.js';
import { NotificationDispatcher } from './notification.dispatcher.js';
import { prisma } from '../../lib/prisma.js';

jest.mock('../../lib/prisma.js', () => ({ prisma: { subscription: { findMany: jest.fn() } } }));
jest.mock('./notification.dispatcher.js');

const MockedDispatcher = NotificationDispatcher as jest.MockedClass<typeof NotificationDispatcher>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('NotificationScheduler', () => {
  let scheduler: NotificationScheduler;
  let mockDispatcher: jest.Mocked<NotificationDispatcher>;

  beforeEach(() => {
    MockedDispatcher.mockClear();
    scheduler = new NotificationScheduler();
    mockDispatcher = MockedDispatcher.mock.instances[0] as jest.Mocked<NotificationDispatcher>;
    mockDispatcher.dispatch = jest.fn().mockResolvedValue(undefined);
  });

  describe('runDailyCheck()', () => {
    it('D-3 결제 예정 구독에 알림을 발송한다', async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3);

      (mockPrisma.subscription.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sub-1',
          service_name: 'Netflix',
          amount: 17000,
          next_billing_date: targetDate,
          user: { id: 'user-1', email: 'test@test.com', phone_number: null },
        },
      ]);

      await scheduler.runDailyCheck();

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          subscriptionId: 'sub-1',
          title: expect.stringContaining('Netflix'),
        }),
      );
    });

    it('결제 예정 구독이 없으면 알림을 발송하지 않는다', async () => {
      (mockPrisma.subscription.findMany as jest.Mock).mockResolvedValue([]);

      await scheduler.runDailyCheck();

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('전화번호가 없으면 SMS 알림을 발송하지 않는다', async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3);

      (mockPrisma.subscription.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sub-2',
          service_name: 'Spotify',
          amount: 10900,
          next_billing_date: targetDate,
          user: { id: 'user-2', email: 'test2@test.com', phone_number: null },
        },
      ]);

      await scheduler.runDailyCheck();

      const smsCalls = (mockDispatcher.dispatch as jest.Mock).mock.calls.filter(
        (call: [{ channel: string }]) => call[0].channel === 'SMS',
      );
      expect(smsCalls).toHaveLength(0);
    });
  });
});
