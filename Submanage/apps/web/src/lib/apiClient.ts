import axios from 'axios';
import type { ApiResponse } from '@subtrack/shared';
import {
  MOCK_DASHBOARD, MOCK_SUBSCRIPTIONS, MOCK_MONTHLY_REPORT,
  MOCK_NOTIFICATION_SETTINGS, MOCK_CANCEL_GUIDE,
} from './mockData';

// DEV 환경에서는 목 데이터 폴백 활성화
const IS_DEMO = import.meta.env.DEV;

const DEMO_ROUTES: Record<string, unknown> = {
  '/dashboard':                    { success: true, data: MOCK_DASHBOARD },
  '/subscriptions':                { success: true, data: MOCK_SUBSCRIPTIONS },
  '/subscriptions/1':              { success: true, data: MOCK_SUBSCRIPTIONS.items[0] },
  '/subscriptions/2':              { success: true, data: MOCK_SUBSCRIPTIONS.items[1] },
  '/subscriptions/3':              { success: true, data: MOCK_SUBSCRIPTIONS.items[2] },
  '/subscriptions/4':              { success: true, data: MOCK_SUBSCRIPTIONS.items[3] },
  '/subscriptions/5':              { success: true, data: MOCK_SUBSCRIPTIONS.items[4] },
  '/subscriptions/6':              { success: true, data: MOCK_SUBSCRIPTIONS.items[5] },
  '/subscriptions/1/cancel-guide': { success: true, data: MOCK_CANCEL_GUIDE },
  '/dashboard/reports/monthly':    { success: true, data: MOCK_MONTHLY_REPORT },
  '/notifications/settings':       { success: true, data: MOCK_NOTIFICATION_SETTINGS },
};

function getDemoResponse(url: string): unknown | null {
  for (const [pattern, data] of Object.entries(DEMO_ROUTES)) {
    if (url.endsWith(pattern) || url.includes(pattern + '?')) return data;
  }
  return null;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// JWT 자동 첨부 인터셉터
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 데모 모드: 백엔드 연결 실패 시 목 데이터로 폴백
if (IS_DEMO) {
  apiClient.interceptors.response.use(
    (res) => res,
    (error) => {
      const url: string = error?.config?.url ?? '';
      const mock = getDemoResponse(url);
      if (mock) return Promise.resolve({ data: mock, status: 200, headers: {}, config: error.config });
      return Promise.reject(error);
    },
  );
}

// 에러 처리 인터셉터 (401 → 토큰 갱신)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
            `${apiClient.defaults.baseURL}/auth/refresh`,
            { refreshToken },
          );
          if (data.success && data.data) {
            localStorage.setItem('accessToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
            return apiClient.request(error.config);
          }
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
