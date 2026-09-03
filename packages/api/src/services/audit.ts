import prisma from './database';

/**
 * Week 16.6 — immutable audit trail helpers.
 *
 * Rows are append-only: no update/delete surface exists anywhere in the API.
 * The service never throws — audit logging must not break the mutation it
 * records, so failures are logged and swallowed.
 */

export interface AuditLogInput {
  tenantId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to persist audit log', error);
  }
}

export interface AuditLogQuery {
  tenantId: string;
  page?: number;
  limit?: number;
  action?: string;
  targetType?: string;
  targetId?: string;
}

export async function listAuditLogs(query: AuditLogQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;

  const where = {
    tenantId: query.tenantId,
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
  };

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' as const },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { data: logs, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
}
