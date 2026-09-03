'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useStaff, useCreateStaff, useUpdateStaff } from '@/hooks/use-staff';
import { getApiErrorMessage } from '@/lib/api';
import type { StaffMember, StaffRole } from '@/types/staff';

const STAFF_ROLES: StaffRole[] = ['MANAGER', 'KITCHEN', 'SERVER'];
const PAGE_SIZE = 10;

/** Roles the API allows to hold per-user overrides (rbac.ts OVERRIDEABLE_ROLES). */
const OVERRIDEABLE: StaffRole[] = ['MANAGER', 'KITCHEN', 'SERVER'];

/** Curated catalog of grantable permissions, mirroring the API RBAC matrix domains. */
const PERMISSION_CATALOG: Array<{ key: string; label: string }> = [
  { key: 'menu:read', label: 'View menu' },
  { key: 'order:create', label: 'Create orders' },
  { key: 'order:read', label: 'View orders' },
  { key: 'order:update:status', label: 'Update order status' },
  { key: 'table:read', label: 'View tables' },
  { key: 'inventory:read', label: 'View inventory' },
  { key: 'inventory:update:stock', label: 'Adjust stock counts' },
  { key: 'inventory:manage', label: 'Manage inventory' },
  { key: 'supplier:read', label: 'View suppliers' },
  { key: 'review:read', label: 'View reviews' },
  { key: 'analytics:read', label: 'View analytics' },
  { key: 'feature-flag:read', label: 'View feature flags' },
  { key: 'staff:read', label: 'View staff directory' },
];

type OverrideChoice = 'default' | 'allow' | 'deny';

/** Tri-state select per permission: role default / explicit allow / explicit deny. */
function overrideChoice(member: StaffMember, key: string): OverrideChoice {
  const value = member.permissionOverrides[key];
  if (value === true) return 'allow';
  if (value === false) return 'deny';
  return 'default';
}

const SELECT_CLS =
  'block w-full rounded border border-gray-300 bg-surface px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

interface Draft {
  firstName: string;
  lastName: string;
  role: StaffRole;
  overrides: Record<string, OverrideChoice>;
}

function toDraft(member: StaffMember): Draft {
  const overrides: Record<string, OverrideChoice> = {};
  for (const { key } of PERMISSION_CATALOG) overrides[key] = overrideChoice(member, key);
  return { firstName: member.firstName, lastName: member.lastName, role: member.role, overrides };
}

function RolePill({ role }: { role: string }) {
  return (
    <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700">
      {role}
    </span>
  );
}

