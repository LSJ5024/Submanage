import axios from 'axios';

import { NotificationChannel } from '@subtrack/shared';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../middlewares/logger.js';

interface SendPayload {
  userId: string;
  subscriptionId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  deviceToken?: string;
  email?: string;
  phoneNumber?: string;
}

/**
 * NotificationDispatcher — 채널별 알림 발송 + Exponential Backoff 재시도 (CLAUDE.md §9)
 * ⚠️ 모든 인증 키는 환경변수 관리 — 하드코딩 절대 금지 (CLAUDE.md §7)
 */
export class NotificationDispatcher {
  async dispatch(payload: SendPayload): Promise<void> {
    const notifRecord = await prisma.notification.create({
      data: {
        user_id: payload.userId,
        subscription_id: payload.subscriptionId,
        channel: payload.channel,
        title: payload.title,
        body: payload.body,
      },
    });

    try {
      await this.withRetry(() => this.send(payload));

      await prisma.notification.update({
        where: { id: notifRecord.id },
        data: { sent_at: new Date() },
      });

      logger.info({
        action: 'notification.sent',
        userId: payload.userId,
        channel: payload.channel,
        subscriptionId: payload.subscriptionId,
      });
    } catch (err) {
      await prisma.notification.update({
        where: { id: notifRecord.id },
        data: { failed_at: new Date(), retry_count: { increment: 1 } },
      });
      logger.error({
        action: 'notification.failed',
        userId: payload.userId,
        channel: payload.channel,
        message: (err as Error).message,
      });
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async send(payload: SendPayload): Promise<void> {
    switch (payload.channel) {
      case NotificationChannel.PUSH:
        await this.sendPush(payload);
        break;
      case NotificationChannel.EMAIL:
        await this.sendEmail(payload);
        break;
      case NotificationChannel.SMS:
        await this.sendSms(payload);
        break;
    }
  }

  /** Android FCM 푸시 발송 (CLAUDE.md §9) */
  private async sendPush(payload: SendPayload): Promise<void> {
    if (!payload.deviceToken) return;

    // iOS vs Android 구분은 deviceToken prefix 또는 별도 필드로 처리 예정
    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: payload.deviceToken,
        notification: { title: payload.title, body: payload.body },
      },
      {
        headers: {
          Authorization: `key=${process.env.FCM_SERVER_KEY ?? ''}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  /** AWS SES 이메일 발송 */
  private async sendEmail(payload: SendPayload): Promise<void> {
    if (!payload.email) return;
    // AWS SDK v3 SES 클라이언트 — 실제 구현은 @aws-sdk/client-ses 사용 예정
    logger.info({ action: 'email.send', to: payload.email, title: payload.title });
  }

  /** Twilio SMS 발송 */
  private async sendSms(payload: SendPayload): Promise<void> {
    if (!payload.phoneNumber) return;

    const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
    const token = process.env.TWILIO_AUTH_TOKEN ?? '';
    const from = process.env.TWILIO_PHONE_NUMBER ?? '';

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      new URLSearchParams({ To: payload.phoneNumber, From: from, Body: payload.body }),
      { auth: { username: sid, password: token } },
    );
  }

  /** Exponential Backoff 재시도 (최대 3회, CLAUDE.md §9) */
  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }
    throw lastError;
  }
}
