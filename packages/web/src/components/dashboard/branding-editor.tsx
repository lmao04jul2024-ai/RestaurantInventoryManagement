'use client';

import { FONT_OPTIONS, type TenantFontId, type TenantTheme } from '@/lib/theme';
import Input from '@/components/ui/input';

interface BrandingEditorProps {
  draft: TenantTheme;
  onChange: (patch: Partial<TenantTheme>) => void;
}

/** Week 17.5 — logo & font branding, drafted into `theme.branding` (not published). */
export default function BrandingEditor({ draft, onChange }: BrandingEditorProps) {
  const branding = draft.branding ?? {};
  const logoUrl = branding.logoUrl ?? '';

  const setBranding = (patch: Partial<NonNullable<TenantTheme['branding']>>) =>
    onChange({ branding: { ...branding, ...patch } });

  return (
    <div className="space-y-5">
      <Input
        label="Logo URL"
        value={logoUrl}
        onChange={(e) => {
          const next = e.target.value.trim();
          setBranding({ logoUrl: next === '' ? null : next });
        }}
        placeholder="https://cdn.example.com/logo.png"
        hint="https only — shown in the dashboard header and the storefront preview"
      />

      {logoUrl !== '' && (
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-10 w-10 rounded border border-gray-200 bg-surface object-contain"
          />
          <p className="text-xs text-content-muted">Logo preview — only https URLs can be published.</p>
        </div>
      )}

      <div>
        <label htmlFor="brand-font" className="mb-1.5 block text-sm font-medium text-content-default">
          Brand font
        </label>
        <select
          id="brand-font"
          value={branding.fontFamily ?? 'inter'}
          onChange={(e) => setBranding({ fontFamily: e.target.value as TenantFontId })}
          className="rounded border border-gray-300 bg-surface px-2 py-1.5 text-sm"
        >
          {Object.entries(FONT_OPTIONS).map(([id, opt]) => (
            <option key={id} value={id}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-content-muted">Web-safe stacks — no font files to host.</p>
      </div>
    </div>
  );
}
