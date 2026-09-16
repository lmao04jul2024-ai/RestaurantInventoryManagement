import PlatformTenantDetail from '@/components/platform/platform-tenant-detail';

export const metadata = { title: 'Workspace · Platform Console' };

/**
 * Phase 5 S2.4 — operator workspace detail (/platform/tenants/:id).
 * Params are read on the server and handed to the client editor.
 */
export default function PlatformTenantRoute({ params }: { params: { id: string } }) {
  return <PlatformTenantDetail tenantId={params.id} />;
}