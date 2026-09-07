jest.mock('@/hooks/use-analytics', () => ({
  useSalesAnalytics: jest.fn(),
  useInventoryAnalytics: jest.fn(),
  useCustomerAnalytics: jest.fn(),
  useReportTemplates: jest.fn(),
  useCreateReportTemplate: jest.fn(),
  useDeleteReportTemplate: jest.fn(),
  useExportReport: jest.fn(),
}));

jest.mock('@/services/analytics.service', () => ({
  downloadBlob: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsPage from '@/components/dashboard/analytics-page';
import {
  useSalesAnalytics,
  useInventoryAnalytics,
  useCustomerAnalytics,
  useReportTemplates,
  useCreateReportTemplate,
  useDeleteReportTemplate,
  useExportReport,
} from '@/hooks/use-analytics';
import { downloadBlob } from '@/services/analytics.service';

const salesFn = useSalesAnalytics as jest.Mock;
const inventoryFn = useInventoryAnalytics as jest.Mock;
const customersFn = useCustomerAnalytics as jest.Mock;
const templatesFn = useReportTemplates as jest.Mock;
const createFn = useCreateReportTemplate as jest.Mock;
const deleteFn = useDeleteReportTemplate as jest.Mock;
const exportFn = useExportReport as jest.Mock;

const SALES = {
  windowDays: 30,
  totals: { orders: 12, paidOrders: 10, paidRevenue: 240, avgOrderValue: 20 },
  byStatus: { COMPLETED: 10, PENDING: 2 },
  revenueByDay: [
    { date: '2026-09-01', revenue: 100 },
    { date: '2026-09-02', revenue: 140 },
  ],
  ordersByDay: [
    { date: '2026-09-01', orders: 5 },
    { date: '2026-09-02', orders: 7 },
  ],
  topItems: [{ itemId: 'i1', name: 'Margherita', quantity: 8, revenue: 96 }],
  peakHours: [{ hour: 18, orders: 4 }],
};

const INVENTORY = {
  windowDays: 30,
  totals: { items: 40, activeItems: 38, lowStock: 3, valuation: 1200, retailValue: 1800, deadStock: 2 },
  lowStockItems: [{ id: 'a', name: 'Flour', sku: 'FL-1', currentStock: 5, minStock: 10, unit: 'KG' }],
  deadStockItems: [],
  topMovers: [{ itemId: 'a', name: 'Flour', usage: 12 }],
  supplierBreakdown: [{ supplierId: 's1', name: 'Acme', items: 4, stockValue: 300 }],
};

const CUSTOMERS = {
  windowDays: 30,
  totals: { customers: 25, newInWindow: 3, active: 8, returning: 2, repeatRatePct: 25, avgOrdersPerCustomer: 1.5 },
  topCustomers: [{ customerId: 'c1', name: 'Ada Lovelace', orders: 3, spend: 90 }],
  avgRating: 4.6,
  reviewCount: 12,
};

const TEMPLATES = [
  { id: 't1', name: 'Weekly wrap', type: 'sales', config: { days: 7 }, tenantId: 't', createdAt: '', updatedAt: '' },
];

describe('AnalyticsPage — Week 19 dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    salesFn.mockReturnValue({ data: SALES, isLoading: false, isError: false });
    inventoryFn.mockReturnValue({ data: INVENTORY, isLoading: false, isError: false });
    customersFn.mockReturnValue({ data: CUSTOMERS, isLoading: false, isError: false });
    templatesFn.mockReturnValue({ data: TEMPLATES, isLoading: false });
    createFn.mockReturnValue({ isPending: false, mutateAsync: jest.fn() });
    deleteFn.mockReturnValue({ mutate: jest.fn() });
    exportFn.mockReturnValue({ mutateAsync: jest.fn() });
  });

  it('renders the Sales tab by default with KPIs and the revenue chart', () => {
    render(<AnalyticsPage />);

    expect(screen.getByRole('tab', { name: 'Sales' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('12')).toBeInTheDocument(); // orders KPI
    expect(screen.getByText('$240.00')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Daily paid revenue' })).toBeInTheDocument();
    expect(screen.getByText('Margherita')).toBeInTheDocument();
  });

  it('switches to Inventory and Customers tabs', () => {
    render(<AnalyticsPage />);

    fireEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
    expect(screen.getAllByText('Flour').length).toBeGreaterThan(0); // low-stock table + movers
    expect(screen.getByText('$1200.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Customers' }));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('changing the window refetches the active report with the new days', () => {
    render(<AnalyticsPage />);
    expect(salesFn).toHaveBeenCalledWith(30);

    fireEvent.click(screen.getByRole('radio', { name: '7d' }));

    expect(salesFn).toHaveBeenLastCalledWith(7);
  });

  it('Reports tab exports CSV/PDF through the blob downloader', async () => {
    const mutateAsync = jest.fn().mockResolvedValue(new Blob(['x']));
    exportFn.mockReturnValue({ mutateAsync });

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reports' }));

    fireEvent.click(screen.getByRole('button', { name: 'Export Sales as CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Sales as PDF' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenCalledWith({ type: 'sales', format: 'csv', days: 30 });
    expect(mutateAsync).toHaveBeenCalledWith({ type: 'sales', format: 'pdf', days: 30 });
    expect(downloadBlob).toHaveBeenCalledTimes(2);
  });

  it('saves and deletes report templates', async () => {
    const createMutate = jest.fn().mockResolvedValue({});
    createFn.mockReturnValue({ isPending: false, mutateAsync: createMutate });
    const deleteMutate = jest.fn();
    deleteFn.mockReturnValue({ mutate: deleteMutate });

    render(<AnalyticsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reports' }));

    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Monthly wrap' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith({ name: 'Monthly wrap', type: 'sales', config: { days: 30 } }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteMutate).toHaveBeenCalledWith('t1');
  });

  it('shows an error state when a report fails to load', () => {
    salesFn.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('boom') });

    render(<AnalyticsPage />);
    expect(screen.getByText('Could not load sales')).toBeInTheDocument();
  });
});
