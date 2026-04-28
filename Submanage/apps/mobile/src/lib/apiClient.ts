import axios from 'axios';

// 실제 기기에서는 서버 IP 또는 도메인으로 변경
const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000/api/v1'   // Android 에뮬레이터
  : 'https://api.subtrack.app/api/v1';

const apiClient = axios.create({ baseURL: BASE_URL, timeout: 10000 });

apiClient.interceptors.request.use((config) => {
  // useAuthStore에서 직접 가져오면 순환 의존성 발생 — 토큰은 헤더로 외부 주입
  return config;
});

export default apiClient;

export function setAuthHeader(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}
