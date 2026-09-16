'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ProtectedRoute from '@/components/auth/protected-route';
import UserMenu from '@/components/layout/user-menu';
import Footer from '@/components/layout/footer';
import { PLATFORM_ROLES } from '@/types';

/**
 * Phase 5 S2.4 — platform operator shell.
 *
 * Deliberately separate from the tenant dashboard shell: the operator has no
 * tenant context (the API rejects PLATFORM_ADMIN on every tenant surface), so
 * this shell renders its own top bar instead of the tenant Header/Sidebar —
 * neither of which may fetch tenant data here.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ProtectedRoute roles={PLATFORM_ROLES}>
      <div className="flex min-h-screen flex-col bg-surface-muted">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-surface px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/platform/tenants" className="flex items-center gap-2 text-lg font-bold text-primary-700">
              <span aria-hidden>🛠️</span>
              Platform Console
            </Link>
            <nav aria-label="Platform sections" className="hidden gap-4 text-sm sm:flex">
              <Link
                href="/platform/tenants"
                aria-current={pathname.startsWith('/platform/tenants') ? 'page' : undefined}
                className={
                  pathname.startsWith('/platform/tenants')
                    ? 'font-medium text-primary-700'
                    : 'text-content-muted hover:text-content-default'
                }
              >
                Workspaces
              </Link>
            </nav>
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}