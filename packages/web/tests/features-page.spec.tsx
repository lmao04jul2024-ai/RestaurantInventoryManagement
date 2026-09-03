jest.mock('@/services/feature-flags.service', () => ({
  featureFlagService: {
    listFeatureFlags: jest.fn(),
    createFeatureFlag: jest.fn(),
    updateFeatureFlag: jest.fn(),
    deleteFeatureFlag: jest.fn(),
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
  },
}));

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FeaturesPage from '@/components/dashboard/features-page';
import { featureFlagService } from '@/services/feature-flags.service';

const listFn = featureFlagService.listFeatureFlags as jest.Mock;
const createFn = featureFlagService.createFeatureFlag as jest.Mock;
const updateConfigFn = featureFlagService.updateConfig as jest.Mock;

const FLAGS = [
  {
    id: 'flag-1',
    name: 'customer_reviews',
    description: 'Customers rate orders',
    globalEnabled: true,
    tenantOverride: false,
    enabled: false,
  },
  {
    id: 'flag-2',
    name: 'loyalty_program',
    description: null,
    globalEnabled: false,
    tenantOverride: null,
    enabled: false,
  },
  {
    id: 'flag-3',
    name: 'qr_integration',
    description: 'QR code ordering',
    globalEnabled: true,
    tenantOverride: null,
    enabled: true,
  },
];

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FeaturesPage />
    </QueryClientProvider>,
  );
};

describe('FeaturesPage — Week 14 management UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listFn.mockResolvedValue(FLAGS);
    createFn.mockResolvedValue({ id: 'flag-4', name: 'delivery_integration', isEnabled: false });
    updateConfigFn.mockResolvedValue({});
  });

  it('renders flags with effective On/Off pills', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('customer_reviews')).toBeInTheDocument());
    expect(screen.getByText('loyalty_program')).toBeInTheDocument();
    expect(screen.getByText('qr_integration')).toBeInTheDocument();
    // Pills are spans; the `On`/`Off` options inside each select are not.
    expect(screen.getAllByText('On', { selector: 'span' })).toHaveLength(1);
    expect(screen.getAllByText('Off', { selector: 'span' })).toHaveLength(2);
  });

  it('creates a flag whose key is slugified from the label', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('customer_reviews')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Key'), {
      target: { value: 'Online Review Snackbar' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Snackbar toast' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create flag' }));

    await waitFor(() =>
      expect(createFn).toHaveBeenCalledWith({
        name: 'online_review_snackbar',
        description: 'Snackbar toast',
        isEnabled: false,
      }),
    );
  });

  it('changes a per-tenant override via the restaurant select', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('customer_reviews')).toBeInTheDocument());

    const row = screen.getByText('customer_reviews').closest('li') as HTMLElement;
    fireEvent.change(within(row).getByRole('combobox'), { target: { value: 'on' } });

    await waitFor(() => expect(updateConfigFn).toHaveBeenCalledWith({ customer_reviews: true }));
  });
});