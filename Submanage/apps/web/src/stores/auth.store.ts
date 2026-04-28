import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import apiClient from '@/lib/apiClient';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
  isLoggedIn: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setTokens: (access: string, refresh: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      isLoggedIn: false,

      login: async (email, password) => {
        const { data } = await apiClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string };
        }>('/auth/login', { email, password });

        if (!data.success || !data.data) throw new Error('로그인에 실패했습니다.');

        set({
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
          email,
          isLoggedIn: true,
        });
      },

      register: async (email, password, name) => {
        const { data } = await apiClient.post<{
          success: boolean;
          data: { userId: string; email: string };
        }>('/auth/register', { email, password, name });

        if (!data.success) throw new Error('회원가입에 실패했습니다.');
      },

      logout: () =>
        set({ accessToken: null, refreshToken: null, userId: null, email: null, isLoggedIn: false }),

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isLoggedIn: true }),
    }),
    {
      name: 'subtrack-auth',
      // ⚠️ refreshToken만 persist — accessToken은 메모리에 유지하는 것이 더 안전하나
      //    Web SPA 특성상 새로고침 대응을 위해 둘 다 저장 (httpOnly Cookie 전환 권장)
      partialize: (s) => ({ refreshToken: s.refreshToken, email: s.email, isLoggedIn: s.isLoggedIn }),
    },
  ),
);
