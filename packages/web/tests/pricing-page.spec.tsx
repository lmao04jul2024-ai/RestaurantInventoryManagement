/**
 * S4.3 — marketing pricing page (manual billing, no checkout).
 */

import { render, screen } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';

describe('PricingPage — S4.3 marketing / manual billing', () => {
  it('renders every tier with the trial funnel and contact CTAs', () => {
    render(<PricingPage />);

    for (const tier of ['trial', 'basic', 'pro', 'enterprise']) {
      expect(screen.getByTestId(`plan-${tier}`)).toBeInTheDocument();
    }

    // Manual billing: paid tiers are contact-only, never checkout.
    const contacts = screen.getAllByRole('link', { name: 'Contact to subscribe' });
    expect(contacts).toHaveLength(3);
    for (const c of contacts) {
      expect(c).toHaveAttribute('href', expect.stringContaining('mailto:'));
    }

    // Trial funnels into the self-serve onboarding wizard.
    expect(screen.getByRole('link', { name: 'Start free trial' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('shows the demo video placeholder and sales footer', () => {
    render(<PricingPage />);

    expect(screen.getByRole('img', { name: /demo video placeholder/i })).toBeInTheDocument();
    expect(screen.getByText(/sales@yourapp.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'sign in' })).toHaveAttribute('href', '/login');
  });
});
