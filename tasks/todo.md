# Week 17 — Customization UI & Admin Dashboard (17.1–17.6)

## Context
- Tracker 90/144 (Weeks 1–11, 13–16 done; 12 skipped per user). Next: Week 17 Customization UI & Admin Dashboard.
- Already shipped in earlier weeks (ticks 17.3/17.4 are consolidation, not rebuild): feature-flag config UI (Week 14 `/dashboard/features`), tenant management UI (Week 15 `/dashboard/tenants`).
- Gap: theme engine (Week 13) is per-user localStorage only; `Tenant.theme Json?` exists but is unused end-to-end. Week 17 makes branding tenant-level, persisted, previewable.

## Plan
### API
- [ ] validation.ts: `tenantThemeSchema` (preset classic|emerald|sunset|custom, mode light|dark|system, custom primary/secondary 6-digit hex, branding.logoUrl https URI ≤500, branding.fontFamily inter|georgia|trebuchet|mono, whole object allow(null)); add `theme` to `updateTenantSchema`
- [ ] tenant.controller `updateMyTenant`: accept `theme`; map JSON `null` (theme + operatingHours) to `Prisma.DbNull` (raw null throws on real Prisma Json? columns)
- [ ] Tests: tenant-api.spec Week 17 block — persists valid theme, rejects bad hex / non-https logo (400), theme null → DbNull

### Web
- [ ] lib/theme.ts: `FONT_OPTIONS` catalog + `TenantFontId`; `ThemePrefs.font?`; `buildCssVariables` emits `--font-family-sans`; `isValidThemePrefs` accepts font; `tenantThemeToPrefs()` mapper
- [ ] types/tenant.ts: `TenantTheme`/`TenantBranding` (reuse domain unions per L018); `TenantProfile.theme?`; `TenantUpdatePayload.theme?`
- [ ] theme-provider: track prefs `source` (defaults/local/tenant — only local persists); signed-in fallback applies `tenant.theme` when no local prefs (user prefs always win)
- [ ] 17.1 `/dashboard/customize` ADMIN console: tabbed layout (Appearance | Branding | Features & Settings), sidebar 🎨 (ADMIN) + dashboard-index quick link
- [ ] 17.2 theme-editor (presets, custom colors, default mode) → draft → Publish `PATCH /tenants/me { theme }`
- [ ] 17.5 branding-editor (logo URL w/ preview, font select) into `theme.branding`
- [ ] 17.6 theme-preview-card: scoped mini-storefront rendered from draft CSS vars + font (live, pre-publish)
- [ ] 17.3/17.4 links tab → cross-links to /dashboard/features + /dashboard/tenants
- [ ] header.tsx: render tenant logo when `theme.branding.logoUrl` set (dashboard shell)
- [ ] Tests: theme.spec font/tenantThemeToPrefs additions; customization-page.spec; tenant-theme provider fallback spec

## Verification
- [ ] API: tsc 0, eslint clean-ish, jest green (+new)
- [ ] Web: tsc 0, jest green (+new), eslint, `next build` exit 0
- [ ] Tracker ticks 17.1–17.6 (96/144); todo close-out; commits api → web → bookkeeping; memory termination push

## Notes
- API PATCH /tenants/me stays MANAGER+ (Week 15 contract unchanged); the console UI is ADMIN-only per the Customization Engine spec ("only admins can change themes").
- Tenant theme applies app-wide only to signed-in users (no public tenant-resolution endpoint for anonymous shoppers yet — documented limitation).

## Review
- **Converged design:** tenant branding lives in the existing `Tenant.theme Json?` column (no new model), validated by a single `tenantThemeSchema` and surfaced through the self-service `PATCH /api/tenants/me` (Week 15 contract unchanged — still MANAGER+). The console UI is ADMIN-only per the Customization Engine spec.
- **Three-way type sync:** `TenantTheme`/`TenantFontId` live in `lib/theme.ts` (the engine's domain), re-exported from `types/tenant.ts` for the API-contract mirror, and mirrored by the server `tenantThemeSchema` union — documented at each site.
- **Preview isolation:** the live storefront preview renders inside a scoped container whose CSS vars are inherited, so drafting never touches `:root` (no flash to the rest of the dashboard).
- **Persistence semantics:** provider tracks prefs `source` (defaults/local/tenant); only explicit user choices persist to localStorage, so a later tenant rebrand still reaches users who never customized, and anonymous visitors never trigger a tenant fetch.
- **Latent fix:** `updateMyTenant` now maps JSON `null` to `Prisma.DbNull` for both `theme` and `operatingHours` (raw `null` throws on real Prisma `Json?` columns — the operatingHours path shipped in Week 15 was silently broken for the clear case).
- **Verification:** api tsc 0 / 214 green (+5) · web tsc 0 / eslint 0 / 112 green (+~16) · `next build` exit 0, `/dashboard/customize` 9.88 kB, 24 routes.
- **Commit split:** api `b164fa6` → web `1e08f9f` → bookkeeping (tracker 96/144, todo).
