import { NextFunction, Request, Response } from 'express';

/**
 * Minimal typed response double capturing status/json for middleware units.
 * Avoids supertest dependency — sufficient for middleware-level asserts.
 */
export interface MockRes extends Omit<Response, 'statusCode'> {
  statusCode?: number;
  body?: unknown;
}

export function createRes(): MockRes {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
  } as MockRes;

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as MockRes['status'];

  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as MockRes['json'];

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
