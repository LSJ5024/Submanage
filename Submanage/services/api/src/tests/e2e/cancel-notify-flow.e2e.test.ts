/**
 * E2E 테스트: 구독 탐지 → D-3 알림 발송 → 해지 안내 플로우 (TASK-050)
 */

import { NotificationScheduler } from '../../services/notification/notification.scheduler.js';
import { NotificationDispatcher } from '../../services/notification/notification.dispatcher.js';

jest.mock('../../lib/prisma.js');
jest.mock('../../services/notification/notification.dispatcher.js');
jest.mock('../../services/notification.service.js');

const { prisma } = require('../../lib/prisma.js');
const MockedDispatcher = NotificationDispatcher as jest.MockedClass<typeof NotificationDispatcher>;

describe('E2E: D-3 알림 스케줄러 → 발송 플로우 (FR-003)', () => {
  let scheduler: NotificationScheduler;
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    MockedDispatcher.mockClear();
    scheduler = new NotificationScheduler();
    mockDispatch = jest.fn().mockResolvedValue(undefined);
    (MockedDispatcher.mock.instances[0] as any).dispatch = mockDispatch;

    // 알림 서비스 opt-out mock (기본 전체 허용)
    const { NotificationService } = require('../../services/notification.service.js');
    (NotificationService as jest.Mock).mockImplementation(() => ({
      isChannelEnabled: jest.fn().mockResolvedValue(true),
      getSettings: jest.fn().mockResolvedValue({ pushEnabled: true, emailEnabled: true, smsEnabled: false }),
    }));
  });

  it('D-3 결제 예정 구독이 있으면 푸시 + 이메일 알림을 발송한다', async () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);

    prisma.subscription.findMany.mockResolvedValueOnce([{
      id: 'sub-1', service_name: 'Netflix', amount: 17000,
      next_billing_date: targetDate,
      user: { id: 'user-1', email: 'user@subtrack.app', phone_number: null },
    }]);

    await scheduler.runDailyCheck();

    // 푸시 + 이메일 2채널 발송 확인
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'PUSH', subscriptionId: 'sub-1' }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'EMAIL', email: 'user@subtrack.app' }),
    );
  });

  it('푸시 opt-out 사용자에게는 푸시를 발송하지 않는다', async () => {
    const { NotificationService } = require('../../services/notification.service.js');
    (NotificationService as jest.Mock).mockImplementation(() => ({
      isChannelEnabled: jest.fn().mockImplementation((_: string, channel: string) =>
        Promise.resolve(channel !== 'push'),
      ),
    }));

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);

    prisma.subscription.findMany.mockResolvedValueOnce([{
      id: 'sub-2', service_name: 'Spotify', amount: 10900,
      next_billing_date: targetDate,
      user: { id: 'user-2', email: 'optout@subtrack.app', phone_number: null },
    }]);

    scheduler = new NotificationScheduler();
    (MockedDispatcher.mock.instances[MockedDispatcher.mock.instances.length - 1] as any).dispatch = mockDispatch;
    await scheduler.runDailyCheck();

    const pushCalls = mockDispatch.mock.calls.filter((c: any[]) => c[0].channel === 'PUSH');
    expect(pushCalls).toHaveLength(0);
  });

  it('신규 구독 탐지 시 즉시 알림이 발송된다', async () => {
    await scheduler.notifyNewDetection('user-1', 'sub-new', 'Adobe CC', 28600);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        subscriptionId: 'sub-new',
        title: expect.stringContaining('탐지'),
        body: expect.stringContaining('Adobe CC'),
      }),
    );
  });

  it('D-3가 아닌 날짜(D-7)의 구독은 알림을 발송하지 않는다', async () => {
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + 7);

    prisma.subscription.findMany.mockResolvedValueOnce([{
      id: 'sub-far', service_name: 'Wavve', amount: 7900,
      next_billing_date: farDate,
      user: { id: 'user-1', email: 'user@subtrack.app', phone_number: null },
    }]);

    await scheduler.runDailyCheck();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
