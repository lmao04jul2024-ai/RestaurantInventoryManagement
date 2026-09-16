'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, user must hold ANY of these roles */
  roles?: UserRole[];
  /** Where unauthenticated users are sent */
  redirectTo?: string;
}

/**
 * Client-side auth gate.
 *
 * Handles the zustand-persist hydration window gracefully: while storage
 * rehydrates we render nothing instead of bouncing a logged-in user to /login.
 * (Server-side middleware remains the real security boundary.)
 */
export default function ProtectedRoute({
  children,
  roles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  // `useAuthStore.persist.hasHydrated()` — re-render when hydration completes
  const [hydrated, setHydrated] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userRole = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace(`${redirectTo}?next=${encodeURIComponent(pathname)}`);
    } else if (roles && userRole && !roles.includes(userRole)) {
      // Phase 5 S2.4 — a platform operator has no tenant dashboard to fall back
      // to (the API rejects PLATFORM_ADMIN on every tenant surface), so send
      // them to the console instead of the dashboard's forbidden banner.
      router.replace(userRole === 'PLATFORM_ADMIN' ? '/platform' : '/dashboard?error=forbidden');
    }
  }, [hydrated, isAuthenticated, userRole, roles, router, pathname, redirectTo]);

  // Hydrating or redirecting — render nothing (avoids flash of protected UI)
  if (!hydrated || !isAuthenticated || (roles && (!userRole || !roles.includes(userRole)))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
        />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return <>{children}</>;
}
