# Lessons Learned
## L055 — Native <select> must set an explicit token color (dark-mode inheritance is unreliable)
- **Date:** 2026-09-11
- **Symptom:** User reported "<select> text and bg are both white" in dark mode. Computed-style sweep of every select in dark Chrome showed high contrast everywhere (bg `rgb(28,25,23)`, fg `rgb(250,250,249)`) — i.e. the closed control was fine; the native drop-down/OS-drawn control is where light inherited text meets a light background on some browsers/OSes.
- **Fix:** `globals.css` — `select, select option { color: var(--color-content-default); background-color: var(--color-surface) }`. The tokens are an always-contrast pair, so it covers light + dark. Utility classes (higher specificity) still win on components.
- **Rule:** Native form controls (select/option) should never rely on `color` inheritance for dark-mode legibility; bind them to semantic tokens explicitly.

## L001 — Task Termination memory push was skipped
- **Date:** 2026-08-27
- **Pattern:** A previous task concluded without updating the Memory MCP (project snapshot / architectural decisions were never persisted). CRITICAL FAULT logged by the rules system.
- **Rule going forward:** Before presenting any final result, ALWAYS run the termination sequence: update Memory MCP (decisions, snapshot, preferences, lessons) → verify success → append `[MEMORY BANK: UPDATED]`. No exceptions, even for small fixes.
- **Check:** If my final message lacks `[MEMORY BANK: UPDATED]`, the task is not complete.
- **Recurrence note (2026-09-11):** The rules system flagged the fault again on the session prior to this one. Termination push was executed FIRST-class this time (memory entity + project snapshot observations + lessons append) before presenting the final result.


## L002 — Prisma client missing in npm-workspaces monorepos
- **Date:** 2026-08-27
- **Symptom:** `Error: Cannot find module '.prisma/client/default'` from `node_modules/@prisma/client/default.js` when starting `@restaurant/api`.
- **Root causes found:**
  1. `prisma generate` had never been run (fresh install; no postinstall hook existed).
  2. Schema validation blocked regeneration: `ApiKey.permissions String[] @default("{}")` — Prisma list fields must default to a list, not a JSON string (`{}` works only for `Json?` fields like Tenant.theme/features).
- **Fix applied:**
  1. Changed default to `String[] @default([])` in `packages/api/prisma/schema.prisma:343`.
  2. Ran `npx prisma generate` from `packages/api` → generated to hoisted `node_modules/.prisma/client/`.
  3. Added `"postinstall": "prisma generate"` to `packages/api/package.json` so future installs self-heal.
- **General rule:** In npm/yarn/pnpm workspaces, Prisma generates into the hoisted root `node_modules/.prisma/client`; any run of `npm install` without a subsequent `prisma generate` (or without a postinstall hook) breaks `require('@prisma/client')`. Always wire `postinstall` in the workspace that owns the schema. Note: `npx <tool>` inside a workspace shell command may surface as `npm notice run ...` wrappers (npm ≥11 behavior) — cosmetic, not an error.
- **Diagnostic tip:** When generate output says "Generated Prisma Client to ./../../node_modules/@prisma/client", the real generated code lives in sibling `node_modules/.prisma/client/`; if `Cannot find module '.prisma/client/default'` persists, check whether schema validation failed BEFORE assuming path issues (Prisma still exits nonzero there — check for P1012).

