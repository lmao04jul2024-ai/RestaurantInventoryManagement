# API Documentation (Week 18.4)

The complete REST surface of the `@restaurant/api` package is described in
[`openapi.yaml`](./openapi.yaml) (OpenAPI 3.0.3).

## Viewing the spec

- **Swagger UI / Stoplight / Insomnia** — import `docs/api/openapi.yaml` directly.
- **Local preview (optional)**: run any OpenAPI viewer against the file, e.g.

  ```bash
  npx @redocly/cli preview-docs docs/api/openapi.yaml
  ```

- **CI check** — the spec is validated as YAML in the Week 18 verification
  (`python3 -c "import yaml; yaml.safe_load(open('docs/api/openapi.yaml'))"`).

## Conventions

- **Base URL**: `/api/*` (default port `3001`).
- **Auth**: most endpoints require `Authorization: Bearer <accessToken>`. Tokens
  are minted by `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`,
  or tenant onboarding `POST /api/tenants`.
- **Tenant isolation**: the tenant is derived from the JWT. `X-Tenant-ID` and
  `?tenantId=` override the resolution context but are rejected with
  `403 TENANT_MISMATCH` when they disagree with the token's tenant.
- **Envelopes**:
  - success (authed): `{ "data": … }` (create endpoints also set 201)
  - list endpoints add `{ "pagination": { page, limit, total, totalPages } }`
  - error: `{ "error": { code, message, details? } }`
- **RBAC**: permissions (`menu:read`, `inventory:manage`, …) gate most routes;
  hierarchical roles (`ADMIN > MANAGER > KITCHEN/SERVER > CUSTOMER`) back the
  `requireRoleOrHigher` gates. Week 16 per-user permission overrides can deny
  role-granted permissions or grant beyond them.
- **Feature flags (Week 14)**: routes behind `requireFeature(...)` fail closed
  with `403 FEATURE_DISABLED` when the flag is off for the tenant.

## Generated from routes

This file mirrors `packages/api/src/routes/*.routes.ts`. When new endpoints are
added, keep `openapi.yaml` in sync (and update the test counts / docs in the
project tracker).