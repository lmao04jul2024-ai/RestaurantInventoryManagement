# Security Audit (Week 22.1)

Scope: the `packages/api` HTTP surface and the web client's auth paths.
Method: OWASP ASVS-lite mapping against the implemented controls, verified by
`tests/security.spec.ts` (an executable regression suite — run it with
`npx jest --testPathPattern security`). Findings are tracked below with the
commit/PR where the mitigation landed.

## Threat model

Assets: customer PII (email, name, phone), order/revenue data, tenant
configuration, credentials (passwords, JWTs, session tokens), inventory
records. Trust boundaries: anonymous internet → API, authenticated user →
tenant-scoped data, ADMIN → cross-tenant system data, background jobs
(recurring orders, exports).

## Controls verified & how

| # | Control | Where | Verified by |
|---|---------|-------|-------------|
| 1 | Passwords hashed (bcrypt cost 12) | `auth.controller` register/reset | code review |
| 2 | JWTs signed + verified with issuer/audience; `alg:none` rejected by the library default | `services/jwt.ts` | `security.spec` JWT cases |
| 3 | Multi-tenant scoping on every data access (Week 15 guard + controller-level checks) | `services/tenant-scope.ts`, controllers | `multi-tenant.integration.spec.ts` |
| 4 | RBAC matrix + per-user overrides | `middleware/rbac.ts` | `tenant-scope.spec`, `security.spec` |
| 5 | Mass-assignment protection (`stripUnknown`) | `utils/validation.ts` `validateBody` | `security.spec` injection cases |
| 6 | Security headers (`helmet`), CORS allow-list | `src/index.ts` | `security.spec` header cases |
| 7 | Rate limiting: global + strict auth window, `Retry-After` | `middleware/rate-limit.ts` | `rate-limit.spec.ts` |
| 8 | At-rest protection: session/reset tokens stored as keyed digests | `services/crypto.ts`, `auth.controller` | `crypto.spec.ts` |
| 9 | Immutable audit trail + security events | `services/audit.ts` | `security-monitoring.spec.ts` |
| 10 | GDPR data portability + erasure | `controllers/gdpr.controller.ts` | `gdpr.spec.ts` |
| 11 | Backups with checksum + rotate + restore drill | `scripts/backup.sh`, `docs/deployment/BACKUP.md` | `bash -n` + drill |
| 12 | Request body size cap (1 MB) | `express.json({ limit })` | config review |

## Findings & dispositions

| Finding | Risk | Disposition |
|---------|------|-------------|
| Dev-only `JWT_SECRET` / `ENCRYPTION_KEY` fallbacks let the app boot locally | High in prod | Enforced fallback documented; `GET /api/security/health` flags `encryptionAtRest` when the env key is absent. CI must inject strong secrets. |
| In-memory rate limiter resets on restart / not shareable across instances | Medium | Documented in `rate-limit.ts`; swap-in for the Redis client is noted. Single-node default acceptable for the phase. |
| Refresh session tokens were stored **in plaintext** (`Session.token`) | High (fixed 22.3) | `createSession` now stores only `sensitiveDigest(rawToken)`; plaintext exists solely in the client's JWT. |
| Password-reset codes were stored plaintext with a guessable-prefix scheme | Medium (fixed 22.3) | Stored as `reset-sha256:` digests; lookup uses the same deterministic digest. |
| No lockout on repeated failed logins | Medium | Mitigated by the 10/min auth rate limit; a per-account lockout policy is a follow-up candidate. |
| No CSRF token for state-changing cookie flows | Low | API is bearer-token based (no ambient cookies); CORS restricts origin. Revisit if cookie auth is introduced. |
| Logging of verification/reset tokens at INFO (`console.log` in dev) | Medium | Dev-only path; production should gate these behind a debug flag before launch. |

## Residual risk & roadmap

- Multi-instance rate limiting (Redis bucket) before horizontal scale-out.
- Account lockout / progressive delays after N failed logins.
- Static analysis (Semgrep/CodeQL) wired into CI.
- Dependency scanning (`npm audit` / Dependabot) on every push.
- Encrypt PII columns (phone, profile) once a non-queryable path is confirmed
  — `encryptSensitive` is ready and tested.

## Sign-off

Audit run: Week 22.1 · Reviewer: engineering self-review + automated suite.
Re-run cadence: quarterly, and on any auth/storage change.