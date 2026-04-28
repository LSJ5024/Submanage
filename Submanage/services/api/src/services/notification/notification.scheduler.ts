import { NotificationChannel } from '@subtrack/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../middlewares/logger.js';
import { NotificationDispatcher } from './notification.dispatcher.js';
import { NotificationService } from '../notification.service.js';

const NOTIFY_DAYS_BEFORE = 3; // D-3 기준 (PRD §3.4)
const NOTIFY_HOUR = 10; // 오전 10시 발송

/**
 * NotificationScheduler — D-3 알림 스케줄러 (TASK-023)
 * Lambda Scheduler 또는 node-cron으로 매일 자정 호출됨.
 */
export class NotificationScheduler {
  private readonly dispatcher = new NotificationDispatcher();
  private readonly notifService = new NotificationService();

  /** 매일 자정 실행 — 3일 내 결제 예정 구독 조회 후 알림 큐 등록 */
  async runDailyCheck(): Promise<void> {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + NOTIFY_DAYS_BEFORE);
    targetDate.setHours(23, 59, 59, 999);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // D-3 이내 결제 예정 활성 구독 조회
    const upcoming = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        deleted_at: null,
        next_billing_date: {
          gte: startOfToday,
          lte: targetDate,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, phone_number: true },
        },
      },
    });

    logger.info({ action: 'notification.scheduler.run', upcomingCount: upcoming.length });

    for (const sub of upcoming) {
      await this.scheduleNotification(sub);
    }
  }

  /** 신규 구독 탐지 시 즉시 알림 발송 */
  async notifyNewDetection(
    userId: string,
    subscriptionId: string,
    serviceName: string,
    amount: number,
  ): Promise<void> {
    await this.dispatcher.dispatch({
      userId,
      subscriptionId,
      channel: NotificationChannel.PUSH,
      title: '새 구독이 탐지되었습니다',
      body: `${serviceName} (${amount.toLocaleString()}원)가 탐지되었습니다. 확인해보세요.`,
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async scheduleNotification(sub: {
    id: string;
    service_name: string;
    amount: unknown;
    next_billing_date: Date;
    user: { id: string; email: string; phone_number: string | null };
  }): Promise<void> {
    const billingDate = sub.next_billing_date;
    const amount = Number(sub.amount);
    const daysLeft = Math.ceil(
      (billingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    // 결제일이 오전 10시 알림 기준으로 D-3인지 확인
    if (daysLeft !== NOTIFY_DAYS_BEFORE) return;

    const title = `[D-${daysLeft}] ${sub.service_name} 결제 예정`;
    const body = `${billingDate.toLocaleDateString('ko-KR')} ${amount.toLocaleString()}원 결제 예정입니다.`;

    // 사용자 opt-out 확인 후 채널별 발송 (TASK-023)
    if (await this.notifService.isChannelEnabled(sub.user.id, 'push')) {
      await this.dispatcher.dispatch({
        userId: sub.user.id,
        subscriptionId: sub.id,
        channel: NotificationChannel.PUSH,
        title,
        body,
      });
    }

    if (await this.notifService.isChannelEnabled(sub.user.id, 'email')) {
      await this.dispatcher.dispatch({
        userId: sub.user.id,
        subscriptionId: sub.id,
        channel: NotificationChannel.EMAIL,
        title,
        body,
        email: sub.user.email,
      });
    }

    if (sub.user.phone_number && await this.notifService.isChannelEnabled(sub.user.id, 'sms')) {
      await this.dispatcher.dispatch({
        userId: sub.user.id,
        subscriptionId: sub.id,
        channel: NotificationChannel.SMS,
        title,
        body,
        phoneNumber: sub.user.phone_number,
      });
    }

    logger.info({
      action: 'notification.scheduled',
      userId: sub.user.id,
      service: sub.service_name,
      billingDate,
    });
  }
}
