'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';
import type { AuthUser, LoginPayload, RegisterPayload, UserRole } from '@/types';

/**
 * Primary auth hook. Wrap components in <ProtectedRoute /> for gating;
 * use this hook for programmatic access to session state & actions.
 */
export function useAuth() {
  const router = useRouter();
  const { user, accessToken, refreshToken, isAuthenticated, setCredentials, clearAuth } =
    useAuthStore();

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await authService.login(payload);
      setCredentials(res.user, { accessToken: res.accessToken, refreshToken: res.refreshToken });
      return res.user;
    },
    [setCredentials],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const res = await authService.register(payload);
      setCredentials(res.user, { accessToken: res.accessToken, refreshToken: res.refreshToken });
      return res.user;
    },
    [setCredentials],
  );

  const logout = useCallback(async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } finally {
      clearAuth();
      router.replace('/login');
    }
  }, [refreshToken, clearAuth, router]);

  /** Role check helper — case-safe against the API's uppercase roles */
  const hasRole = useCallback(
    (...roles: UserRole[]) => !!user && roles.includes(user.role),
    [user],
  );

  return {
    user,
    accessToken,
    isAuthenticated,
    login,
    register,
    logout,
    hasRole,
  };
}

export type { AuthUser };
