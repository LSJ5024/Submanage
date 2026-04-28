import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';

import type { RootStackParamList } from '../../App';
import { useAuthStore } from '../../stores/auth.store';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Register'> };

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  const register = useAuthStore((s) => s.register);

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('알림', '모든 항목을 입력해주세요.'); return; }
    if (password !== confirm) { Alert.alert('알림', '비밀번호가 일치하지 않습니다.'); return; }
    if (password.length < 8) { Alert.alert('알림', '비밀번호는 8자 이상이어야 합니다.'); return; }

    setLoading(true);
    try {
      await register(email, password, name);
      Alert.alert('가입 완료', '로그인 해주세요.', [{ text: '확인', onPress: () => navigation.navigate('Login') }]);
    } catch {
      Alert.alert('오류', '회원가입에 실패했습니다. 이미 사용 중인 이메일일 수 있습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.form}>
        {[
          { label: '이름',       value: name,     setter: setName,     placeholder: '홍길동',               secure: false, keyboard: 'default' as const },
          { label: '이메일',     value: email,    setter: setEmail,    placeholder: 'example@email.com',    secure: false, keyboard: 'email-address' as const },
          { label: '비밀번호',   value: password, setter: setPassword, placeholder: '8자 이상',              secure: true,  keyboard: 'default' as const },
          { label: '비밀번호 확인', value: confirm, setter: setConfirm, placeholder: '비밀번호를 다시 입력', secure: true,  keyboard: 'default' as const },
        ].map(({ label, value, setter, placeholder, secure, keyboard }) => (
          <View key={label} style={s.field}>
            <Text style={s.label}>{label}</Text>
            <TextInput
              style={s.input}
              placeholder={placeholder}
              value={value}
              onChangeText={setter}
              secureTextEntry={secure}
              keyboardType={keyboard}
              autoCapitalize="none"
            />
          </View>
        ))}

        <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>회원가입</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F7F8FC' },
  form:      { gap: 16 },
  field:     { gap: 6 },
  label:     { fontSize: 13, fontWeight: '600', color: '#1A1D2E' },
  input:     { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E7F0', borderRadius: 10, padding: 14, fontSize: 15 },
  btn:       { backgroundColor: '#5B67F8', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
});
