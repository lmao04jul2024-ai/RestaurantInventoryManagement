'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthTokens, AuthUser } from '@/types';

/**
 * Auth state persisted to localStorage.
 *
 * ⚠️ Security note: storing refresh tokens in localStorage is acceptable for
 * the current MVP but should be hardened to httpOnly cookies before handling
 * real payment data. Tracked as a follow-up hardening task.
 */
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setCredentials: (user: AuthUser, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setCredentials: (user, tokens) =>
        set({ user, ...tokens, isAuthenticated: true }),

      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'rms-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
