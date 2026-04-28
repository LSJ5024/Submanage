import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';

import type { RootStackParamList } from '../../App';
import apiClient from '../../lib/apiClient';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Dashboard'> };

interface DashboardData {
  totalMonthlyAmount: number;
  upcomingBillings: { id: string; serviceName: string; amount: number; daysLeft: number }[];
  categoryBreakdown: { category: string; total: number; count: number }[];
}

interface SubItem {
  id: string;
  serviceName: string;
  amount: number;
  status: string;
  billingCycle: string;
  nextBillingDate: string;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성', DETECTED: '탐지', PAUSED: '일시중지', CANCELLING: '해지중', CANCELLED: '해지',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#16A34A', DETECTED: '#5B67F8', PAUSED: '#D97706', CANCELLING: '#DC2626', CANCELLED: '#6B7280',
};

export default function DashboardScreen({ navigation }: Props) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [subs, setSubs]           = useState<SubItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dashRes, subRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: DashboardData }>('/dashboard'),
        apiClient.get<{ success: boolean; data: { items: SubItem[] } }>('/subscriptions?limit=20'),
      ]);
      if (dashRes.data.success) setDashboard(dashRes.data.data);
      if (subRes.data.success)  setSubs(subRes.data.data.items);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); void load(); };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#5B67F8" /></View>;

  return (
    <FlatList
      style={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          {/* 총액 카드 */}
          <View style={s.totalCard}>
            <Text style={s.totalLabel}>이번 달 구독 총액</Text>
            <Text style={s.totalAmount}>{(dashboard?.totalMonthlyAmount ?? 0).toLocaleString()}원</Text>
          </View>

          {/* 임박 결제 */}
          {(dashboard?.upcomingBillings.length ?? 0) > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>⏰ 임박 결제</Text>
              {dashboard?.upcomingBillings.slice(0, 3).map((b) => (
                <View key={b.id} style={s.upcomingRow}>
                  <View style={[s.dBadge, b.daysLeft <= 3 && s.urgentBadge]}>
                    <Text style={[s.dText, b.daysLeft <= 3 && s.urgentText]}>D-{b.daysLeft}</Text>
                  </View>
                  <Text style={s.upcomingName}>{b.serviceName}</Text>
                  <Text style={s.upcomingAmount}>{b.amount.toLocaleString()}원</Text>
                </View>
              ))}
            </View>
          )}

          {/* 헤더 */}
          <View style={s.subHeader}>
            <Text style={s.sectionTitle}>구독 목록</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CardLink')}>
              <Text style={s.addCard}>+ 카드 연동</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      data={subs}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={s.subItem}
          onPress={() => navigation.navigate('SubscriptionDetail', { id: item.id })}
          activeOpacity={0.7}
        >
          <View style={s.subLeft}>
            <Text style={s.subName}>{item.serviceName}</Text>
            <Text style={s.subMeta}>{item.billingCycle}</Text>
          </View>
          <View style={s.subRight}>
            <Text style={s.subAmount}>{Number(item.amount).toLocaleString()}원</Text>
            <Text style={[s.statusText, { color: STATUS_COLOR[item.status] ?? '#6B7280' }]}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyText}>탐지된 구독이 없습니다</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CardLink')}>
            <Text style={s.emptyBtnText}>카드 연동하기</Text>
          </TouchableOpacity>
        </View>
      }
      contentContainerStyle={s.content}
    />
  );
}

const s = StyleSheet.create({
  list:        { flex: 1, backgroundColor: '#F7F8FC' },
  content:     { padding: 16, gap: 12, paddingBottom: 40 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  totalCard:   { backgroundColor: '#5B67F8', borderRadius: 16, padding: 24, marginBottom: 16 },
  totalLabel:  { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 32, fontWeight: '800' },

  section:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: '#1A1D2E', marginBottom: 12 },

  upcomingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dBadge:       { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#EEF0FE', borderRadius: 99 },
  urgentBadge:  { backgroundColor: '#FEE2E2' },
  dText:        { fontSize: 12, fontWeight: '700', color: '#5B67F8' },
  urgentText:   { color: '#DC2626' },
  upcomingName: { flex: 1, fontSize: 14 },
  upcomingAmount:{ fontSize: 14, fontWeight: '600' },

  subHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addCard:     { color: '#5B67F8', fontSize: 13, fontWeight: '600' },

  subItem:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subLeft:     { gap: 4 },
  subName:     { fontSize: 15, fontWeight: '600', color: '#1A1D2E' },
  subMeta:     { fontSize: 12, color: '#6B7280' },
  subRight:    { alignItems: 'flex-end', gap: 4 },
  subAmount:   { fontSize: 15, fontWeight: '700', color: '#1A1D2E' },
  statusText:  { fontSize: 12, fontWeight: '600' },

  empty:       { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon:   { fontSize: 40 },
  emptyText:   { fontSize: 15, color: '#6B7280' },
  emptyBtn:    { backgroundColor: '#5B67F8', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  emptyBtnText:{ color: '#fff', fontWeight: '600' },
});
