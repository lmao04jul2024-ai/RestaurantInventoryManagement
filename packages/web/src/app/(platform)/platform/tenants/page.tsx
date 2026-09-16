import PlatformTenantsPage from '@/components/platform/platform-tenants-page';

export const metadata = { title: 'Workspaces · Platform Console' };

/** Phase 5 S2.4 — the operator's workspace list (/platform/tenants). */
export default function PlatformTenantsRoute() {
  return <PlatformTenantsPage />;
}