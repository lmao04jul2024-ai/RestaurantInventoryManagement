/**
 * Auth state persisted to AsyncStorage (mobile equivalent of the web app's
 * localStorage-backed store — keep the shape/actions in sync).
 *
 * ⚠️ Security note: storing refresh tokens on-device is acceptable for the
 * current MVP but should be hardened to Keychain/Keystore before handling real
 * payment data. Tracked as a follow-up hardening task alongside the web's
 * httpOnly-cookie migration.
 */
import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens, AuthUser } from '@/types';

interface AuthState {
  /** null until the persisted store finishes rehydrating */
  _hasHydrated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setHasHydrated: (hydrated: boolean) => void;
  setCredentials: (user: AuthUser, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),

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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ _hasHydrated: _, setHasHydrated: __, ...persisted }) => persisted,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/**
 * Hydration-safe gate — mirrors the web's ProtectedRoute behavior: returns
 * false during the AsyncStorage read window so navigators never bounce a
 * valid session to /login before rehydration completes.
 */
export function useHasHydratedAuth(): boolean {
  const [hasHydrated, setHasHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    return useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, []);

  return hasHydrated;
}
