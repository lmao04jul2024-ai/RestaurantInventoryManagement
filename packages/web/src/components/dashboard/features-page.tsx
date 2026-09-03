'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import {
  useCreateFeatureFlag,
  useDeleteFeatureFlag,
  useFeatureFlags,
  useUpdateFeatureConfig,
  useUpdateFeatureFlag,
} from '@/hooks/use-feature-flags';
import { getApiErrorMessage } from '@/lib/api';
import { resolveFlagState, slugifyFlagName } from '@/lib/feature-flags';
import type { FeatureFlag } from '@/types/feature-flags';

function EnabledPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {enabled ? 'On' : 'Off'}
    </span>
  );
}

function FlagRow({ flag }: { flag: FeatureFlag }) {
  const updateFlag = useUpdateFeatureFlag();
  const updateConfig = useUpdateFeatureConfig();
  const remove = useDeleteFeatureFlag();

  const effective = resolveFlagState({
    globalEnabled: flag.globalEnabled,
    tenantOverride: flag.tenantOverride,
  });
  const busy = updateFlag.isPending || updateConfig.isPending || remove.isPending;

  const toggleGlobal = async () => {
    try {
      await updateFlag.mutateAsync({ id: flag.id, payload: { isEnabled: !flag.globalEnabled } });
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  const setOverride = async (value: boolean | null) => {
    try {
      await updateConfig.mutateAsync({ [flag.name]: value });
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete flag '${flag.name}'?`)) return;
    try {
      await remove.mutateAsync(flag.id);
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  return (
    <li className="rounded-card border border-gray-100 bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm font-semibold text-content-default">{flag.name}</code>
            <EnabledPill enabled={effective} />
          </div>
          {flag.description && <p className="mt-0.5 text-sm text-content-muted">{flag.description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-content-muted">
            Global default
            <input
              type="checkbox"
              checked={flag.globalEnabled}
              onChange={() => void toggleGlobal()}
              disabled={busy}
              className="h-4 w-4 accent-primary-600"
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs text-content-muted">
            This restaurant
            <select
              value={flag.tenantOverride === null ? 'default' : flag.tenantOverride ? 'on' : 'off'}
              onChange={(e) => {
                const v = e.target.value;
                void setOverride(v === 'default' ? null : v === 'on');
              }}
              disabled={busy}
              className="rounded border border-gray-300 bg-surface px-2 py-1 text-sm text-content-default"
            >
              <option value="default">Default</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>

          <Button size="sm" variant="danger" disabled={busy} isLoading={remove.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}
/** Week 14.3 — feature flag registry operations + per-tenant overrides. */
export default function FeaturesPage() {
  const { data: flags, isLoading, isError, error } = useFeatureFlags();
  const create = useCreateFeatureFlag();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultOn, setDefaultOn] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await create.mutateAsync({
        name: slugifyFlagName(name),
        description: description.trim() || null,
        isEnabled: defaultOn,
      });
      setName('');
      setDescription('');
      setDefaultOn(false);
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
        />
        <span className="sr-only">Loading feature flags…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert tone="error" title="Could not load feature flags">
        {getApiErrorMessage(error)}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="mt-1 text-sm text-content-muted">
          Toggle features per restaurant or globally — no code deploys required.
        </p>
      </div>

      <Card>
        <p className="text-sm font-medium text-content-default">New flag</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label="Key"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. online_payments"
            hint={name ? `Key will be ${slugifyFlagName(name) || '…'}` : 'lowercase letters, digits, underscores'}
            disabled={create.isPending}
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does it gate?"
            disabled={create.isPending}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm text-content-default">
            <input
              type="checkbox"
              checked={defaultOn}
              onChange={(e) => setDefaultOn(e.target.checked)}
              disabled={create.isPending}
              className="h-4 w-4 accent-primary-600"
            />
            Enabled by default
          </label>
          <Button
            size="sm"
            onClick={() => void handleCreate()}
            disabled={!name.trim() || create.isPending}
            isLoading={create.isPending}
          >
            Create flag
          </Button>
        </div>
      </Card>

      <ul className="grid gap-4">
        {(flags ?? []).map((flag) => (
          <FlagRow key={flag.id} flag={flag} />
        ))}
      </ul>
    </div>
  );
}
