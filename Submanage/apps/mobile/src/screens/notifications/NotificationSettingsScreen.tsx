import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';

import apiClient from '../../lib/apiClient';

interface Settings { pushEnabled: boolean; emailEnabled: boolean; smsEnabled: boolean; notificationTime: string; }

export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState<Settings>({ pushEnabled: true, emailEnabled: true, smsEnabled: false, notificationTime: '10:00' });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

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
      Alert.alert('저장 완료', '알림 설정이 저장되었습니다.');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#5B67F8" /></View>;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.cardTitle}>알림 채널</Text>
        {([
          { key: 'pushEnabled',  label: '푸시 알림',  desc: 'FCM/APNs 앱 푸시' },
          { key: 'emailEnabled', label: '이메일',     desc: '이메일 알림' },
          { key: 'smsEnabled',   label: 'SMS',        desc: 'Twilio SMS' },
        ] as const).map(({ key, label, desc }) => (
          <View key={key} style={s.row}>
            <View>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowDesc}>{desc}</Text>
            </View>
            <Switch
              value={settings[key]}
              onValueChange={(v) => setSettings((prev) => ({ ...prev, [key]: v }))}
              trackColor={{ true: '#5B67F8' }}
            />
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>알림 시간</Text>
        <Text style={s.timeLabel}>결제 D-3 당일 알림 발송 시간</Text>
        <Text style={s.timeValue}>{settings.notificationTime}</Text>
        <Text style={s.timeHint}>시간 변경은 웹에서 지원됩니다.</Text>
      </View>

      <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>설정 저장</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:    { flex: 1, backgroundColor: '#F7F8FC' },
  content:   { padding: 16, gap: 12, paddingBottom: 40 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 16, color: '#1A1D2E' },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowLabel:  { fontSize: 14, fontWeight: '500', color: '#1A1D2E' },
  rowDesc:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  timeLabel: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  timeValue: { fontSize: 28, fontWeight: '700', color: '#5B67F8', marginBottom: 4 },
  timeHint:  { fontSize: 12, color: '#6B7280' },
  saveBtn:   { backgroundColor: '#5B67F8', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
});
