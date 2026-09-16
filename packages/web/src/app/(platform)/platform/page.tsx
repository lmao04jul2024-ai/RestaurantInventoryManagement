import { redirect } from 'next/navigation';

/** The console root is the workspace list. */
export default function PlatformIndexRoute() {
  redirect('/platform/tenants');
}