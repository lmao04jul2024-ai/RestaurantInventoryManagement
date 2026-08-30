# Lessons Learned

## L001 — Task Termination memory push was skipped
- **Date:** 2026-08-27
- **Pattern:** A previous task concluded without updating the Memory MCP (project snapshot / architectural decisions were never persisted). CRITICAL FAULT logged by the rules system.
- **Rule going forward:** Before presenting any final result, ALWAYS run the termination sequence: update Memory MCP (decisions, snapshot, preferences, lessons) → verify success → append `[MEMORY BANK: UPDATED]`. No exceptions, even for small fixes.
- **Check:** If my final message lacks `[MEMORY BANK: UPDATED]`, the task is not complete.

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
