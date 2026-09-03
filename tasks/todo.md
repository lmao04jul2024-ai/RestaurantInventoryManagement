# Week 16 — Role-Based UI & Permissions (Complete)

## Context
- Tracker ticks 16.1–16.6 (Role-Based UI & Permissions); memory title "Push Notifications" was stale (old roadmap) — corrected at termination.
- Latent bug fixed: `(dashboard)/page.tsx` collided with `app/page.tsx` at `/`; `/dashboard` (login fallback + sidebar link) 404'd. Dashboard home moved to `(dashboard)/dashboard/page.tsx`, old file deleted.

## Plan (as implemented — converged staff/audit architecture)
### API
- [x] Schema: `User.permissionOverrides Json?` (deny/allow map) + `AuditLog` model (tenantId, actorId, action, targetType, targetId, metadata) → `prisma generate`
- [x] rbac.ts: exported `ROLE_HIERARCHY`; `OverrideAwareRequest` + `hasPermissionWithOverrides` (role matrix + per-user override, deny wins); requirePermission/requireAnyPermission consult `req.permissionOverrides` (undefined fallback → pure matrix, backwards compatible); `staff:read`/`staff:manage` matrix entries
- [x] tenant.ts `resolveTenant`: fetches `user.permissionOverrides` alongside the tenant → `req.permissionOverrides`
- [x] services/audit.ts (`writeAuditLog` never-throw, `listAuditLogs` w/ filters+pagination); staff.controller: `listStaff`/`createStaff`/`updateStaff` (role + tri-state overrides, `CANNOT_MODIFY_ADMIN`, `CANNOT_CHANGE_OWN_ROLE`, tenant-scoped, audited transactionally) + `getAuditLogs`; routes `/api/staff` (staff:read/staff:manage) + `/api/audit` (ADMIN); validation schemas; index mounts
- [x] Tests: staff-audit.spec **24 tests** (override matrix, scoping/guards, merge semantics, audit rows; tenant-spec mock updated for the user lookup)

### Web
- [x] types/staff.ts + services/staff.service.ts + hooks/use-staff.ts (list/create/update w/ tri-state payload)
- [x] `(dashboard)/dashboard/page.tsx` role-aware home (`dashboard-index.tsx`) — **deleted** `(dashboard)/page.tsx` (fixes `/dashboard` 404 + `/` collision)
- [x] `/dashboard/staff` staff-page (directory w/ role filter, create form, ADMIN-only tri-state editor over client `PERMISSION_CATALOG`); `/dashboard/audit` audit-page viewer; sidebar 👥/🛡️ entries
- [x] tests: staff.service / staff-page / audit-page suites (+14) with L019-informed label/aria fixes

## Verification
- [x] API: tsc 0; eslint 0 errors (28 pre-existing warnings); jest **209/209** (+24)
- [x] Web: tsc 0; jest **99/99** (+14); eslint clean; `next build` exit 0 — `/dashboard` 2.67 kB, `/dashboard/staff` 3.58 kB, `/dashboard/audit` 1.89 kB, no duplicate `/`
- [x] Root fan-out ROOT_EXIT=0 — **344 green** (api 209 / web 99 / shared 31 / mobile 5)

## Commit split
- [x] api `4967dcb` → web `33d31ea` (includes deletion of `(dashboard)/page.tsx`) → bookkeeping (tracker 90/144, L019, todo)

## Wrap-up
- [x] Tracker ticks (90/144); lesson L019; todo close-out
- [x] Memory MCP termination push per L009/L016: tick → write → verify (`open_nodes`) → commit → `[MEMORY BANK: UPDATED]` (stale "Week 16 Push Notifications" title corrected)

## Review
- **Converged design:** dedicated `staff.controller` + `/api/staff` (staff:read/staff:manage) instead of extending user.controller; `GET /api/audit` gated by `requireRole(ADMIN)` (not a permission); permission catalog lives client-side (`PERMISSION_CATALOG` in staff-page) — the server validates overrides as a `boolean|null` map with deny-wins semantics (L017-typed `validateBody`).
- **Guard rails:** ADMIN targets immutable via staff API, no self-role-change, tenant-scoped lookups, audit rows written in the same `$transaction` as mutations; `AuditLog` never read-modified (insert-only service).
- **Override plumbing:** `resolveTenant` attaches `req.permissionOverrides`; `hasPermissionWithOverrides` keeps existing suites green (no overrides → pure role matrix).
- **Latent routing bug fixed:** `/dashboard` (login fallback + sidebar href) had no route while `(dashboard)/page.tsx` shadowed `/`; now `/dashboard` is the role-aware home and `/` is solely the marketing page.
- **Lesson L019:** partial-edit spec rewrites leave the stale body trailing — truncate at the seam (`sed -i '' '<line>,$d'`) or rewrite whole, then check `tail`/`wc -l`; give form controls aria-labels distinct from visible filter labels.
