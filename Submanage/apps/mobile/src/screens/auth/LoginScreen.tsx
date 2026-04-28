import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';

import type { RootStackParamList } from '../../App';
import { useAuthStore } from '../../stores/auth.store';
import { setAuthHeader } from '../../lib/apiClient';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.'); return; }
    setLoading(true);
    try {
      await login(email, password);
      const token = useAuthStore.getState().accessToken;
      setAuthHeader(token);
    } catch {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.logo}>
        <Text style={s.logoText}>S</Text>
      </View>
      <Text style={s.title}>SubTrack</Text>
      <Text style={s.subtitle}>내 구독, 한눈에. 쉽게 관리.</Text>

      <View style={s.form}>
        <TextInput
          style={s.input}
          placeholder="이메일"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextInput
          style={s.input}
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>로그인</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={s.linkText}>계정이 없으신가요? <Text style={s.link}>회원가입</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FC', padding: 24 },
  logo:      { width: 56, height: 56, borderRadius: 14, backgroundColor: '#5B67F8', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText:  { color: '#fff', fontSize: 24, fontWeight: '700' },
  title:     { fontSize: 26, fontWeight: '800', color: '#1A1D2E', marginBottom: 6 },
  subtitle:  { fontSize: 14, color: '#6B7280', marginBottom: 36 },
  form:      { width: '100%', gap: 12 },
  input:     { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E7F0', borderRadius: 10, padding: 14, fontSize: 15 },
  btn:       { backgroundColor: '#5B67F8', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkText:  { textAlign: 'center', marginTop: 16, color: '#6B7280', fontSize: 14 },
  link:      { color: '#5B67F8', fontWeight: '600' },
});
