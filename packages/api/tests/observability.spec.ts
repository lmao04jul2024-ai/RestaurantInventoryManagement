/**
 * S4.2 — per-tenant log tagging + request correlation.
 *
 * Supertest against the real app with winston mocked at the transport seam:
 * `createLogger` is replaced with a stub whose `child()` hands back a spy
 * logger, so every emitted line can be asserted without real transports.
 */

jest.mock('winston', () => {
  const requestLog = jest.fn();
  const rootLog = jest.fn();
  const stub = {
    format: Object.assign(jest.fn(() => (x: unknown) => x), {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
    }),
    createLogger: jest.fn(() => ({
      level: 'info',
      log: rootLog,
      error: rootLog,
      add: jest.fn(),
      child: jest.fn(() => ({ log: requestLog, error: requestLog })),
    })),
    transports: { Console: jest.fn() },
  };
  return { __esModule: true, requestLog, rootLog, ...stub, default: stub };
});

import request from 'supertest';
import app from '../src/index';
import { REQUEST_ID_HEADER, logServerError } from '../src/services/logger';
const winstonMock = jest.requireMock('winston') as { requestLog: jest.Mock };

const logged = () => winstonMock.requestLog;

beforeEach(() => logged().mockClear());

// winston's log(level, message, meta) passes the level as the first arg; the
// mock does not merge it into the meta object, so capture both.
const lines = (message: string) =>
  logged()
    .mock.calls.filter(([, m]) => m === message)
    .map(([level, , meta]) => ({ level, ...(meta as Record<string, unknown>) } as Record<string, unknown>));

describe('S4.2 — request correlation + tenant tagging', () => {
  it('echoes a client-supplied X-Request-Id', async () => {
    const res = await request(app).get('/health').set(REQUEST_ID_HEADER, 'trace-123');
    expect(res.status).toBe(200);
    expect(res.headers[REQUEST_ID_HEADER]).toBe('trace-123');
  });

  it('generates an X-Request-Id when the client sends none', async () => {
    const res = await request(app).get('/health');
    expect(res.headers[REQUEST_ID_HEADER]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('logs /health as a quiet debug line with correlation ids', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);

    const health = lines('http_request').find((m) => m.path === '/health');
    expect(health).toBeDefined();
    expect(health!.level).toBe('debug');
    expect(health!.requestId).toBe(res.headers[REQUEST_ID_HEADER]);
    expect(typeof health!.durationMs).toBe('number');
  });

  it('tags api 404 lines with the X-Tenant-ID header, method, status', async () => {
    const res = await request(app)
      .get('/api/definitely-not-a-route')
      .set('X-Tenant-ID', 'tenant-abc');
    expect(res.status).toBe(404);

    const line = lines('http_request').find((m) => (m.path as string).startsWith('/api/'));
    expect(line).toBeDefined();
    expect(line!.level).toBe('info');
    expect(line!.tenantId).toBe('tenant-abc');
    expect(line!.status).toBe(404);
    expect(line!.method).toBe('GET');
    expect(line!.requestId).toBe(res.headers[REQUEST_ID_HEADER]);
  });

  it('emits tagged server_error lines for 5xx (error-handler contract)', async () => {
    const error = jest.fn();
    logServerError(
      {
        method: 'GET',
        originalUrl: '/api/orders',
        headers: {},
        logContext: { requestId: 'req-9', log: { error } },
      } as never,
      new Error('boom'),
      'INTERNAL_ERROR',
    );

    expect(error).toHaveBeenCalledWith(
      'server_error',
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        method: 'GET',
        path: '/api/orders',
        requestId: 'req-9',
        stack: expect.stringContaining('Error: boom'),
      }),
    );
  });
});