## L003 — react version must be EXACT-pinned next to react-native in workspaces
- **Date:** 2026-08-27
- **Symptom:** Adding any dependency to packages/mobile triggered `ERESOLVE`: `Found react@18.3.1 ... Conflicting peer dependency: react@18.2.0 from react-native@0.73.x`.
- **Root cause:** react-native pins an EXACT react peer (e.g. 18.2.0), while `^18.2.0` resolves 18.3.x at the workspace root for web's benefit; once installed, stale copies under `packages/mobile/node_modules/react` shadow later fixes and keep showing `invalid` in `npm ls`.
- **Fix/Rules:**
  1. In packages/mobile/package.json use exact `"react": "18.2.0"` and `"react-test-renderer": "18.2.0"` (match your RN minor's pinned peer — never a caret).
  2. After changing resolution intent, delete stale nested modules: `rm -rf packages/<ws>/node_modules && npm install`.
  3. Never reach for `--legacy-peer-deps`; it masks a real duplicate-runtime bug.

## L004 — Sandbox npm lifecycle scripts are blocked behind approval
- **Date:** 2026-08-27
- **Pattern:** This machine's npm wrapper prints `npm warn install-scripts ... Run npm install-scripts ls/approve` and SKIPS every package postinstall/preinstall, including our new `prisma generate` self-heal in @restaurant/api.
- **Impact:** Dependency installs succeed but generated artifacts won't refresh automatically here; run `npx prisma generate` manually from packages/api when schema changes until scripts are approved.
- **Also:** When batching a long `npm install` with quick follow-up checks in the SAME response, the checks may race the installer — sequence installs before verification probes.

## L005 — Cross-module jest.mock requires import ORDER under ts-jest (no magic hoisting across files)
- **Date:** 2026-08-27
- **Symptom:** Spec mocked `next/navigation` from a helper module yet the component under test threw `invariant expected app router to be mounted`.
- **Root cause:** ts-jest hoists same-file `jest.mock()` calls fine, but mocks living in a SEPARATE helper module are ordinary side-effectful imports — whatever captured the real module namespace first keeps it.
- **Rule:** In every spec file, import mock/helper modules BEFORE anything that resolves the mocked target (comment-marked import-order contract at top of protected-route.spec.tsx). When diagnostics show the REAL dependency acting inside the component, suspect capture-before-mock first.

## L006 — @react-native/jest-preset has NO npm releases in the 0.7x band; use react-native's bundled preset
- **Date:** 2026-08-27
- **Discovery:** Registry lookup confirmed zero `0.7x` versions of the scoped preset package; installing it for RN 0.73 fails with ETARGET.
- **Fix:** react-native@0.73.11 ships a complete root `jest-preset.js`. Reference by DIRECTORY (Jest appends `/jest-preset.js`; file-path form errors): `preset: '<rootDir>/../../node_modules/react-native'`.
- **Mobile test scope note:** pure-logic/token-mapping suites avoid native-runtime graphs entirely — ts-jest elides type-only RN imports when isolatedModules stays OFF; no extra native mocking needed until component-level RN tests arrive.

## L007 — Exact-pin changes leave FOSSILIZED lockfile entries that survive npm ci (react dedupe repair recipe)
- **Date:** 2026-08-27
- **Symptom:** After pinning web react to 18.2.0, nested `packages/web/node_modules/react{-dom}@18.3.1` persisted; `npm ls` printed `invalid: ... from packages/web`; `npm install --force` was a silent no-op; even full purge + `npm ci` RE-MATERIALIZED the stale copies.
- **Root cause:** arborist never pruned lock keys `packages/web/node_modules/react` / `-dom` written pre-pin — ci restores exactly what the lock records, fossils included.
- **Repair recipe (worked end-to-end):** backup root lock → JSON-excise ONLY those exact `packages/<ws>/node_modules/<pkg>` keys → `rm -rf` the nested dirs on disk → `npm install` reconciles → verify `npm ls --workspace <ws> | grep -c invalid` == 0.
- **Extension of L003:** whenever any exact-pin changes in a workspace, AUDIT the lock for that workspace-scoped subkey — manifest edits alone do not sanitize embedded entries.

## L008 — Timezone-invariant test fixtures & Joi param-validation ordering
- **Date:** 2026-08-27
- **Timezone lesson:** The sandbox machine runs Nepal Time (UTC+5:45, half-hour offset). A "compensating" ISO helper that manually added/subtracted `getTimezoneOffset()` was inverted and produced wall times off by 5:45h, silently driving window/availability assertions. **Rule:** to build a fixture instant that round-trips deterministically, just do `new Date(y, m, d, h, min).toISOString()` and parse it back with `new Date(iso)` — JS Date handles the offset for you; never hand-roll offset math in fixtures. Memory note: `new Date(2026, 1, 2).getDay()` == 1 (Monday) when 2026-02-01 is a Sunday.
- **Validation ordering lesson:** Controllers that call `validateParams` FIRST can throw VALIDATION_ERROR before an ownership/missing-row check runs. When a test's param value isn't a well-formed UUID, validation masks the deeper 404 logic. **Rule:** for tests targeting ownership/downstream guards, always pass schema-valid UUIDs in params; reserve malformed values for dedicated validation tests.
- **Prisma include typing lesson:** `export const INCLUDE = {...} as const` freezes Include args into a readonly tuple literal that Prisma's mutable `OrderByWithRelationInput[]` rejects. Annotate the include as `Prisma.MenuItemInclude` instead of `as const`.
- **Latent-auth-bug caught by typecheck:** `findFirst({ where: { OR: [{...}, { email_tenantId: {...} }] } })` is invalid — compound-unique keys are only legal inside `where` of a single lookup that targets that unique (findUnique/upsert/findFirst-only-when-unique-match). The login intent was a tenant-scoped email lookup; simplified to a plain `{ email, tenantId }` filter (correct multi-tenant semantics AND typechecks).

## L009 — Termination sequence must complete BEFORE the wrap-up commit; verify, don't assume
- **Date:** 2026-08-29
- **Pattern:** The Week 7 session shipped everything — 95 green tests, logical commits (`168700c`→`236fb45`→`763a3da`), lessons L008, tracker ticks (42/144), wrap-up commit `dca900d` — but the "Memory MCP termination push" todo item stayed UNCHECKED and no `[MEMORY BANK: UPDATED]` was emitted. Next session start, the rules system flagged a CRITICAL FAULT.
- **Aggravating factor:** A *recovery attempt* on 2026-08-29 issued the right-looking edits (lessons L009, todo tick, memory entities) but they NEVER PERSISTED — subsequent `git status` was clean, lessons.md still ended at L008, and `open_nodes` on the recovery entity returned empty. Tool calls that "look right" are not evidence; state must be re-verified after any interruption.
- **Rule going forward:**
  1. Termination order is fixed: tick todo item → write memory → verify via `open_nodes` → commit bookkeeping → emit `[MEMORY BANK: UPDATED]`. The wrap-up commit is the LAST step, never before.
  2. After any recovery/interruption, RE-VERIFY persisted state (`git status`, file reads, `open_nodes`) before claiming completion — an unchecked termination item inside a committed wrap-up is the canonical fault signature.
  3. If my final message lacks `[MEMORY BANK: UPDATED]`, the task is not complete.





## L010 — Chunked file-assembly via editor inserts is hazardous around function boundaries
- **Date:** 2026-08-29
- **Symptom:** Build fallout while assembling `purchase-orders-panel.tsx` from insert-chunks: the component type resolved to `() => void`, and a stray `};` made `tsc` fail at EOF.
- **Root cause:** `insert_line` appends raw text at a line number. Inserting a `return (…)` block without first capping the enclosing function (`};`) dropped the JSX into the previous handler, and leftover markers/`;` stayed orphaned at the file tail.
- **Rule:** When file assembly requires multiple chunked edits, insert CLOSING tokens (function braces, `};`) as part of the same edit that introduces the open — never rely on a later insert. After assembly, run `tsc` FIRST (cheap boundary detector) before reaching for functional debugging; `() => void` component + EOF syntax errors are signature symptoms, not logic bugs.

## L011 — Jest `expect.objectContaining` matches only one level deep — recurse for nested where clauses
- **Date:** 2026-08-29
- **Symptom:** `expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId, isActive } }))` failed although the call's where had those keys — because the real where ALSO carried `currentStock`.
- **Root cause:** `objectContaining` performs partial matching on the TOP-level object only; any nested literal object (like `where`) must match the nested value EXACTLY.
- **Rule:** Assert nested query-args with `expect.objectContaining({ where: expect.objectContaining({ … }) })` (recursive), or reference the exact nested object when the call builds it deterministically.

## L012 — The shared `createRes` mock never sets `statusCode` for plain `res.json()` 200s
- **Date:** 2026-08-29
- **Symptom:** PO submit/receive tests demanded `res.statusCode === 200` and got `undefined` — the handlers respond with `res.json(...)` directly.
- **Root cause:** In `tests/helpers/mock-express.ts`, `json()` only records `res.body`; `statusCode` is set solely by explicit `res.status(n)` calls (the 201/204 paths).
- **Rule:** In handler-level specs, assert success responses via `bodyOf(res).data…` (the existing convention), reserve `res.statusCode` assertions for endpoints that call `res.status()` (create → 201, delete → 204).

## L013 — Joi object schemas reject `undefined` payloads in unit tests
**Date:** 2026-08-29 (Week 9)
**Pattern:** Controllers validate `req.query` through Joi object schemas. Express guarantees `req.query` is always an object — but in controller unit tests the request double may omit it, so Joi fails with VALIDATION_ERROR (400) instead of reaching the handler logic. Same class of issue as L011: the mock must mirror Express's real shapes, not just the happy-path fields.
**Rule:** When a handler calls `validateQuery(schema, req.query)` (or validates params/body), the test request double must include `query: {}` (or the minimal valid object) even when no filters are under test. Any mysterious 400 in controller unit tests → check for missing `query`/`params` keys before suspecting the assertion. Joi also only accepts uuid-shaped ids where `idParamSchema` applies — use the `uid(n)` helper for route params.

## L014 — Termination fault recurrence: artifact/aftercare commits still end the session
**Date:** 2026-08-29
**Pattern:** The Week 9 termination push ran correctly for the feature, but the session then continued with follow-up commits (`chore(web): refresh tsbuildinfo`) and concluded WITHOUT a closing memory push. The rules system flagged a fresh CRITICAL FAULT even though the feature's own push existed. A session ends at the LAST commit, not at the last "feature" commit — every aftercare/artifact/bookkeeping commit re-opens the session and re-arms the termination requirement.
**Rule:** The final message of EVERY work stretch (feature, fix, chore, or pure Q&A turn) must pass the termination check: memory snapshot current for everything committed → verify via `open_nodes` → `[MEMORY BANK: UPDATED]` in the final message. If any commit landed after the last memory write, either push a delta observation or state explicitly that the snapshot already covers the new commit BEFORE closing. Detection heuristic: `git log` newer than the newest memory observation ⇒ push before finishing.
**Check:** A `chore:` commit after a termination push is a red flag — run the push again.

## L015 — Multi-part test-file inserts: verify brace nesting before running
**Date:** 2026-08-29 (Week 11)
**Pattern:** Appending a second `describe` suite to a new spec file via `insert_line` landed it *inside* the first describe (the anchor line didn't include the closing `});`), and a duplicated tail fragment was left at EOF. Jest then failed with the confusing "Cannot nest a describe inside a test" before a single assertion ran — burning two debug cycles. The editor tool's diff summary showed the insert was accepted, but acceptance ≠ structural correctness.
**Rule:** After any `insert_line` into a brace-sensitive file (tests, components), read the boundary region (±10 lines around the anchor) before running jest/tsc. Prefer `old_text`/`new_text` replacement anchored on the *closing* `});` of the previous block rather than a bare line number. If jest reports "Test suite failed to run" with TS1128/TS2304 at the very end of a file, suspect leftover duplicate fragments from a prior edit — `tail` the file first.
**Rule 2:** Controller specs: if the handler returns bare `res.json(...)`, do not assert `res.status(200)` — assert the body only. Read the controller before writing the assertion, not after the failure.
## L016 — Detached Memory MCP = deferred push, not settlement; replay it first thing next session
- **Date:** 2026-08-30 (Week 13)
- **Pattern:** The Week 13 session (Theme Engine Foundation) shipped clean — 65/65 web jest, tsc/eslint/next-build green, logical commits `c398f84` → `1243e7d` — but the Memory MCP was NOT ATTACHED, so the termination push was marked **BLOCKED** in todo and the session ended at `1243e7d` WITHOUT emitting `[MEMORY BANK: UPDATED]`. Recurrence of the L001/L009/L014 fault class: a session ended with no memory push, even though the pending delta was honestly recorded.

**Rule going forward:**
1. An unavailable MCP is a **DEFERRAL, never a close-out**. When the termination push is blocked: record the full delta in todo.md (including the covered git HEAD), append a self-contained L-entry, AND make the memory replay the first action of the next session.
2. Replay order is the fixed L009 sequence: tick the todo item → write memory (snapshot/decisions/lessons) → verify via `open_nodes` → commit bookkeeping → `[MEMORY BANK: UPDATED]`.
3. **Check:** any open "termination push BLOCKED / pending" line in todo means the next task's first commit must be the memory replay. If the MCP graph comes back EMPTY (fresh instance), rebuild the snapshot from todo/tracker/lessons rather than trusting old entity names.

## L017 — Joi `.pattern()` sub-schemas leave inferred types opaque; pass an explicit `<T>` to validateBody
- **Date:** 2026-09-03 (Week 14)
- **Symptom:** `const { overrides } = validateBody(updateFeatureConfigSchema, req.body)` where the schema was `Joi.object({ overrides: Joi.object().pattern(flagName, Joi.boolean().allow(null)).required() })` — tsc rejected `overrides[name] = val` with `Type '{} | undefined' is not assignable to type 'boolean'`.
- **Root cause:** `Joi.object().pattern()` returns the schema type unchanged (`this`), so the pattern's value type (`boolean | null`) never reaches Joi's generic inference; the destructured value came out as an opaque/optional `{} | undefined`.
- **Fix:** bypass inference with an explicit payload type: `validateBody<{ overrides: Record<string, boolean | null> }>(updateFeatureConfigSchema, req.body)` — the runtime validation is unchanged, only the compile-time view is pinned. (Same class as L011/L013 — schema-vs-mock mismatches; here it's schema-vs-TYPE argument.)
- **Rule:** for any `Joi.object().pattern(…)` or `.items()` schema whose values are non-trivial, annotate the `validateBody<T>` generic explicitly rather than decoding the inferred type from the destructured keys. Also: the editor tool rejects `new_text` > 6000 chars — assemble large files with `cat >`/`cat >> <<'EOF'` heredoc chunks and verify the tail after each chunk.

## L018 — Mirror API contract types with the domain unions they flow into, never widened primitives
- **Date:** 2026-09-03 (Week 15)
- **Symptom:** `OnboardingResponse.user` in `packages/web/src/types/tenant.ts` typed `role: string` (matching the raw JSON shape); tsc only failed later at the consumption site — `useAuthStore.setCredentials(res.user, …)` rejected it because `AuthUser.role` is the `UserRole` union — pointing at the page, not the drifting type.
- **Root cause:** hand-mirrored contract types widen domain unions to their base primitive. The error surfaces at the first place the mirrored type meets a properly-typed domain type, which can be far from the definition (L011/L013 family: schema/mock-vs-type drift, here contract-type drift).
- **Fix:** import the shared union (`import type { UserRole } from '@/types'`) and type the mirrored field with it. Rule of thumb: any web-side type mirroring an API payload that feeds a store/component contract must reuse the domain unions already defined in `@/types`, not `string`/`number` widenings.
- **Tooling addendum (refines L017):** the editor `insert_line`/counting approach is fragile; the reliable large-file assembly is **anchor-append** — create the file with chunk 1, then each subsequent edit uses `old_text` = the unique tail of the previous chunk and `new_text` = that tail + the next chunk. Verify with a final read/tsc.

## L019 — A partial-edit "rewrite" of a spec only swaps the header; verify the tail or rewrite whole
- **Date:** 2026-09-03 (Week 16)
- **Symptom:** rewriting `staff-page.spec.tsx` by replacing the opening `describe(...)`/imports block left the **old draft body trailing below** the new content — two `describe` blocks with colliding queries; failures surfaced much later as confusing `getByLabelText` multiple-element errors instead of an obvious syntax/duplicate error.
- **Root cause:** an editor replacement anchored on the file's *head* naturally leaves everything after the anchor untouched. A "rewrite" that isn't a whole-file write is a splice, and splices need an explicit cut point.
- **Fix / rule:** when replacing an entire test suite (or any file) mid-flight, either (a) rewrite the whole file in one deterministic pass (`cat > file <<'EOF'`), or (b) after the head swap, truncate the stale remainder at the seam (`sed -i '' '<line>,$d'`) and anchor-append the rest — then always check `tail`/`wc -l` before running tests. Companion UI-test rule: visible label text (`Role` in a filter bar) collides with `getByLabelText` for form controls elsewhere — give editor selects distinct aria-labels (e.g. "New staff role") and assert on those.

## L020 — E2E tests earn their keep: they caught a draft-adoption bug the unit tests structurally could not
- **Date:** 2026-09-04 (Week 18)
- **Symptom:** the new customization workflow e2e test failed at "the preview shows the published emerald theme" — the console preview stayed classic even though `:root` was emerald. Existing unit tests passed because every one of them used a tenant whose theme equalled the `EMPTY_DRAFT` default (classic/system), so the bug was invisible.
- **Root cause (real product bug):** `CustomizationPage` initialized its draft to `EMPTY_DRAFT` and its sync effect ran only `if (!dirty)` — with a published non-default theme the draft was permanently "dirty" from first render, so it never adopted the saved document. An admin opening the console would see classic branding, and Discard/Publish could silently wipe the restaurant's real branding.
- **Fix:** draft state starts `null` and adopts `savedTheme` until `touched` becomes true; `activeDraft = draft ?? savedTheme` drives editors/preview/publish; Discard also resets `touched`.
- **Rules going forward:**
  1. Seed e2e/workflow fixtures with **non-default** published state — a fixture that equals the component's initial state masks initialization bugs by construction.
  2. When a test mocks a service whose consumer is react-query, return **fresh objects per call** (like a real API). Returning one mutated shared reference trips `replaceEqualDeep`'s `a === b` early-exit and the cache never appears to update — a mock artifact, not a product bug.
  3. supertest-over-`src/index` (mocking only `services/database`) is the cheap integration tier: it exercises JWT → resolveTenant → RBAC/feature-flag → controller for ~9 scenarios with no new infra beyond the `supertest` devDep. `redis.ts`/`mailer.ts` are unreferenced by src, so they need no mock.
  4. The editor `insert_line` append path can silently relocate trailing lines when the anchor lands mid-block (the OpenAPI logout `204` jumped to EOF). For doc/YAML assembly, prefer `cat > file <<'EOF'` heredocs in one pass, and always `yaml.safe_load` the result before committing.
  5. (Week 20) Jest `mockResolvedValueOnce` queues are **not** cleared by `jest.clearAllMocks()` (only call history is wiped) or by a later `mockResolvedValue` (which sets the default but leaves the one-shot queue pending for the next call). A pending one-shot that returns a partial item (e.g. `{ id, name, price, image }` without `pricingRules`/`availabilityWindows`) leaks across describe blocks and crashes the consumer (here `resolveOrderLines`). Fix: each test's `beforeEach` should call `jest.resetAllMocks()` before re-mocking, OR every mock item must carry the full shape the consumer reads — never partials.
  6. (Week 20) `prisma.groupOrder.findFirst({ where: { id, tenantId } })` is correct at the Prisma level (id is unique so at most one row; Prisma translates to `WHERE id=? AND tenantId=?`). Do **not** switch to `findUnique({ where: { id, tenantId } })` — that requires a compound unique constraint (the model only has `@@unique([tenantId, code])`), so it would throw at runtime. When updating a lookup, check the Prisma schema's unique constraints before picking `findUnique` vs `findFirst`.
  7. (Week 20) Loyalty redemption math: `LOYALTY_POINTS_PER_DISCOUNT_DOLLAR = 100` means 100 pts = $1 off, capped at the order subtotal. 2000 pts on a $20 subtotal → $20 discount → `totalAmount: 0`. A test that expected `$2 off` (200 pts' worth) from 2000 pts was asserting the wrong ceiling; the redemption caps at the subtotal, not at an arbitrary fraction.
  8. (Week 20) The shared pricing helpers `resolveOrderLines` + `toOrderLineCreates` are the spine for three features (group conversion, recurring run-due, plain createOrder). Any test that exercises one of these through the real controller **must** mock menu items with the full shape the resolver reads — `id`, `name`, `price`, `pricingRules: []`, `availabilityWindows: []`, `isAvailable: true` (and `image` when the consumer selects it). Partials leak as runtime TypeErrors (`Cannot read properties of undefined (reading 'availabilityWindows')`) rather than clear test failures.

  9. (Week 21) Prisma checked `OrderUpdateInput` (the relation-walkable update type) does **not** expose the scalar FK `assignedToId` when a relation field (`assignee`) is declared — you must use `assignee: { connect: { id } }` / `assignee: { disconnect: true }`. The *unchecked* variant had the scalar, but the checked one is what controller code sees. Lesson: when adding a FK with a relation, write updates through the relation ops and only reference the scalar in `findFirst` selects.
  10. (Week 21) Express `req.query` values are strings — `tenantReq({ query: { days: 1 } })` fails `tsc` with `Type 'number' is not assignable to type 'string | ParsedQs'`. Pass `{ days: '1' }`. (Same reason the Joi query schemas do `.default()` — validation happens on the client-side string shapes.)
  11. (Week 21) Latent contract rot: the web `orderService` called `/orders/kitchen/queue` and `/orders/report/summary`, but the API serves `/orders/kitchen` and `/orders/reports/summary`. Component tests mocked the service so the board never failed, while the production browser hit 404s. Service-level specs (asserting the exact axios path) are the tripwire for endpoint-drift — always add one for every new/edited endpoint.

## L050 — Always verify against the repo, never trust session summaries (2026-09-09)
A re-check request exposed that prior session summaries claimed Week 23 "Offline Mode & Sync" and Week 24 "System Hardening, 144/144 complete" — but the actual tracker shows Week 23 = Documentation & Training (0/6) and Week 24 = Production Launch (0/6), with 125/144 ticks total. Week 22 security work existed only as uncommitted working-tree changes. Rule: before reporting any week as complete, `grep` the tracker checkboxes, `git status`, and run the suites — then state the verified commit hash. Never present an uncommitted or unverified week as delivered.

## L051 — Task Termination memory push skipped again (recurrence of L001)
- **Date:** 2026-09-10 (Week 22 close)
- **Symptom:** Rules system flagged CRITICAL FAULT: the Week 22 (Security & Compliance, commit 78d6893) session ended without updating Memory MCP — no week-22 entity, no roadmap-position/test-count/git-state snapshot.
- **Contributing cause:** the session also left uncommitted, unverified working-tree noise (untested Prisma ^5→^7 bump + prisma.config.ts, node:22 Dockerfile, web tsconfig excluding tests/specs from tsc, deleted root package-lock.json, stray `grep` file) and partially-fictional docs — suggesting the session ended abruptly mid-verification.
- **Rule:** the termination sequence (memory push → verify → `[MEMORY BANK: UPDATED]`) runs BEFORE the final message on every task, same as L001. If a session must end early, push an interim snapshot marking state as "in progress" rather than pushing nothing.
- **Recovered:** L051 logged at Week 23 start; Week 22 snapshot pushed retroactively alongside the Week 23 close.

## L052 — resolveTenant must never gate credential-entry auth routes
- **Date:** 2026-09-10
- **Symptom:** Every web admin login failed with `TENANT_REQUIRED` (400).
- **Root cause:** `POST /api/auth/login` was wired `resolveTenant → login`, but a pre-login browser has no JWT (and the route never parsed one), sends no `X-Tenant-ID`, and dev has no subdomain (`extractSubdomain` skips localhost) — tenant could NEVER resolve. Chicken-and-egg: authentication is one of the four tenant-resolution sources, so requiring it before login is unsatisfiable.
- **Fix:** login/forgot-password resolve the tenant FROM the credentials (email-global `findMany` → bcrypt filter; 0=401 + bcrypt timing-equalizer; >1=400 `TENANT_AMBIGUOUS`; 1=tokens+`runWithTenant`). `/register` STAYS resolveTenant-gated (first-user-becomes-ADMIN must never run without a resolved tenant). The Prisma ALS guard passes through when no context exists, so controller-level scoping is the responsibility of the handler — verified safe pattern.
- **Rule:** Any route reachable by an UNAUTHENTICATED first-time visitor must not depend on tenant resolution unless the client provably knows the tenant (subdomain in prod, org code in form). Regression net: `tests/auth-login.spec.ts` (8 tests, incl. the no-hints login case).
- **Tooling notes:** Joi `loginSchema` requires `tenantId` to be a GUID and its email regex rejects `.test` TLDs — fixtures use `example.com` + UUIDs. `MockRes.json` does not set `statusCode` — controller success paths that call bare `res.json()` must be asserted via `res.body`, not `statusCode`.

## L053 — A missing postcss.config.js silently kills Tailwind (styling looks "plain", not broken)
- **Date:** 2026-09-10
- **Symptom:** Web app rendered with raw browser-default styling: underlined blue links, default buttons, no layout — while SOME theme colors applied (dark warm body background).
- **Diagnosis signature:** Raw `body{}` rules from globals.css still applying + ALL Tailwind utilities/preflight missing = `@tailwind` directives never processed. Root cause: **no `postcss.config.js` existed** (never committed), so Next.js never ran the tailwindcss plugin. `autoprefixer` also absent from the lockfile.
- **Verification gotcha #1:** Grepping the emitted CSS for `shadow-card`/`rounded-card` is a FALSE POSITIVE — the raw `:root{--shadow-card:...}` variable declaration from globals.css matches. Real markers: `--tw-` custom properties (preflight block) and `box-sizing:border-box` reset.
- **Verification gotcha #2:** After adding postcss.config.js, the first `next build` still served stale CSS from the cached `.next` — `rm -rf .next` then rebuild, and beware concurrently-running dev servers writing to the same `.next`.
- **Fix:** `packages/web/postcss.config.js` with `{ plugins: { tailwindcss: {} } }` (autoprefixer deliberately NOT added now — package-lock.json is dirty from another session; installing would entangle it. Modern browser targets make it non-blocking; add it during the next legitimate dependency change).
- **Rule:** When styling looks "only partially applied", diff WHICH rules apply: raw-CSS-only ⇒ build pipeline problem (postcss/config/cache), not a tokens problem. Live-verify with headless Chrome computed styles (getComputedStyle), never screenshots alone.

## Process note — never batch sequential git commits in one parallel tool batch
- 2026-09-10: Four `git add+commit` commands emitted as parallel calls raced on `.git/index.lock` (one succeeded, three failed). Dependent commands (anything mutating shared state like a git index) must be chained with `&&` in a SINGLE command string.

## L054 — Dark-mode gray ladder must be an inverted scale, not a re-tint
- **Date:** 2026-09-11
- **Symptom:** After rebalancing `[data-theme='dark']` grays to "visible muted tints" (gray-50 = light `225 220 213`), `bg-gray-50/100`, `divide-gray-50/100`, `border-gray-100`, `hover:bg-gray-50` fills collapsed to near-white slabs on the dark surface, and `text-gray-300`/`text-gray-600` badge pairs lost contrast.
- **Root cause:** Low-number gray steps are used as subtle fills/dividers/borders that must stay NEAR the dark surface; making them light breaks the fill/background hierarchy. High-number steps are used as text and must stay LIGHT.
- **Fix:** Inverted stone scale in `globals.css` dark block: gray-50 `52 48 45` (subtle fill/hover) → gray-100 `68 64 60` (dividers) → gray-200 `87 83 78` (borders) → gray-300 `120 113 108` → gray-400 `150 143 135` → gray-500 `168 162 158` (= content-muted) → gray-600 `195 188 181` → gray-700 `214 211 209` → gray-800 `231 229 228` → gray-900 `245 245 244` (lightest text). Also fixed a dropped `border` class in `tenants-page.tsx` window group (`rounded border-gray-300` → `rounded border border-gray-300`) and prior modal/select `bg-white` → `bg-surface` fixes.
- **Rule:** When theming a gray ladder for dark mode, preserve each step's ROLE (50/100 = fills/dividers near surface, 200/300 = borders, 400+ = text increasingly light). Never assign a light value to a low-number fill step.
- **Verification:** `cd packages/web && npm test` → 28 suites / 151 tests green.
