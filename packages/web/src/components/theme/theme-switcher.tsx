'use client';

import { useTheme } from '@/components/theme/theme-provider';
import { PRESETS, type PresetId, type ThemeMode } from '@/lib/theme';

const PRESET_OPTIONS: Array<{ id: PresetId; label: string; swatch: string }> = [
  { id: 'classic', label: 'Classic', swatch: '#ea580c' },
  { id: 'emerald', label: 'Emerald', swatch: '#059669' },
  { id: 'sunset', label: 'Sunset', swatch: '#ea580c' },
  { id: 'custom', label: 'Custom', swatch: 'linear-gradient(135deg,#ef4444,#8b5cf6)' },
];

const MODE_OPTIONS: Array<{ id: ThemeMode; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const SEGMENT =
  'rounded px-3 py-1.5 text-sm font-medium transition-colors aria-checked:bg-primary-50 aria-checked:text-primary-700';

/** Week 13.4 — theme switching UI (presets, mode, custom brand colors). */
export default function ThemeSwitcher() {
  const { prefs, setPreset, setMode, setCustom } = useTheme();
  const custom = prefs.custom ?? { primary: '#ea580c', secondary: '#0d9488' };

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-content-default">Brand preset</legend>
        <div className="flex flex-wrap gap-1 rounded border border-gray-200 bg-surface-muted p-1">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={prefs.preset === opt.id}
              onClick={() => setPreset(opt.id)}
              className={`${SEGMENT} inline-flex items-center gap-1.5`}
            >
              <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-gray-300" style={{ background: opt.swatch }} />
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {prefs.preset === 'custom' && (
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['Primary', 'primary', custom.primary],
              ['Secondary', 'secondary', custom.secondary],
            ] as const
          ).map(([label, key, value]) => (
            <label key={key} className="flex items-center gap-2 text-sm" htmlFor={`custom-${key}`}>
              <span className="font-medium text-content-default">{label}</span>
              <input
                id={`custom-${key}`}
                type="color"
                value={value}
                onChange={(e) =>
                  setCustom(
                    key === 'primary' ? e.target.value : custom.primary,
                    key === 'secondary' ? e.target.value : custom.secondary,
                  )
                }
                className="h-8 w-12 cursor-pointer rounded border border-gray-200 bg-transparent"
              />
              <span className="text-xs text-content-muted">{value}</span>
            </label>
          ))}
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-content-default">Mode</legend>
        <div className="flex gap-1 rounded border border-gray-200 bg-surface-muted p-1">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={prefs.mode === opt.id}
              onClick={() => setMode(opt.id)}
              className={SEGMENT}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-content-muted">
        Presets: {Object.values(PRESETS).map((p) => p.name).join(' · ')} — custom palettes are
        generated from one brand color (13.3).
      </p>
    </div>
  );
}
