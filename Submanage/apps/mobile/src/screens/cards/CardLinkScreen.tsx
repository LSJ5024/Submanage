import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';

import type { RootStackParamList } from '../../App';
import apiClient from '../../lib/apiClient';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'CardLink'> };

const CARDS = [
  { id: 'SHINHAN', name: '신한카드',   color: '#0066CC' },
  { id: 'KB',      name: 'KB국민카드', color: '#FFBC00' },
  { id: 'HYUNDAI', name: '현대카드',   color: '#1A1A1A' },
  { id: 'SAMSUNG', name: '삼성카드',   color: '#1428A0' },
  { id: 'LOTTE',   name: '롯데카드',   color: '#E60012' },
  { id: 'WOORI',   name: '우리카드',   color: '#007AFF' },
  { id: 'HANA',    name: '하나카드',   color: '#00A650' },
] as const;

export default function CardLinkScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLink = async () => {
    if (!selected || !authCode) { Alert.alert('알림', '카드사와 인가 코드를 입력해주세요.'); return; }
    setLoading(true);
    try {
      await apiClient.post('/cards/link', { cardCompany: selected, authCode });
      Alert.alert('연동 완료', '카드가 연동되었습니다. 구독을 탐지하고 있습니다.', [
        { text: '확인', onPress: () => navigation.navigate('Dashboard') },
      ]);
    } catch {
      Alert.alert('오류', '카드 연동에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.sectionTitle}>카드사 선택</Text>
      <View style={s.grid}>
        {CARDS.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[s.cardBtn, selected === c.id && { borderColor: c.color, borderWidth: 2 }]}
            onPress={() => setSelected(c.id)}
            activeOpacity={0.7}
          >
            <View style={[s.dot, { backgroundColor: c.color }]} />
            <Text style={s.cardName}>{c.name}</Text>
            {selected === c.id && <Text style={s.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <View style={s.authSection}>
          <Text style={s.sectionTitle}>마이데이터 인가 코드</Text>
          <TextInput
            style={s.input}
            placeholder="인가 코드를 입력하세요"
            value={authCode}
            onChangeText={setAuthCode}
          />
          <Text style={s.hint}>실제 서비스에서는 카드사 OAuth 페이지에서 자동으로 입력됩니다.</Text>

          <TouchableOpacity style={s.linkBtn} onPress={handleLink} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.linkBtnText}>연동하기</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: '#F7F8FC' },
  content:      { padding: 16, gap: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1D2E' },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardBtn:      { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E4E7F0' },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  cardName:     { flex: 1, fontSize: 14, fontWeight: '500' },
  check:        { color: '#5B67F8', fontWeight: '700' },
  authSection:  { gap: 10 },
  input:        { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E7F0', borderRadius: 10, padding: 14, fontSize: 15 },
  hint:         { fontSize: 12, color: '#6B7280' },
  linkBtn:      { backgroundColor: '#5B67F8', borderRadius: 10, padding: 16, alignItems: 'center' },
  linkBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
});
