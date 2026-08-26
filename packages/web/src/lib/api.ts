import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

/**
 * Central API client.
 * - Attaches Authorization + X-Tenant-ID headers automatically.
 * - On 401, performs a single-flight token refresh then retries once.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: auth headers ────────────────────────────────────────
api.interceptors.request.use((config) => {
  const { accessToken, user } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  // Tenant isolation header (resolved server-side via middleware)
  if (user?.tenantId && !config.headers['X-Tenant-ID']) {
    config.headers['X-Tenant-ID'] = user.tenantId;
  }
  return config;
});

// ── Response interceptor: single-flight refresh on 401 ──────────────────────
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) throw new Error('No refresh token available');

  try {
    // Use a bare axios call to avoid re-triggering this interceptor
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_BASE_URL}/api/auth/refresh`,
      { refreshToken },
    );
    useAuthStore.getState().setTokens(res.data);
    return res.data.accessToken;
  } catch {
    // Refresh failed — session is dead, clear everything and redirect
    useAuthStore.getState().clearAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?session=expired`;
    }
    throw new Error('Session expired');
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh for authenticated 401s; never retry login/register themselves
    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      refreshPromise ??= refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      refreshPromise = null;
      return Promise.reject(refreshError);
    }
  },
);

/** Extracts the API's standard `{ error: { code, message } }` envelope */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: { message?: string; code?: string } };
    return payload?.error?.message ?? 'Something went wrong. Please try again.';
  }
  return error instanceof Error ? error.message : 'Unexpected error';
}

/** Extracts the machine-readable error code (e.g. EMAIL_EXISTS, TENANT_REQUIRED) */
export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: { code?: string } };
    return payload?.error?.code;
  }
  return undefined;
}

export default api;
