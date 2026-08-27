import api from '@/lib/api';
import type {
  AuthTokens,
  AuthUser,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from '@/types';

type LoginResponse = AuthTokens & { user: AuthUser };
type RefreshResponse = AuthTokens;

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

  async refresh(payload: { refreshToken: string }): Promise<RefreshResponse> {
    const { data } = await api.post<RefreshResponse>('/auth/refresh', payload);
    return data;
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
};
