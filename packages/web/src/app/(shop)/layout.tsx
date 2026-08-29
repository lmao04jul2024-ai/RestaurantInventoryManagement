'use client';

import ProtectedRoute from '@/components/auth/protected-route';
import ShopHeader from '@/components/shop/shop-header';
import Footer from '@/components/layout/footer';

/**
 * Customer ordering shell (Week 10) — deliberately separate from the staff
 * dashboard: customers browse the menu, manage their cart and see only their
 * own orders. Staff are bounced to /dashboard?error=forbidden by the gate.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={['CUSTOMER']}>
      <div className="flex min-h-screen flex-col bg-surface-muted">
        <ShopHeader />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}