import api from '@/lib/api';
import type {
  AuthTokens,
  AuthUser,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from '@/types';

type LoginResponse = AuthTokens & { user: AuthUser };

/** All endpoints match packages/api/src/routes/auth.routes.ts */
export const authService = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', payload);
    return data;
  },

  async register(payload: RegisterPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/register', payload);
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  },

  /** Returns success regardless of account existence (anti-enumeration) */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/forgot-password', payload);
    return data;
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>('/auth/reset-password', payload);
    return data;
  },

  /**
   * Self-service password change for the signed-in user — the same call serves
   * every role, including the PLATFORM_ADMIN operator (the API route is not
   * tenant-gated). Success revokes every session server-side, so callers must
   * sign the user out afterwards.
   */
  async changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
    const { data } = await api.patch<{ message: string }>('/auth/password', payload);
    return data;
  },
};
