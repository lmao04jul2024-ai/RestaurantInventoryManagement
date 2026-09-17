import Link from 'next/link';

/**
 * Phase 5 S4.3 — public marketing pricing page.
 *
 * MANUAL BILLING (Phase B constraint): there is no payment processor and no
 * checkout anywhere in this product. Each plan's CTA is "contact to
 * subscribe" — the operator closes the deal offline and records the outcome
 * on the platform console (audit-logged). The free trial funnels to
 * /onboarding, which creates the workspace and signs in its first ADMIN.
 *
 * The sales inbox is deployment-configurable via NEXT_PUBLIC_SALES_EMAIL.
 */

const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL ?? 'sales@yourapp.com';
const MAILTO = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Subscription inquiry')}`;

interface PlanCard {
  tier: string;
  tagline: string;
  price: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanCard[] = [
  {
    tier: 'Trial',
    tagline: 'Evaluate everything, 30 days, no card.',
    price: 'Free',
    features: [
      'Full inventory, menu and order management',
      'Customer ordering and reviews',
      'Guided onboarding + CSV import',
      'Export your data any time',
    ],
  },
  {
    tier: 'Basic',
    tagline: 'Core operations for a single location.',
    price: 'Contact us',
    features: [
      'Inventory with supplier tracking',
      'Menu management and availability windows',
      'Customer ordering and order tracking',
      'Team seats sized to your workspace',
    ],
  },
  {
    tier: 'Pro',
    tagline: 'Growing teams that need analytics.',
    price: 'Contact us',
    highlight: true,
    features: [
      'Everything in Basic',
      'Usage analytics and reporting',
      'Recurring orders and kitchen fulfillment',
      'CSV import/export of your data',
    ],
  },
  {
    tier: 'Enterprise',
    tagline: 'Multi-location groups, bespoke needs.',
    price: 'Contact us',
    features: [
      'Everything in Pro',
      'Priority operator support',
      'Custom seat ceilings and onboarding assistance',
      'Tailored data-retention arrangements',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-surface-muted px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <p className="text-lg font-bold text-primary-600">🍽️ Restaurant Manager</p>
          <h1 className="mt-2 text-4xl font-bold text-content-default sm:text-5xl">
            Simple plans, human billing.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-content-muted">
            Pick a tier, talk to a person, get set up. We don&apos;t do automated
            charges — your subscription is handled by a real operator who knows
            your restaurant.
          </p>
        </header>

        <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4" aria-label="Plans">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`flex flex-col rounded-card border bg-surface p-6 shadow-card ${
                plan.highlight ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
              }`}
              data-testid={`plan-${plan.tier.toLowerCase()}`}
            >
              <h2 className="text-lg font-bold text-content-default">{plan.tier}</h2>
              <p className="mt-1 text-sm text-content-muted">{plan.tagline}</p>
              <p
                className={`mt-4 text-2xl font-bold ${
                  plan.price === 'Free' ? 'text-green-700' : 'text-content-default'
                }`}
              >
                {plan.price}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-content-default">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <span aria-hidden className="text-primary-600">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {plan.tier === 'Trial' ? (
                  <Link
                    href="/onboarding"
                    className="block rounded bg-primary-600 px-4 py-2.5 text-center text-sm font-semibold text-on-primary transition-colors hover:bg-primary-700"
                  >
                    Start free trial
                  </Link>
                ) : (
                  <a
                    href={MAILTO}
                    className="block rounded border border-gray-300 px-4 py-2.5 text-center text-sm font-semibold text-content-default transition-colors hover:bg-surface-muted"
                  >
                    Contact to subscribe
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-card border border-gray-200 bg-surface p-6 shadow-card">
          <h2 className="text-lg font-bold text-content-default">See it in action</h2>
          <div
            className="mt-4 flex aspect-video items-center justify-center rounded border border-dashed border-gray-300 bg-surface-muted"
            role="img"
            aria-label="Product demo video placeholder"
          >
            <p className="text-sm text-content-muted">
              Demo video coming soon — meanwhile, start a trial and explore the real thing.
            </p>
          </div>
        </section>

        <footer className="mt-10 text-center text-sm text-content-muted">
          Questions? Email{' '}
          <a href={MAILTO} className="font-medium text-primary-700 hover:underline">
            {SALES_EMAIL}
          </a>{' '}
          — or{' '}
          <Link href="/login" className="font-medium text-primary-700 hover:underline">
            sign in
          </Link>{' '}
          to your workspace.
        </footer>
      </div>
    </main>
  );
}
