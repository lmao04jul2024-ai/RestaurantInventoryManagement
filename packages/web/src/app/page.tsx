import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-surface-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-lg font-bold text-primary-600">🍽️ Restaurant Manager</p>
          <h1 className="mb-4 mt-2 text-4xl font-bold text-content-default sm:text-5xl">
            Inventory & orders,
            <br /> one cross-platform system.
          </h1>
          <p className="text-xl text-content-muted">
            Web, mobile and QR self-ordering — customizable per brand.
          </p>
          <div className="mt-8 space-x-4">
            <Link
              href="/login"
              className="inline-block rounded bg-primary-600 px-6 py-3 font-medium text-on-primary transition-colors hover:bg-primary-700"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-block rounded border border-gray-300 px-6 py-3 font-medium text-content-default transition-colors hover:bg-surface"
            >
              Create account
            </Link>
          </div>
          <p className="mt-6 text-xs text-content-muted">
            Customers: sign in to browse the menu and order online · Staff workspace requires sign-in
          </p>
          <p className="mt-2 text-xs text-content-muted">
            New here?{' '}
            <Link href="/pricing" className="font-medium text-primary-700 hover:underline">
              See pricing
            </Link>{' '}
            — or{' '}
            <Link href="/onboarding" className="font-medium text-primary-700 hover:underline">
              start a 30-day free trial
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

