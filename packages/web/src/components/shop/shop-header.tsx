'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useCartStore, cartItemCount } from '@/store/cart.store';

const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/orders', label: 'My Orders' },
];

/** Customer-facing top bar: nav, live cart pill, account (Week 10). */
export default function ShopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const lines = useCartStore((s) => s.lines);
  const count = cartItemCount(lines);

  const signOut = () => {
    clearAuth();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-surface px-4 lg:px-8">
      <div className="flex items-center gap-6">
        <Link href="/menu" className="text-lg font-bold text-primary-700">
          🍽️ Restaurant
        </Link>
        <nav aria-label="Shop" className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-primary-50 text-primary-700' : 'text-content-muted hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/checkout"
          aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
          className="relative inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-content-default hover:bg-gray-50"
        >
          🛒 <span className="hidden sm:inline">Cart</span>
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </Link>
        <span className="hidden text-sm text-content-muted md:block">
          {user ? `Hi, ${user.firstName}` : null}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-content-muted transition-colors hover:text-content-default"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}