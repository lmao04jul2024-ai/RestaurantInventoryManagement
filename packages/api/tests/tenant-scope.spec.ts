import { applyTenantScope, TENANT_SCOPED_MODELS } from '../src/services/tenant-scope';
import { currentTenantId, runWithTenant } from '../src/services/tenant-context';

describe('tenant-scope guard (15.1) — where-bearing operations', () => {
  it('injects tenantId into findMany while preserving existing filters', () => {
    const args = { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } };
    const scoped = applyTenantScope('Order', 'findMany', args, 'tenant-9');
    expect(scoped).toEqual({
      where: { status: 'PENDING', tenantId: 'tenant-9' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('lets the request tenantId win over any pre-scoped key', () => {
    const scoped = applyTenantScope('Order', 'findMany', { where: { tenantId: 'leak' } }, 'tenant-9');
    expect(scoped?.where).toMatchObject({ tenantId: 'tenant-9' });
  });

  it.each(['findFirst', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'])(
    'scopes %s',
    (operation) => {
      const scoped = applyTenantScope('User', operation, { where: { isActive: true } }, 'tenant-9');
      expect(scoped?.where).toMatchObject({ isActive: true, tenantId: 'tenant-9' });
    },
  );

  it('does not require a where to scope', () => {
    const scoped = applyTenantScope('Review', 'count', undefined, 'tenant-9');
    expect(scoped).toEqual({ where: { tenantId: 'tenant-9' } });
  });
});

describe('tenant-scope guard — create (S1.1 hardening)', () => {
  it('injects tenantId when the caller forgot it', () => {
    const scoped = applyTenantScope('Supplier', 'create', { data: { name: 'Acme' } }, 'tenant-9');
    expect(scoped).toEqual({ data: { name: 'Acme', tenantId: 'tenant-9' } });
  });

  it('FORCES the request tenantId over an explicit stale one (S1.1)', () => {
    // Regression: the Week-15 guard used to trust an explicit tenantId, so a
    // stale/malicious value could write cross-tenant rows. The request tenant
    // now always wins, mirroring the where-path semantics.
    const args = { data: { name: 'Acme', tenantId: 'tenant-1' } };
    const scoped = applyTenantScope('Supplier', 'create', args, 'tenant-9');
    expect(scoped).toEqual({ data: { name: 'Acme', tenantId: 'tenant-9' } });
  });

  it('stamps every row of a bulk createMany (array form) with the request tenant', () => {
    const scoped = applyTenantScope('InventoryTransaction', 'createMany', {
      data: [
        { itemId: 'i-1', quantity: 2 },
        { itemId: 'i-2', quantity: 3, tenantId: 'leak' },
      ],
    }, 'tenant-9');
    expect(scoped?.data).toEqual([
      { itemId: 'i-1', quantity: 2, tenantId: 'tenant-9' },
      { itemId: 'i-2', quantity: 3, tenantId: 'tenant-9' },
    ]);
  });

  it('stamps a single-row createMany (object form) with the request tenant', () => {
    const scoped = applyTenantScope('User', 'createMany', { data: { email: 'a@b.com' } }, 'tenant-9');
    expect(scoped?.data).toEqual({ email: 'a@b.com', tenantId: 'tenant-9' });
  });

  it('passes through when there is no data payload (defensive)', () => {
    expect(applyTenantScope('Order', 'create', undefined, 'tenant-9')).toBeUndefined();
    expect(applyTenantScope('Order', 'createMany', undefined, 'tenant-9')).toBeUndefined();
  });
});

describe('S1.2 — cross-tenant isolation matrix (every scoped model × operation)', () => {
  const READ_OPS = ['findMany', 'findFirst', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'] as const;

  it.each([...TENANT_SCOPED_MODELS])('%s: a tenant-9 context can never read tenant-a rows', (model) => {
    for (const op of READ_OPS) {
      const scoped = applyTenantScope(model, op, { where: { tenantId: 'tenant-a', isActive: true } }, 'tenant-9');
      expect((scoped?.where as Record<string, unknown>).tenantId).toBe('tenant-9');
    }
  });

  it.each([...TENANT_SCOPED_MODELS])('%s: a tenant-9 context can never write tenant-a rows', (model) => {
    const create = applyTenantScope(model, 'create', { data: { tenantId: 'tenant-a' } }, 'tenant-9');
    expect((create?.data as Record<string, unknown>).tenantId).toBe('tenant-9');

    const createMany = applyTenantScope(model, 'createMany', { data: [{ tenantId: 'tenant-a' }] }, 'tenant-9');
    for (const row of createMany?.data as Array<Record<string, unknown>>) {
      expect(row.tenantId).toBe('tenant-9');
    }
  });

  it.each([...TENANT_SCOPED_MODELS])('%s: untouched paths stay predictable', (model) => {
    // Unique-where ops are pass-through BY DESIGN — controllers guard them via
    // findFirst-where-tenantId first (documented in the audit: S1.1).
    for (const op of ['findUnique', 'update', 'delete', 'upsert', 'findUniqueOrThrow']) {
      expect(applyTenantScope(model, op, { where: { id: 'x' } }, 'tenant-9')).toBeUndefined();
    }
  });
});

describe('tenant-scope guard — untouched paths', () => {
  it('never touches non-tenant-owned models', () => {
    // FeatureFlag/Session are global; Category/MenuItem/OrderItem are transitively owned.
    for (const model of ['FeatureFlag', 'Session', 'Category', 'MenuItem', 'OrderItem', 'Tenant', 'ApiKey', 'Payment']) {
      expect(applyTenantScope(model, 'findMany', { where: {} }, 'tenant-9')).toBeUndefined();
      expect(applyTenantScope(model, 'create', { data: {} }, 'tenant-9')).toBeUndefined();
    }
  });

  it('never rewrites unique-where operations (findUnique/update/delete/upsert)', () => {
    for (const op of ['findUnique', 'update', 'delete', 'upsert', 'findUniqueOrThrow']) {
      expect(applyTenantScope('Order', op, { where: { id: 'order-1' } }, 'tenant-9')).toBeUndefined();
    }
  });

  it('exposes the intended tenant-owned model set', () => {
    expect([...TENANT_SCOPED_MODELS].sort()).toEqual([
      'GroupOrder',
      'GroupOrderItem',
      'InventoryItem',
      'InventoryTransaction',
      'LoyaltyEntry',
      'Menu',
      'Order',
      'PromoCode',
      'PurchaseOrder',
      'RecurringOrder',
      'ReportTemplate',
      'Review',
      'Supplier',
      'Table',
      'User',
    ]);
  });
});

describe('tenant-context AsyncLocalStorage (15.1)', () => {
  it('is empty outside any request', () => {
    expect(currentTenantId()).toBeUndefined();
  });

  it('exposes the tenant inside runWithTenant', () => {
    runWithTenant('tenant-9', () => {
      expect(currentTenantId()).toBe('tenant-9');
    });
    expect(currentTenantId()).toBeUndefined();
  });

  it('propagates across await boundaries', async () => {
    const seen: Array<string | undefined> = [];
    await runWithTenant('tenant-9', async () => {
      seen.push(currentTenantId());
      await new Promise((resolve) => setTimeout(resolve, 0));
      seen.push(currentTenantId());
    });
    expect(seen).toEqual(['tenant-9', 'tenant-9']);
  });

  it('keeps concurrent runs isolated', async () => {
    let a: string | undefined;
    let b: string | undefined;
    await Promise.all([
      runWithTenant('tenant-a', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        a = currentTenantId();
      }),
      runWithTenant('tenant-b', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        b = currentTenantId();
      }),
    ]);
    expect(a).toBe('tenant-a');
    expect(b).toBe('tenant-b');
  });
});