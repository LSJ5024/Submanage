import axios from 'axios';
import { Resend } from 'resend';

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

// Resend 클라이언트 (API 키는 환경변수 — 하드코딩 금지, CLAUDE.md §7)
const resend = new Resend(process.env.RESEND_API_KEY ?? '');

/**
 * NotificationDispatcher — 채널별 알림 발송 + Exponential Backoff 재시도 (CLAUDE.md §9)
 *
 * 이메일: Resend (무료 3,000건/월, 신용카드 불필요)
 * 푸시:   FCM (Firebase, 무료)
 * SMS:    Twilio 변수 미설정 시 자동 skip
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
      logger.info({ action: 'notification.sent', userId: payload.userId, channel: payload.channel });
    } catch (err) {
      await prisma.notification.update({
        where: { id: notifRecord.id },
        data:  { failed_at: new Date(), retry_count: { increment: 1 } },
      });
      logger.error({ action: 'notification.failed', userId: payload.userId, message: (err as Error).message });
    }
  }

  private async send(payload: SendPayload): Promise<void> {
    switch (payload.channel) {
      case NotificationChannel.PUSH:  await this.sendPush(payload);  break;
      case NotificationChannel.EMAIL: await this.sendEmail(payload); break;
      case NotificationChannel.SMS:   await this.sendSms(payload);   break;
    }
  }

  /** FCM 푸시 발송 (Firebase 무료) */
  private async sendPush(payload: SendPayload): Promise<void> {
    if (!payload.deviceToken) return;
    const fcmKey = process.env.FCM_SERVER_KEY ?? '';
    if (!fcmKey) { logger.warn({ action: 'push.skipped', reason: 'FCM_SERVER_KEY 미설정' }); return; }

    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      { to: payload.deviceToken, notification: { title: payload.title, body: payload.body } },
      { headers: { Authorization: `key=${fcmKey}`, 'Content-Type': 'application/json' }, timeout: 10_000 },
    );
    logger.info({ action: 'push.sent', userId: payload.userId });
  }

  /** Resend 이메일 발송 — 무료 3,000건/월, 신용카드 불필요 */
  private async sendEmail(payload: SendPayload): Promise<void> {
    if (!payload.email) return;
    if (!process.env.RESEND_API_KEY) {
      logger.warn({ action: 'email.skipped', reason: 'RESEND_API_KEY 미설정' });
      return;
    }

    const from = process.env.RESEND_FROM_EMAIL ?? 'SubTrack <onboarding@resend.dev>';

    const { error } = await resend.emails.send({
      from,
      to:      [payload.email],
      subject: payload.title,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#5B67F8;padding:20px;border-radius:12px 12px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:20px;">SubTrack</h1>
            <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px;">내 구독, 한눈에. 쉽게 관리.</p>
          </div>
          <div style="background:#f7f8fc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e4e7f0;">
            <h2 style="color:#1A1D2E;font-size:18px;margin:0 0 12px;">${payload.title}</h2>
            <p style="color:#4B5563;line-height:1.7;margin:0 0 20px;">${payload.body}</p>
            <hr style="border:none;border-top:1px solid #e4e7f0;margin:0 0 16px;"/>
            <p style="font-size:12px;color:#9CA3AF;margin:0;">알림 설정은 앱 내에서 변경할 수 있습니다.</p>
          </div>
        </div>
      `,
      text: payload.body,
    });

    if (error) throw new Error(`Resend 발송 실패: ${error.message}`);
    logger.info({ action: 'email.sent', userId: payload.userId });
  }

  /** Twilio SMS — 변수 미설정 시 skip (학교 과제 시 이메일/푸시로 대체) */
  private async sendSms(payload: SendPayload): Promise<void> {
    if (!payload.phoneNumber) return;
    const sid   = process.env.TWILIO_ACCOUNT_SID ?? '';
    const token = process.env.TWILIO_AUTH_TOKEN  ?? '';
    const from  = process.env.TWILIO_PHONE_NUMBER ?? '';
    if (!sid || !token || !from) {
      logger.warn({ action: 'sms.skipped', reason: 'Twilio 미설정 — 건너뜀' });
      return;
    }
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      new URLSearchParams({ To: payload.phoneNumber, From: from, Body: `[SubTrack] ${payload.body}` }),
      { auth: { username: sid, password: token }, timeout: 10_000 },
    );
  }

  /** Exponential Backoff 재시도 — 최대 3회 (CLAUDE.md §9) */
  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try { return await fn(); }
      catch (err) {
        lastError = err as Error;
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
    throw lastError;
  }
}
