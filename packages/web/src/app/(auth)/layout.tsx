import Link from 'next/link';

/** Shared shell for all authentication screens */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary-700 p-12 text-on-primary lg:flex">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          🍽️ Restaurant Manager
        </Link>
        <div>
          <h1 className="mb-4 text-4xl font-bold leading-tight">
            Run your restaurant,
            <br /> wherever you are.
          </h1>
          <p className="max-w-md text-primary-100">
            Inventory, orders, kitchen display and customer self-ordering — one
            cross-platform system, customized to your brand.
          </p>
        </div>
        <p className="text-sm text-primary-200">© {new Date().getFullYear()} RMS</p>
      </div>

      {/* Form panel */}
      <main className="flex w-full items-center justify-center bg-surface-muted px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
