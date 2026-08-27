import { useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth.service';
import type { AuthUser, LoginPayload, RegisterPayload, UserRole } from '@/types';

/**
 * Primary auth hook — mirrors packages/web/src/hooks/use-auth.ts.
 * Stack switching is handled by the RootNavigator auth-gate, so there is no
 * router dependency here.
 */
export function useAuth() {
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
      clearAuth(); // RootNavigator swaps to the auth stack automatically
    }
  }, [refreshToken, clearAuth]);

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
