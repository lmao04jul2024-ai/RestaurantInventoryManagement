# 📱 Mobile UI Component Library

Week 5 deliverable. Every component consumes tokens from the `ThemeProvider`
context (`src/theme`), which maps the canonical palettes in
`@restaurant/shared/src/tokens.ts`. Re-branding a tenant therefore restyles
every surface at runtime — no rebuilds, mirroring the web CSS-variable system.

## Usage

```tsx
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Button, Card, Input, Spinner, Text } from '@/components/ui';
```

`App.tsx` mounts `<ThemeProvider>` once; components call `useTheme()` internally,
so **no color props are ever required**.

---

## `<Text />`

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `'h1' \| 'h2' \| 'h3' \| 'body' \| 'bodySmall' \| 'caption'` | `'body'` | Type scale matches web typography tokens |
| `tone` | `'default' \| 'muted' \| 'primary' \| 'inverse' \| 'danger'` | `'default'` | Semantic color; theme-aware incl. dark mode |

All other React Native `TextProps` pass through (`style` merges last).

## `<Button />`

| Prop | Type | Default |
| --- | --- | --- |
| `title` | `string` | required |
| `onPress` | `() => void` | required |
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger'` | `'primary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `isLoading` | `boolean` | `false` — shows inline `<Spinner/>`, disables press |
| `disabled` | `boolean` | `false` — 50% opacity via style token |
| `fullWidth` | `boolean` | `false` |

Accessibility: `accessibilityRole="button"`,
`accessibilityState={{ disabled, busy }}`.

## `<Input />`

| Prop | Type | Notes |
| --- | --- | --- |
| `label` | `string` | Caption-style label above field |
| `error` | `string \| null` | Danger tone message + red border |
| `helperText` | `string` | Muted hint shown only when no error |
| …rest | `TextInputProps` | Forwarded first; focus ring is internal state |

Border priority: `error → focused (primary-500) → border token`.

## `<Card />`

| Prop | Type | Default |
| --- | --- | --- |
| `padded` | `boolean` | `true` |
| `onPress` | `() => void` | undefined — wraps children in `Pressable` with press feedback |
| `style` | `ViewStyle` | Card radius/shadow/border derive from tokens |

## `<Spinner />`

| Prop | Type | Default |
| --- | --- | --- |
| `size` | `'small' \| 'large'` | `'large'` |
| `color` | `string` | `theme.primary[600]` |

---

## Theming contract

```
packages/shared/src/tokens.ts      ← canonical hex palettes + helpers
packages/mobile/src/theme/tokens.ts ← RN mapping (createAppTheme)
packages/mobile/src/theme/ThemeProvider.tsx ← mode state + tenant overrides
```

* Dark mode: `setMode('dark')` flips semantic surfaces/text (brand scales stay).
* Tenant branding: pass `tenant={{ primaryColor, secondaryColor }}` to
  `ThemeProvider` (sourced from `Tenant.theme` on login).

## Storybook

Scaffolding lives in `.storybook/` but is intentionally not wired into
package scripts — activating it needs dev-only deps that were skipped to keep
the production tree lean (see `.storybook/README.md` for the 3-step enable).
