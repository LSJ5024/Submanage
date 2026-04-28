import axios from 'axios';
import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

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

// SES 클라이언트 — 환경변수로 리전 설정 (CLAUDE.md §7)
const sesClient = new SESClient({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
});

/**
 * NotificationDispatcher — 채널별 알림 발송 + Exponential Backoff 재시도 (CLAUDE.md §9)
 * ⚠️ 모든 인증 키는 환경변수 관리 — 하드코딩 절대 금지 (CLAUDE.md §7)
 */
export class NotificationDispatcher {
  async dispatch(payload: SendPayload): Promise<void> {
    const notifRecord = await prisma.notification.create({
      data: {
        user_id:         payload.userId,
        subscription_id: payload.subscriptionId,
        channel:         payload.channel,
        title:           payload.title,
        body:            payload.body,
      },
    });

    try {
      await this.withRetry(() => this.send(payload));

      await prisma.notification.update({
        where: { id: notifRecord.id },
        data:  { sent_at: new Date() },
      });

      logger.info({
        action:         'notification.sent',
        userId:         payload.userId,
        channel:        payload.channel,
        subscriptionId: payload.subscriptionId,
      });
    } catch (err) {
      await prisma.notification.update({
        where: { id: notifRecord.id },
        data:  { failed_at: new Date(), retry_count: { increment: 1 } },
      });
      logger.error({
        action:  'notification.failed',
        userId:  payload.userId,
        channel: payload.channel,
        message: (err as Error).message,
      });
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async send(payload: SendPayload): Promise<void> {
    switch (payload.channel) {
      case NotificationChannel.PUSH:  await this.sendPush(payload);  break;
      case NotificationChannel.EMAIL: await this.sendEmail(payload); break;
      case NotificationChannel.SMS:   await this.sendSms(payload);   break;
    }
  }

  /** FCM 푸시 발송 (Android + iOS via Firebase) */
  private async sendPush(payload: SendPayload): Promise<void> {
    if (!payload.deviceToken) return;

    const fcmKey = process.env.FCM_SERVER_KEY ?? '';
    if (!fcmKey) {
      logger.warn({ action: 'push.skipped', reason: 'FCM_SERVER_KEY 미설정' });
      return;
    }

    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to:           payload.deviceToken,
        notification: { title: payload.title, body: payload.body },
        data:         { subscriptionId: payload.subscriptionId },
      },
      {
        headers: {
          Authorization:  `key=${fcmKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );

    logger.info({ action: 'push.sent', userId: payload.userId });
  }

  /** AWS SES 이메일 발송 */
  private async sendEmail(payload: SendPayload): Promise<void> {
    if (!payload.email) return;

    const from = process.env.AWS_SES_FROM_EMAIL ?? 'noreply@subtrack.app';

    const input: SendEmailCommandInput = {
      Source: `SubTrack <${from}>`,
      Destination: {
        ToAddresses: [payload.email],
      },
      Message: {
        Subject: {
          Data:    payload.title,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data:    payload.body,
            Charset: 'UTF-8',
          },
          Html: {
            Data: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #5B67F8; padding: 20px; text-align: center;">
                  <h1 style="color: white; margin: 0;">SubTrack</h1>
                </div>
                <div style="padding: 24px; background: #f7f8fc;">
                  <h2 style="color: #1A1D2E;">${payload.title}</h2>
                  <p style="color: #4B5563; line-height: 1.6;">${payload.body}</p>
                  <hr style="border: none; border-top: 1px solid #E4E7F0; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #9CA3AF;">
                    SubTrack — 내 구독, 한눈에. 쉽게 관리.<br/>
                    알림을 더 이상 받지 않으시려면 앱 내 알림 설정에서 변경하세요.
                  </p>
                </div>
              </div>
            `,
            Charset: 'UTF-8',
          },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(input));
    logger.info({ action: 'email.sent', userId: payload.userId });
  }

  /** Twilio SMS 발송 */
  private async sendSms(payload: SendPayload): Promise<void> {
    if (!payload.phoneNumber) return;

    const sid   = process.env.TWILIO_ACCOUNT_SID ?? '';
    const token = process.env.TWILIO_AUTH_TOKEN  ?? '';
    const from  = process.env.TWILIO_PHONE_NUMBER ?? '';

    if (!sid || !token || !from) {
      logger.warn({ action: 'sms.skipped', reason: 'Twilio 환경변수 미설정' });
      return;
    }

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      new URLSearchParams({
        To:   payload.phoneNumber,
        From: from,
        Body: `[SubTrack] ${payload.body}`,
      }),
      { auth: { username: sid, password: token }, timeout: 10_000 },
    );

    logger.info({ action: 'sms.sent', userId: payload.userId });
  }

  /** Exponential Backoff 재시도 — 최대 3회 (1s → 2s → 4s, CLAUDE.md §9) */
  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          logger.warn({ action: 'notification.retry', attempt, delayMs: delay });
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }
}
