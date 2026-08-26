'use client';

import ProtectedRoute from '@/components/auth/protected-route';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import Footer from '@/components/layout/footer';
import UserMenu from '@/components/layout/user-menu';

/**
 * Authenticated staff shell.
 * Roles list intentionally omits CUSTOMER — customers get a separate flow in Week 8+.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={['ADMIN', 'MANAGER', 'KITCHEN', 'SERVER']}>
      <div className="flex min-h-screen flex-col bg-surface-muted">
        <Header right={<UserMenu />} />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-4 lg:p-8">{children}</main>
        </div>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}