/** Week 16.3/16.5 — staff directory: create staff, edit profiles, ADMIN-only role & override editor. */
export default function StaffPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = {
    page,
    limit: PAGE_SIZE,
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
  };
  const { data, isLoading, isError, error } = useStaff(params);
  const create = useCreateStaff();
  const update = useUpdateStaff();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const selected = data?.data.find((m) => m.id === selectedId) ?? null;

  const [newStaff, setNewStaff] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'SERVER' as StaffRole });

  if (isError) {
    return (
      <Alert tone="error" title="Could not load staff directory">
        {getApiErrorMessage(error)}
      </Alert>
    );
  }

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const canOverride = !!selected && OVERRIDEABLE.includes(selected.role) && isAdmin;

  const saveEdits = async () => {
    if (!selected || !draft) return;
    const payload: Parameters<typeof update.mutateAsync>[0]['payload'] = {};
    if (draft.firstName.trim() !== selected.firstName) payload.firstName = draft.firstName.trim();
    if (draft.lastName.trim() !== selected.lastName) payload.lastName = draft.lastName.trim();
    if (isAdmin && draft.role !== selected.role) payload.role = draft.role;
    if (isAdmin && OVERRIDEABLE.includes(selected.role)) {
      const overrides: Record<string, boolean | null> = {};
      let touched = false;
      for (const { key } of PERMISSION_CATALOG) {
        const choice = draft.overrides[key];
        if (choice === 'allow') (overrides[key] = true), (touched = true);
        else if (choice === 'deny') (overrides[key] = false), (touched = true);
        else if (overrideChoice(selected, key) !== 'default') (overrides[key] = null), (touched = true);
      }
      if (touched) payload.permissionOverrides = overrides;
    }
    try {
      await update.mutateAsync({ id: selected.id, payload });
      setSelectedId(null);
      setDraft(null);
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  const submitCreate = async () => {
    try {
      await create.mutateAsync({
        firstName: newStaff.firstName.trim(),
        lastName: newStaff.lastName.trim(),
        email: newStaff.email.trim(),
        password: newStaff.password,
        role: newStaff.role,
      });
      setNewStaff({ firstName: '', lastName: '', email: '', password: '', role: 'SERVER' });
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="mt-1 text-sm text-content-muted">
          Team directory for your workspace{isAdmin ? ' — role changes and permission overrides are admin-only.' : '.'}
        </p>
      </div>

      <Card className="overflow-x-auto">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <Input label="Search" placeholder="name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-content-default">Filter by role</span>
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as StaffRole | '');
                setPage(1);
              }}
              className={SELECT_CLS}
            >
              <option value="">All roles</option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <Button type="submit">Search</Button>
          <span className="ml-auto pb-2 text-sm text-content-muted" aria-live="polite">
            {data ? `${meta?.total} staff · page ${meta?.page}/${meta?.pages}` : '…'}
          </span>
        </form>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            <span className="sr-only">Loading staff…</span>
          </div>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Staff members</caption>
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-content-muted">
                <th scope="col" className="py-2 pr-4">Name</th>
                <th scope="col" className="py-2 pr-4">Email</th>
                <th scope="col" className="py-2 pr-4">Role</th>
                <th scope="col" className="py-2 pr-4">Overrides</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="py-2 pr-4 text-content-muted">{member.email}</td>
                  <td className="py-2 pr-4"><RolePill role={member.role} /></td>
                  <td className="py-2 pr-4 text-xs text-content-muted">
                    {Object.keys(member.permissionOverrides).length || '—'}
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-expanded={selectedId === member.id}
                      onClick={() => {
                        if (selectedId === member.id) {
                          setSelectedId(null);
                          setDraft(null);
                        } else {
                          setSelectedId(member.id);
                          setDraft(toDraft(member));
                        }
                      }}
                    >
                      {selectedId === member.id ? 'Close' : 'Manage'}
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-content-muted">No staff match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {meta && meta.pages > 1 && (
          <div className="mt-4 flex justify-end gap-2 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
            <Button size="sm" variant="outline" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
          </div>
        )}
      </Card>

      {selected && draft && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">
              Manage {selected.firstName} {selected.lastName}
            </h2>
            <RolePill role={selected.role} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              value={draft.firstName}
              onChange={(e) => setDraft((d) => (d ? { ...d, firstName: e.target.value } : d))}
              disabled={update.isPending}
            />
            <Input
              label="Last name"
              value={draft.lastName}
              onChange={(e) => setDraft((d) => (d ? { ...d, lastName: e.target.value } : d))}
              disabled={update.isPending}
            />
            {isAdmin && (
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-content-default">Role</span>
                <select
                  aria-label="Role"
                  value={draft.role}
                  onChange={(e) => setDraft((d) => (d ? { ...d, role: e.target.value as StaffRole } : d))}
                  disabled={update.isPending}
                  className={SELECT_CLS}
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {canOverride && (
            <fieldset className="rounded border border-gray-100 p-4">
              <legend className="px-1 text-sm font-medium text-content-default">Permission overrides</legend>
              <p className="mb-3 text-xs text-content-muted">
                Explicit allows/denies win over the role matrix. &ldquo;Role default&rdquo; clears any override.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PERMISSION_CATALOG.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-content-default">{label}</span>
                    <select
                      aria-label={`${key} permission`}
                      value={draft.overrides[key]}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, overrides: { ...d.overrides, [key]: e.target.value as OverrideChoice } } : d,
                        )
                      }
                      disabled={update.isPending}
                      className="rounded border border-gray-300 bg-surface px-2 py-1 text-xs"
                    >
                      <option value="default">Role default</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => void saveEdits()} isLoading={update.isPending} disabled={update.isPending}>
              Save changes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedId(null);
                setDraft(null);
              }}
              disabled={update.isPending}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">Add staff member</h2>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submitCreate();
          }}
        >
          <Input
            label="First name"
            value={newStaff.firstName}
            onChange={(e) => setNewStaff((s) => ({ ...s, firstName: e.target.value }))}
            required
            disabled={create.isPending}
          />
          <Input
            label="Last name"
            value={newStaff.lastName}
            onChange={(e) => setNewStaff((s) => ({ ...s, lastName: e.target.value }))}
            required
            disabled={create.isPending}
          />
          <Input
            label="Email"
            type="email"
            value={newStaff.email}
            onChange={(e) => setNewStaff((s) => ({ ...s, email: e.target.value }))}
            required
            disabled={create.isPending}
          />
          <Input
            label="Temporary password"
            type="password"
            value={newStaff.password}
            onChange={(e) => setNewStaff((s) => ({ ...s, password: e.target.value }))}
            required
            disabled={create.isPending}
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-content-default">New staff role</span>
            <select
              aria-label="New staff role"
              value={newStaff.role}
              onChange={(e) => setNewStaff((s) => ({ ...s, role: e.target.value as StaffRole }))}
              disabled={create.isPending}
              className={SELECT_CLS}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end pb-2.5">
            <Button type="submit" isLoading={create.isPending} disabled={create.isPending}>
              Create staff account
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}




