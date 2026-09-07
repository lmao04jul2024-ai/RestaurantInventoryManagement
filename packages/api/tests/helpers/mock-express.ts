import { NextFunction, Request, Response } from 'express';

/**
 * Minimal typed response double capturing status/json for middleware units.
 * Avoids supertest dependency — sufficient for middleware-level asserts.
 */
export interface MockRes extends Omit<Response, 'statusCode'> {
  statusCode?: number;
  body?: unknown;
  /** Captured setHeader/writeHead calls for export & SSE assertions. */
  headers: Record<string, string>;
}

export function createRes(): MockRes {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
  } as MockRes & { headers: Record<string, string> };

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as MockRes['status'];

  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as MockRes['json'];

  // Week 19 — export/stream flows need header + raw-body doubles.
  res.setHeader = jest.fn((name: string, value: string) => {
    res.headers[name] = value;
    return res;
  }) as unknown as MockRes['setHeader'];
  res.send = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as MockRes['send'];
  res.end = jest.fn(() => res) as unknown as MockRes['end'];
  res.writeHead = jest.fn((code: number, headers?: Record<string, string>) => {
    res.statusCode = code;
    Object.assign(res.headers, headers ?? {});
    return res;
  }) as unknown as MockRes['writeHead'];
  res.write = jest.fn(() => true) as unknown as MockRes['write'];

  return res;
}

export const next = jest.fn() as NextFunction;

/**
 * Casts a sparse literal into Express Request/TenantRequest safely:
 * middleware under test only touches headers/query/user/host.
 */
export function asRequest<T extends Request>(partial: Partial<T>): T {
  return partial as unknown as T;
}
