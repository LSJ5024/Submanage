import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../../App';
import apiClient from '../../lib/apiClient';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SubscriptionDetail'>;
  route: RouteProp<RootStackParamList, 'SubscriptionDetail'>;
};

interface Sub {
  id: string; serviceName: string; category: string;
  amount: number; billingCycle: string; nextBillingDate: string;
  status: string; autoDetected: boolean;
}

const VALID_NEXT: Record<string, { status: string; label: string; danger?: boolean }[]> = {
  DETECTED:   [{ status: 'ACTIVE',     label: '활성으로 확인' }],
  ACTIVE:     [{ status: 'PAUSED',     label: '일시중지' }, { status: 'CANCELLING', label: '해지 진행', danger: true }],
  PAUSED:     [{ status: 'ACTIVE',     label: '다시 활성화' }],
  CANCELLING: [{ status: 'CANCELLED',  label: '해지 완료', danger: true }, { status: 'ACTIVE', label: '해지 취소' }],
};

export default function SubscriptionDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [sub, setSub]       = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiClient
      .get<{ success: boolean; data: Sub }>(`/subscriptions/${id}`)
      .then(({ data }) => { if (data.success) setSub(data.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (nextStatus: string) => {
    try {
      await apiClient.patch(`/subscriptions/${id}/status`, { status: nextStatus });
      setSub((prev) => prev ? { ...prev, status: nextStatus } : prev);
    } catch {
      Alert.alert('오류', '상태 변경에 실패했습니다.');
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#5B67F8" /></View>;
  if (!sub)    return <View style={s.center}><Text>구독을 찾을 수 없습니다.</Text></View>;

  const nextActions = VALID_NEXT[sub.status] ?? [];

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* 헤더 */}
      <View style={s.card}>
        <Text style={s.serviceName}>{sub.serviceName}</Text>
        <Text style={s.category}>{sub.category}</Text>
        <View style={s.grid}>
          {[
            { label: '월 금액',    value: `${Number(sub.amount).toLocaleString()}원` },
            { label: '결제 주기',  value: sub.billingCycle },
            { label: '다음 결제일', value: new Date(sub.nextBillingDate).toLocaleDateString('ko-KR') },
            { label: '탐지 방식',  value: sub.autoDetected ? '자동' : '수동' },
          ].map(({ label, value }) => (
            <View key={label} style={s.gridItem}>
              <Text style={s.gridLabel}>{label}</Text>
              <Text style={s.gridValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* 상태 변경 */}
        {nextActions.length > 0 && (
          <View style={s.actions}>
            {nextActions.map(({ status, label, danger }) => (
              <TouchableOpacity
                key={status}
                style={[s.actionBtn, danger && s.dangerBtn]}
                onPress={() => handleStatusChange(status)}
                activeOpacity={0.8}
              >
                <Text style={[s.actionText, danger && s.dangerText]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 해지 안내 버튼 — 안내만 제공, 자동 해지 금지 (CLAUDE.md §8) */}
      {['ACTIVE', 'CANCELLING'].includes(sub.status) && (
        <TouchableOpacity
          style={s.guideBtn}
          onPress={() => navigation.navigate('CancelGuide', { id, serviceName: sub.serviceName })}
          activeOpacity={0.8}
        >
          <Text style={s.guideBtnText}>🔍 해지 안내 보기</Text>
          <Text style={s.guideBtnArrow}>›</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#F7F8FC' },
  content:    { padding: 16, gap: 12 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  serviceName:{ fontSize: 22, fontWeight: '800', color: '#1A1D2E', marginBottom: 4 },
  category:   { fontSize: 13, color: '#6B7280', marginBottom: 20 },

  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  gridItem:   { width: '45%' },
  gridLabel:  { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  gridValue:  { fontSize: 16, fontWeight: '600', color: '#1A1D2E' },

  actions:    { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn:  { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E4E7F0', backgroundColor: '#F7F8FC' },
  dangerBtn:  { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1A1D2E' },
  dangerText: { color: '#EF4444' },

  guideBtn:   { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  guideBtnText:{ fontSize: 15, fontWeight: '600', color: '#1A1D2E' },
  guideBtnArrow:{ fontSize: 18, color: '#6B7280' },
});
