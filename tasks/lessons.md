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

