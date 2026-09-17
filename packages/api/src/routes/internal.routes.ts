import { Router } from 'express';
import { tlsAsk } from '../controllers/internal.controller';

/**
 * S4.5 — internal automation surface.
 *
 * Mounted at `/api/internal` WITHOUT `authenticate` / `resolveTenant`: these
 * are machine-to-machine hooks for the reverse proxy, not user endpoints. They
 * are not reachable from the internet — the Caddyfile answers 404 for
 * `/api/internal/tls-ask`, so only Caddy's in-network call gets through (see
 * deploy/Caddyfile and docs/deployment/README.md §9).
 */
const router = Router();

router.get('/tls-ask', tlsAsk);

export default router;
