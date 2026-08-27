/**
 * Theme context — supplies the mapped token set to every component and owns
 * the light/dark mode switch. Per-tenant branding plugs in via the `tenant`
 * prop (Customization Engine → Tenant.theme).
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import { createAppTheme, type AppTheme, type TenantBrandOverride } from './tokens';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  /** Tenant.branding override applied on top of default palettes */
  tenant?: TenantBrandOverride;
}

export function ThemeProvider({ children, initialMode = 'light', tenant }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: createAppTheme({ dark: mode === 'dark', tenant }), mode, setMode }),
    [mode, tenant],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }
  return ctx;
}
