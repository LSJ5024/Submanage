import { prisma } from '../lib/prisma.js';

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  notificationTime: string; // HH:mm 형식
}

/**
 * NotificationService — 사용자 알림 수신 설정 관리 (TASK-023)
 * opt-out 설정은 notification_settings 테이블에 저장.
 */
export class NotificationService {
  async getSettings(userId: string): Promise<NotificationSettings> {
    const setting = await prisma.notificationSetting.findUnique({
      where: { user_id: userId },
    });

    // 미설정 사용자는 기본값(푸시·이메일 ON, SMS OFF) 반환
    return {
      pushEnabled:       setting?.push_enabled     ?? true,
      emailEnabled:      setting?.email_enabled     ?? true,
      smsEnabled:        setting?.sms_enabled       ?? false,
      notificationTime:  setting?.notification_time ?? '10:00',
    };
  }

  async updateSettings(
    userId: string,
    settings: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    const updated = await prisma.notificationSetting.upsert({
      where:  { user_id: userId },
      create: {
        user_id:           userId,
        push_enabled:      settings.pushEnabled      ?? true,
        email_enabled:     settings.emailEnabled     ?? true,
        sms_enabled:       settings.smsEnabled       ?? false,
        notification_time: settings.notificationTime ?? '10:00',
      },
      update: {
        ...(settings.pushEnabled      !== undefined && { push_enabled:      settings.pushEnabled }),
        ...(settings.emailEnabled     !== undefined && { email_enabled:     settings.emailEnabled }),
        ...(settings.smsEnabled       !== undefined && { sms_enabled:       settings.smsEnabled }),
        ...(settings.notificationTime !== undefined && { notification_time: settings.notificationTime }),
      },
    });

    return {
      pushEnabled:      updated.push_enabled,
      emailEnabled:     updated.email_enabled,
      smsEnabled:       updated.sms_enabled,
      notificationTime: updated.notification_time,
    };
  }

  /** 알림 스케줄러가 발송 전 opt-out 여부를 확인할 때 사용 */
  async isChannelEnabled(
    userId: string,
    channel: 'push' | 'email' | 'sms',
  ): Promise<boolean> {
    const settings = await this.getSettings(userId);
    if (channel === 'push')  return settings.pushEnabled;
    if (channel === 'email') return settings.emailEnabled;
    return settings.smsEnabled;
  }
}
