import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';

import apiClient from '../../lib/apiClient';

const { width: SCREEN_W } = Dimensions.get('window');

interface MonthlyReport {
  year: number;
  month: number;
  totalAmount: number;
  subscriptionCount: number;
  categoryBreakdown: Record<string, number>;
  subscriptions: {
    id: string;
    serviceName: string;
    amount: number;
    category: string;
    status: string;
  }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  VIDEO: '동영상', MUSIC: '음악', SOFTWARE: '소프트웨어',
  CLOUD: '클라우드', GAME: '게임', NEWS: '뉴스',
  SHOPPING: '쇼핑', FITNESS: '피트니스', EDUCATION: '교육', OTHER: '기타',
};

const CATEGORY_COLORS = [
  '#5B67F8', '#22C55E', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6',
];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:     { bg: '#DCFCE7', color: '#16A34A', label: '활성'   },
  PAUSED:     { bg: '#FEF3C7', color: '#D97706', label: '일시중지' },
  CANCELLING: { bg: '#FEE2E2', color: '#DC2626', label: '해지중'  },
  CANCELLED:  { bg: '#F3F4F6', color: '#6B7280', label: '해지'   },
  DETECTED:   { bg: '#EEF0FE', color: '#5B67F8', label: '탐지'   },
};

export default function ReportScreen() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport]   = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ success: boolean; data: MonthlyReport }>(
        `/dashboard/reports/monthly?year=${year}&month=${month}`,
      );
      if (data.success) setReport(data.data);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { void load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // 간이 바 차트
  const maxAmount = report
    ? Math.max(...Object.values(report.categoryBreakdown), 1)
    : 1;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* 월 네비게이션 */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <Text style={s.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{year}년 {month}월</Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={[s.navBtn, isCurrentMonth && s.navBtnDisabled]}
          disabled={isCurrentMonth}
        >
          <Text style={[s.navBtnText, isCurrentMonth && s.navBtnTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#5B67F8" />
        </View>
      ) : (
        <>
          {/* 요약 카드 */}
          <View style={s.summaryRow}>
            <View style={[s.summaryCard, { backgroundColor: '#5B67F8' }]}>
              <Text style={s.summaryLabelLight}>총 지출</Text>
              <Text style={s.summaryAmountLight}>
                {(report?.totalAmount ?? 0).toLocaleString()}원
              </Text>
            </View>
            <View style={[s.summaryCard, s.summaryCardWhite]}>
              <Text style={s.summaryLabel}>구독 수</Text>
              <Text style={s.summaryAmount}>{report?.subscriptionCount ?? 0}개</Text>
            </View>
          </View>

          {/* 카테고리별 바 차트 */}
          {report && Object.keys(report.categoryBreakdown).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>카테고리별 지출</Text>
              {Object.entries(report.categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amount], i) => (
                  <View key={cat} style={s.barRow}>
                    <Text style={s.barLabel}>
                      {CATEGORY_LABELS[cat] ?? cat}
                    </Text>
                    <View style={s.barTrack}>
                      <View
                        style={[
                          s.barFill,
                          {
                            width: `${(amount / maxAmount) * 100}%`,
                            backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.barAmount}>
                      {amount.toLocaleString()}원
                    </Text>
                  </View>
                ))}
            </View>
          )}

          {/* 구독 상세 목록 */}
          <View style={s.card}>
            <Text style={s.cardTitle}>구독 상세 목록</Text>
            {(report?.subscriptions ?? []).length === 0 ? (
              <Text style={s.emptyText}>이 달 구독 내역이 없습니다.</Text>
            ) : (
              (report?.subscriptions ?? []).map((sub) => {
                const st = STATUS_STYLE[sub.status] ?? STATUS_STYLE['DETECTED'];
                return (
                  <View key={sub.id} style={s.subRow}>
                    <View style={s.subLeft}>
                      <Text style={s.subName}>{sub.serviceName}</Text>
                      <Text style={s.subCat}>{CATEGORY_LABELS[sub.category] ?? sub.category}</Text>
                    </View>
                    <View style={s.subRight}>
                      <Text style={s.subAmount}>{sub.amount.toLocaleString()}원</Text>
                      <View style={[s.badge, { backgroundColor: st.bg }]}>
                        <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* 전월 대비 */}
          <View style={[s.card, s.tipCard]}>
            <Text style={s.tipIcon}>💡</Text>
            <Text style={s.tipText}>
              이번 달 총 구독 지출은{' '}
              <Text style={s.tipHighlight}>
                {(report?.totalAmount ?? 0).toLocaleString()}원
              </Text>
              입니다.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: '#F7F8FC' },
  content:  { padding: 16, paddingBottom: 40, gap: 12 },
  center:   { paddingVertical: 60, alignItems: 'center' },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  monthLabel:{ fontSize: 20, fontWeight: '700', color: '#1A1D2E', minWidth: 120, textAlign: 'center' },
  navBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E4E7F0' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText:     { fontSize: 20, color: '#5B67F8', fontWeight: '600' },
  navBtnTextDisabled: { color: '#9CA3AF' },

  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard:{ flex: 1, borderRadius: 16, padding: 16 },
  summaryCardWhite: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E7F0' },
  summaryLabelLight: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  summaryAmountLight:{ fontSize: 22, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  summaryAmount:{ fontSize: 22, fontWeight: '800', color: '#1A1D2E' },

  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: '#1A1D2E', marginBottom: 14 },

  barRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  barLabel:   { width: 60, fontSize: 12, color: '#6B7280' },
  barTrack:   { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 4 },
  barAmount:  { width: 70, fontSize: 11, color: '#1A1D2E', textAlign: 'right', fontWeight: '600' },

  subRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  subLeft:    { gap: 2 },
  subName:    { fontSize: 14, fontWeight: '600', color: '#1A1D2E' },
  subCat:     { fontSize: 12, color: '#6B7280' },
  subRight:   { alignItems: 'flex-end', gap: 4 },
  subAmount:  { fontSize: 14, fontWeight: '700', color: '#1A1D2E' },
  badge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  badgeText:  { fontSize: 11, fontWeight: '600' },

  emptyText:  { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },

  tipCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipIcon:    { fontSize: 18 },
  tipText:    { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20 },
  tipHighlight:{ color: '#5B67F8', fontWeight: '700' },
});
