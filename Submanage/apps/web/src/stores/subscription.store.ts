import { create } from 'zustand';

import type { Subscription, CursorPagination } from '@subtrack/shared';
import apiClient from '@/lib/apiClient';

interface SubscriptionState {
  items: Subscription[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;

  fetchList: (cursor?: string, sort?: string) => Promise<void>;
  fetchOne: (id: string) => Promise<Subscription>;
  updateStatus: (id: string, status: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()((set, get) => ({
  items: [],
  nextCursor: null,
  hasMore: false,
  isLoading: false,
  error: null,

  fetchList: async (cursor, sort) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (sort) params.set('sort', sort);
      params.set('limit', '20');

      const { data } = await apiClient.get<{ success: boolean; data: CursorPagination<Subscription> }>(
        `/subscriptions?${params.toString()}`,
      );

      const prev = cursor ? get().items : [];
      set({
        items: [...prev, ...(data.data?.items ?? [])],
        nextCursor: data.data?.nextCursor ?? null,
        hasMore: data.data?.hasMore ?? false,
      });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOne: async (id) => {
    const { data } = await apiClient.get<{ success: boolean; data: Subscription }>(
      `/subscriptions/${id}`,
    );
    return data.data!;
  },

  updateStatus: async (id, status) => {
    await apiClient.patch(`/subscriptions/${id}/status`, { status });
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, status: status as Subscription['status'] } : i)),
    }));
  },

  remove: async (id) => {
    await apiClient.delete(`/subscriptions/${id}`);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  reset: () => set({ items: [], nextCursor: null, hasMore: false }),
}));
