import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import apiClient from '../lib/apiClient';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      email: null,
      isLoggedIn: false,

      login: async (email, password) => {
        const { data } = await apiClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string };
        }>('/auth/login', { email, password });
        if (!data.success) throw new Error('로그인에 실패했습니다.');
        set({ accessToken: data.data.accessToken, refreshToken: data.data.refreshToken, email, isLoggedIn: true });
      },

      register: async (email, password, name) => {
        const { data } = await apiClient.post('/auth/register', { email, password, name });
        if (!data.success) throw new Error('회원가입에 실패했습니다.');
      },

      logout: () => set({ accessToken: null, refreshToken: null, email: null, isLoggedIn: false }),
    }),
    {
      name: 'subtrack-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // React Native: Keychain 연동 권장 (TASK-041)
    },
  ),
);
