import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../../App';
import apiClient from '../../lib/apiClient';

type Props = { route: RouteProp<RootStackParamList, 'CancelGuide'> };

interface Step { order: number; description: string; }
interface Guide { steps: Step[]; deep_link?: string; }

export default function CancelGuideScreen({ route }: Props) {
  const { id } = route.params;
  const [guide, setGuide]     = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiClient
      .get<{ success: boolean; data: Guide }>(`/subscriptions/${id}/cancel-guide`)
      .then(({ data }) => { if (data.success) setGuide(data.data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#5B67F8" /></View>;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.notice}>
        <Text style={s.noticeText}>
          ⚠️ SubTrack은 해지 안내만 제공합니다. 실제 해지는 해당 서비스에서 직접 진행해주세요.
        </Text>
      </View>

      {(guide?.steps ?? []).map((step) => (
        <View key={step.order} style={s.stepCard}>
          <View style={s.stepNum}>
            <Text style={s.stepNumText}>{step.order}</Text>
          </View>
          <Text style={s.stepDesc}>{step.description}</Text>
        </View>
      ))}

      {guide?.deep_link && (
        <TouchableOpacity
          style={s.deepLink}
          onPress={() => { void Linking.openURL(guide.deep_link!); }}
          activeOpacity={0.8}
        >
          <Text style={s.deepLinkText}>🔗 해지 페이지 열기</Text>
        </TouchableOpacity>
      )}

      {!guide && (
        <View style={s.center}>
          <Text style={{ color: '#6B7280' }}>해지 가이드가 준비 중입니다.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: '#F7F8FC' },
  content:      { padding: 16, gap: 12, paddingBottom: 40 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  notice:       { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 14 },
  noticeText:   { fontSize: 13, color: '#92400E', lineHeight: 20 },

  stepCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNum:      { width: 30, height: 30, borderRadius: 15, backgroundColor: '#5B67F8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepDesc:     { flex: 1, fontSize: 15, color: '#1A1D2E', lineHeight: 22 },

  deepLink:     { backgroundColor: '#5B67F8', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  deepLinkText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
