import { useEffect, useState } from 'react';

import apiClient from '@/lib/apiClient';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import styles from './NotificationSettingsPage.module.css';

interface Settings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  notificationTime: string;
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    pushEnabled: true, emailEnabled: true, smsEnabled: false, notificationTime: '10:00',
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    void apiClient
      .get<{ success: boolean; data: Settings }>('/notifications/settings')
      .then(({ data }) => { if (data.success && data.data) setSettings(data.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/notifications/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof Pick<Settings, 'pushEnabled' | 'emailEnabled' | 'smsEnabled'>) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <div className={styles.loading}>불러오는 중…</div>;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>알림 설정</h2>
      <p className={styles.subtitle}>결제 D-3 전 알림을 원하는 채널로 받아보세요.</p>

      <div className={styles.cards}>
        <Card>
          <h3 className={styles.sectionTitle}>알림 채널</h3>
          <div className={styles.toggleList}>
            {([
              { key: 'pushEnabled',  label: '푸시 알림',  desc: '앱 푸시 알림 (FCM / APNs)' },
              { key: 'emailEnabled', label: '이메일',     desc: '이메일로 결제 예정 안내' },
              { key: 'smsEnabled',   label: 'SMS',        desc: 'Twilio SMS (별도 요금 발생 가능)' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>{label}</p>
                  <p className={styles.toggleDesc}>{desc}</p>
                </div>
                <button
                  className={`${styles.toggle} ${settings[key] ? styles.on : ''}`}
                  onClick={() => toggle(key)}
                  aria-label={`${label} ${settings[key] ? '끄기' : '켜기'}`}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className={styles.sectionTitle}>알림 시간</h3>
          <p className={styles.timeDesc}>결제 D-3 당일, 설정한 시간에 알림이 발송됩니다.</p>
          <input
            type="time"
            className={styles.timeInput}
            value={settings.notificationTime}
            onChange={(e) => setSettings((prev) => ({ ...prev, notificationTime: e.target.value }))}
          />
        </Card>
      </div>

      <div className={styles.saveRow}>
        {saved && <span className={styles.savedMsg}>✅ 저장되었습니다</span>}
        <Button onClick={handleSave} loading={saving} size="lg">
          설정 저장
        </Button>
      </div>
    </div>
  );
}
