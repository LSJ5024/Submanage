import axios from 'axios';
import type { ApiResponse } from '@subtrack/shared';

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

// 에러 처리 인터셉터
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh Token으로 재발급 시도
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
