jest.mock('@/hooks/use-inventory', () => ({
  useImportItems: jest.fn(),
  // Only useImportItems is exercised here; the remaining inventory hooks are
  // stubbed so the module import graph stays intact.
  useInventoryItems: jest.fn(),
  useLowStockAlerts: jest.fn(),
  useInventoryValuation: jest.fn(),
  useSuppliers: jest.fn(),
  usePurchaseOrders: jest.fn(),
}));

jest.mock('@/components/inventory/overview-panel', () => ({
  __esModule: true,
  default: () => <div data-testid="stub-overview" />,
}));
jest.mock('@/components/inventory/items-panel', () => ({
  __esModule: true,
  default: () => <div data-testid="stub-items" />,
}));
jest.mock('@/components/inventory/suppliers-panel', () => ({
  __esModule: true,
  default: () => <div data-testid="stub-suppliers" />,
}));
jest.mock('@/components/inventory/purchase-orders-panel', () => ({
  __esModule: true,
  default: () => <div data-testid="stub-pos" />,
}));

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InventoryDashboard from '@/components/inventory/inventory-dashboard';
import InventoryImportPanel from '@/components/inventory/inventory-import-panel';
import { useImportItems } from '@/hooks/use-inventory';
import { useAuth } from '@/hooks/use-auth';

const useImportItemsFn = useImportItems as jest.Mock;
const useAuthFn = useAuth as jest.Mock;

const renderWithClient = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

const DRY_RUN_RESULT = {
  total: 3,
  created: 3,
  skipped: 0,
  dryRun: true,
  errors: [],
  warnings: [],
};

const ERROR_RESULT = {
  total: 3,
  created: 1,
  skipped: 1,
  dryRun: false,
  errors: [{ row: 3, field: 'sku', code: 'SKU_TAKEN', message: 'Row 3: SKU "FL-1" already exists' }],
  warnings: [{ row: 2, code: 'NO_SUPPLIER', message: 'Row 2: no supplier matched — item created unlinked' }],
};

describe('InventoryImportPanel — Phase 5 S3.1 CSV import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useImportItemsFn.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue(DRY_RUN_RESULT), isPending: false });
    useAuthFn.mockReturnValue({ user: { id: 'u1', role: 'ADMIN' } });
  });

  it('previews a dry run without saving, then imports, unwrapping the { data } envelope', async () => {
    const mutateAsync = jest
      .fn()
      .mockResolvedValueOnce(DRY_RUN_RESULT)
      .mockResolvedValueOnce({ ...ERROR_RESULT, dryRun: false });
    useImportItemsFn.mockReturnValue({ mutateAsync, isPending: false });

    renderWithClient(<InventoryImportPanel />);

    fireEvent.change(screen.getByLabelText('CSV data'), { target: { value: 'name,sku\nFlour,FL-1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Preview (dry run)' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ data: 'name,sku\nFlour,FL-1', dryRun: true }));
    expect(await screen.findByText(/Preview — nothing was saved/)).toBeInTheDocument();
    expect(screen.getByText(/3 of 3 rows would be created/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import items' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ data: 'name,sku\nFlour,FL-1', dryRun: false }));
    expect(await screen.findByText(/1 of 3 rows created/)).toBeInTheDocument();
    // Per-row errors carry row numbers so the operator can fix the sheet.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/SKU "FL-1" already exists/)).toBeInTheDocument();
    expect(screen.getByText(/no supplier matched/)).toBeInTheDocument();
  });

  it('refuses an empty paste with a hint instead of calling the API', async () => {
    const mutateAsync = jest.fn();
    useImportItemsFn.mockReturnValue({ mutateAsync, isPending: false });

    renderWithClient(<InventoryImportPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Import items' }));

    expect(await screen.findByText(/Paste CSV data first/)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('surfaces API failures via the shared error-message helper', async () => {
    useImportItemsFn.mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(new Error('CSV is too large')),
      isPending: false,
    });

    renderWithClient(<InventoryImportPanel />);

    fireEvent.change(screen.getByLabelText('CSV data'), { target: { value: 'name,sku\nFlour,FL-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import items' }));

    expect(await screen.findByText('CSV is too large')).toBeInTheDocument();
  });
});

describe('InventoryDashboard — S3.1 Import tab gating', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the Import tab to ADMIN and opens the import panel', async () => {
    useAuthFn.mockReturnValue({ user: { id: 'u1', role: 'ADMIN' } });
    useImportItemsFn.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });

    renderWithClient(<InventoryDashboard />);

    const tab = screen.getByRole('tab', { name: 'Import' });
    expect(tab).toBeInTheDocument();
    fireEvent.click(tab);
    expect(await screen.findByLabelText('CSV data')).toBeInTheDocument();
  });

  it('hides the Import tab from SERVER staff (API ALSO 403s)', async () => {
    useAuthFn.mockReturnValue({ user: { id: 'u9', role: 'SERVER' } });

    renderWithClient(<InventoryDashboard />);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('CSV data')).not.toBeInTheDocument();
  });
});
