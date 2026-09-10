# Week 23 — Documentation & Training Materials (23.1–23.6)

## Context
- HEAD 78d6893 (Week 22 committed). Tracker 125/144; Week 23 adds 6 → 131/144.
- Prior session left partial Week 23 work uncommitted + out-of-scope noise (Prisma ^7 bump, node:22 Dockerfile, web tsconfig excluding tests, deleted lockfile) — noise REVERTED at session start per L050.
- Memory MCP had no Week 22 push (L001 recurrence) → log as L051, push Week 22+23 at close.

## Plan
- [x] Revert out-of-scope working-tree noise; remove prisma.config.ts + stray `grep` file
- [x] 23.1 Fix docs/api/README.md factual errors (66 paths/26 schemas, /api/menus, /api/orders/kitchen*, GDPR=/api/me+/api/me/data, /api/audit-logs, suppliers row, drop VERSION_CONFLICT)
- [x] 23.2 Fix docs/manuals: server.md §5 fictional offline sync → real behavior; kitchen.md unclosed backtick
- [x] 23.3 Create docs/training/decks/{customer,server,kitchen,manager,admin}.md (slide-style, exercise per deck)
- [x] 23.4 docs/deployment/OPERATIONS.md (monitoring/alerting/runbooks; link from README)
- [x] 23.5 docs/troubleshooting/README.md
- [x] 23.6 docs/onboarding/README.md (new-client onboarding)
- [x] Tracker 23.1–23.6 → 131/144; lessons L051; todo update
- [x] Verify: link-check all docs relative links, yaml.safe_load openapi, git status clean of noise
- [x] Commits: docs commit → bookkeeping commit; Memory push (Week 22 retro + Week 23) + [MEMORY BANK: UPDATED]

## Review (2026-09-10)
- All 6 deliverables complete; noise reverted (Prisma 7/Docker/node22/tsconfig/lockfile); L051 logged.
- Factual fixes: api guide 66/26 + real paths (/api/menus, /api/orders/kitchen*, /api/me(+data), /api/audit-logs, suppliers), removed nonexistent VERSION_CONFLICT; server manual offline-sync section rewritten; kitchen backtick; seed command.
- Verified: 0 broken relative links in docs/, openapi yaml valid (66 paths/26 schemas), tracker 131/144, working tree = docs + bookkeeping only.
- Commits: docs commit → bookkeeping commit; memory pushed (Week 22 retro + Week 23).
