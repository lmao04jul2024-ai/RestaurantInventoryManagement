'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import ThemeEditor from '@/components/dashboard/theme-editor';
import BrandingEditor from '@/components/dashboard/branding-editor';
import ThemePreviewCard from '@/components/dashboard/theme-preview-card';
import { useAuth } from '@/hooks/use-auth';
import { useTenant, useUpdateTenant } from '@/hooks/use-tenant';
import { getApiErrorMessage } from '@/lib/api';
import type { TenantTheme } from '@/lib/theme';

const EMPTY_DRAFT: TenantTheme = { preset: 'classic', mode: 'system' };

type TabId = 'appearance' | 'branding' | 'links';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'branding', label: 'Branding' },
  { id: 'links', label: 'Features & Settings' },
];

const SEGMENT =
  'rounded px-3 py-1.5 text-sm font-medium transition-colors aria-selected:bg-primary-50 aria-selected:text-primary-700';

/**
 * Week 17.1 — admin customization console: 17.2 theme editor, 17.5 branding,
 * 17.6 live preview; 17.3/17.4 cross-link the shipped flags/tenant surfaces.
 * Drafting is local-only; Publish PATCHes the tenant-wide `theme` document.
 */
export default function CustomizationPage() {
  const { user, hasRole } = useAuth();
  const { data: tenant, isLoading, isError, error } = useTenant();
  const updateTenant = useUpdateTenant();

  const [tab, setTab] = useState<TabId>('appearance');
  // null until the first saved document arrives — the draft then ADOPTS the
  // published theme (Week 18 fix: a non-default published theme previously
  // never reached the preview, so an admin could accidentally wipe branding).
  const [draft, setDraft] = useState<TenantTheme | null>(null);
  const [touched, setTouched] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const savedTheme: TenantTheme = tenant?.theme ?? EMPTY_DRAFT;
  const activeDraft: TenantTheme = draft ?? savedTheme;
  const dirty = useMemo(
    () => JSON.stringify(activeDraft) !== JSON.stringify(savedTheme),
    [activeDraft, savedTheme],
  );

  // Keep the draft aligned with the saved document until the user starts
  // editing (touched); after a publish/discard the clean draft re-syncs too.
  useEffect(() => {
    if (!touched) setDraft(savedTheme);
  }, [savedTheme, touched]);

  if (!hasRole('ADMIN')) {
    return (
      <Alert tone="error" title="Admins only">
        Customization is restricted to restaurant admins{user ? '' : ' — please sign in'}.
      </Alert>
    );
  }

  const handlePublish = async () => {
    setPublishError(null);
    try {
      await updateTenant.mutateAsync({ theme: activeDraft });
    } catch (err) {
      setPublishError(getApiErrorMessage(err));
    }
  };

  const setDraftFrom = (patch: Partial<TenantTheme>) => {
    setTouched(true);
    setDraft((d) => ({ ...(d ?? EMPTY_DRAFT), ...patch }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customize</h1>
          <p className="mt-1 text-sm text-content-muted">
            Brand your restaurant — palette, logo & fonts with a live preview before publishing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Unsaved changes</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTouched(false);
              setDraft(savedTheme);
              setPublishError(null);
            }}
            disabled={!dirty || updateTenant.isPending}
          >
            Discard
          </Button>
          <Button
            size="sm"
            onClick={() => void handlePublish()}
            disabled={!dirty || updateTenant.isPending}
            isLoading={updateTenant.isPending}
          >
            Publish
          </Button>
        </div>
      </div>

      {publishError && <Alert tone="error" title="Could not publish">{publishError}</Alert>}
      {updateTenant.isSuccess && !dirty && (
        <Alert tone="success" title="Published">Your branding is live for signed-in users.</Alert>
      )}

      <div
        role="tablist"
        aria-label="Customization sections"
        className="flex flex-wrap gap-1 rounded border border-gray-200 bg-surface-muted p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={SEGMENT}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <span
                aria-hidden
                className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
              />
              <span className="sr-only">Loading branding…</span>
            </div>
          ) : isError ? (
            <Alert tone="error" title="Could not load branding">
              {getApiErrorMessage(error)}
            </Alert>
          ) : (
            <>
              {tab === 'appearance' && (
                <Card>
                  <h2 className="font-semibold">Appearance</h2>
                  <p className="mt-1 text-sm text-content-muted">
                    Default palette &amp; appearance for your restaurant.
                  </p>
                  <div className="mt-4">
                    <ThemeEditor draft={activeDraft} onChange={setDraftFrom} />
                  </div>
                </Card>
              )}
              {tab === 'branding' && (
                <Card>
                  <h2 className="font-semibold">Branding</h2>
                  <p className="mt-1 text-sm text-content-muted">Logo &amp; typography for your storefront.</p>
                  <div className="mt-4">
                    <BrandingEditor draft={activeDraft} onChange={setDraftFrom} />
                  </div>
                </Card>
              )}
              {tab === 'links' && (
                <div className="space-y-4">
                  <Link href="/dashboard/features" className="block transition-shadow hover:shadow-card">
                    <Card>
                      <span aria-hidden className="text-xl">🎛️</span>
                      <h2 className="mt-2 font-semibold">Feature flags</h2>
                      <p className="mt-1 text-sm text-content-muted">
                        Toggle features per restaurant or globally — no code deploys required.
                      </p>
                      <p className="mt-2 text-sm font-medium text-primary-700">Manage feature flags →</p>
                    </Card>
                  </Link>
                  <Link href="/dashboard/tenants" className="block transition-shadow hover:shadow-card">
                    <Card>
                      <span aria-hidden className="text-xl">⚙️</span>
                      <h2 className="mt-2 font-semibold">Tenant settings</h2>
                      <p className="mt-1 text-sm text-content-muted">
                        Profile, config, operating hours, plan &amp; billing.
                      </p>
                      <p className="mt-2 text-sm font-medium text-primary-700">Manage settings →</p>
                    </Card>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:sticky lg:top-20">
          <ThemePreviewCard draft={activeDraft} restaurantName={tenant?.name ?? 'Your restaurant'} />
        </div>
      </div>
    </div>
  );
}
