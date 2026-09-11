'use client';

import {
  buildCssVariables,
  DEFAULT_THEME_PREFS,
  FONT_FAMILY_VAR,
  FONT_OPTIONS,
  tenantThemeToPrefs,
  type TenantTheme,
} from '@/lib/theme';

interface ThemePreviewCardProps {
  draft: TenantTheme;
  restaurantName: string;
}

const MODE_CAPTION: Record<TenantTheme['mode'], string> = {
  light: 'Light surfaces',
  dark: 'Dark surfaces',
  system: 'System mode (light shown)',
};

/**
 * Week 17.6 — live mini-storefront rendered from the DRAFT tokens inside a
 * scoped container: CSS variables are inherited, so the primary/secondary
 * utilities re-resolve locally without touching :root. Nothing is published.
 */
export default function ThemePreviewCard({ draft, restaurantName }: ThemePreviewCardProps) {
  const prefs = tenantThemeToPrefs(draft) ?? DEFAULT_THEME_PREFS;
  const vars = buildCssVariables(prefs, false);
  const logoUrl = draft.branding?.logoUrl ?? null;

  return (
    <section aria-label="Storefront preview" className="overflow-hidden rounded-card border border-gray-200 shadow-card">
      <p className="border-b border-gray-100 bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
        Storefront preview{draft.branding?.fontFamily ? ` · ${FONT_OPTIONS[draft.branding.fontFamily].label}` : ''}
      </p>
      <div
        data-testid="preview-scope"
        className="bg-surface-muted p-4 font-sans"
        style={{ ...vars, fontFamily: `var(${FONT_FAMILY_VAR})` } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 rounded-card bg-surface px-3 py-2.5 shadow-card">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-7 w-7 rounded border border-gray-200 object-contain" />
          ) : (
            <span aria-hidden className="text-lg">🍽️</span>
          )}
          <span className="truncate font-bold text-primary-700">{restaurantName}</span>
          <span className="ml-auto rounded bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-700">
            Open
          </span>
        </div>

        <div className="mt-3 rounded-card bg-surface p-3 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-content-default">Margherita Pizza</p>
            <p className="text-sm text-content-muted">$12.00</p>
          </div>
          <p className="mt-1 text-xs text-content-muted">San Marzano tomato · fior di latte · basil</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary-600 px-3 py-1.5 text-xs font-semibold text-on-primary">Add to cart</span>
            <span className="rounded bg-secondary-600 px-3 py-1.5 text-xs font-semibold text-on-secondary">Chef&apos;s pick</span>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            <span className="h-1.5 flex-1 rounded-full bg-primary-200" />
            <span className="h-1.5 flex-1 rounded-full bg-primary-400" />
            <span className="h-1.5 flex-1 rounded-full bg-primary-600" />
            <span className="h-1.5 flex-1 rounded-full bg-primary-800" />
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-content-muted">{MODE_CAPTION[draft.mode]}</p>
      </div>
    </section>
  );
}
