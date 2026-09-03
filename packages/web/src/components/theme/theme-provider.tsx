'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_THEME_PREFS,
  THEME_STORAGE_KEY,
  buildCssVariables,
  loadThemePrefs,
  resolveIsDark,
  saveThemePrefs,
  tenantThemeToPrefs,
  type PresetId,
  type ThemeMode,
  type ThemePrefs,
} from '@/lib/theme';
import { useAuthStore } from '@/store/auth.store';
import { tenantService } from '@/services/tenants.service';

/**
 * Week 13.2/13.4 — theme context. Applies `buildCssVariables` output to
 * :root inline styles (overriding globals.css defaults), stamps `data-theme`
 * for the CSS dark block, and persists every change to localStorage
 * (13.6). SSR-safe: all DOM access happens in effects.
 *
 * Week 17 — prefs carry a `source`: explicit user choices ('local') persist;
 * the tenant branding fallback ('tenant') does not, so a later tenant
 * rebrand still reaches users who never customized. User choices always win.
 */
interface ThemeContextValue {
  prefs: ThemePrefs;
  /** Mode resolved against the OS preference. */
  isDark: boolean;
  systemPrefersDark: boolean;
  setPreset: (preset: PresetId) => void;
  setMode: (mode: ThemeMode) => void;
  setCustom: (primary: string, secondary: string) => void;
  /** Quick light/dark flip for header toggles. */
  toggleDark: () => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePrefs>(DEFAULT_THEME_PREFS);
  const [source, setSource] = useState<'defaults' | 'local' | 'tenant'>('defaults');
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // 13.6 — hydrate stored prefs after mount (client-only).
  useEffect(() => {
    const stored = loadThemePrefs();
    if (stored) {
      setPrefs(stored);
      setSource('local');
    }
  }, []);

  // Week 17 — signed-in fallback: apply the published tenant branding when the
  // user has no explicit local prefs. Silent no-op for anonymous visitors.
  useEffect(() => {
    if (loadThemePrefs()) return; // explicit user prefs always win
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;
    let cancelled = false;
    tenantService
      .getMyTenant()
      .then((tenant) => {
        if (cancelled) return;
        const tenantPrefs = tenantThemeToPrefs(tenant.theme);
        if (tenantPrefs) {
          setPrefs((p) => ({ ...p, ...tenantPrefs }));
          setSource('tenant');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Track the OS preference for `system` mode (guarded: jsdom lacks matchMedia).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    setSystemPrefersDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // 13.3 — apply the resolved variable set + data-theme stamp; persist only
  // choices the user made themselves (tenant fallback stays non-persistent).
  useEffect(() => {
    const isDark = resolveIsDark(prefs.mode, systemPrefersDark);
    const vars = buildCssVariables(prefs, systemPrefersDark);
    const root = document.documentElement;
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (source === 'local') saveThemePrefs(prefs);
  }, [prefs, source, systemPrefersDark]);

  const setPreset = useCallback((preset: PresetId) => {
    setPrefs((p) => ({ ...p, preset }));
    setSource('local');
  }, []);
  const setMode = useCallback((mode: ThemeMode) => {
    setPrefs((p) => ({ ...p, mode }));
    setSource('local');
  }, []);
  const setCustom = useCallback((primary: string, secondary: string) => {
    setPrefs((p) => ({ ...p, preset: 'custom', custom: { primary, secondary } }));
    setSource('local');
  }, []);
  const toggleDark = useCallback(
    () => {
      setSource('local');
      setPrefs((p) => {
        const next: ThemeMode = resolveIsDark(p.mode, systemPrefersDark) ? 'light' : 'dark';
        return { ...p, mode: next };
      });
    },
    [systemPrefersDark],
  );
  const reset = useCallback(() => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    setPrefs(DEFAULT_THEME_PREFS);
    setSource('defaults');
  }, []);

  const value = useMemo(
    () => ({ prefs, isDark: resolveIsDark(prefs.mode, systemPrefersDark), systemPrefersDark, setPreset, setMode, setCustom, toggleDark, reset }),
    [prefs, systemPrefersDark, setPreset, setMode, setCustom, toggleDark, reset],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
