jest.mock('@/services/staff.service', () => ({
  staffService: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    auditLogs: jest.fn(),
  },
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuditPage from '@/components/dashboard/audit-page';
import { staffService } from '@/services/staff.service';

const auditFn = staffService.auditLogs as jest.Mock;

const ENTRY = {
  id: 'audit-1',
  actorId: '00000000-0000-4000-8000-000000000001',
  action: 'staff.role_changed',
  targetType: 'User',
  targetId: '00000000-0000-4000-8000-000000000002',
  metadata: { from: 'SERVER', to: 'MANAGER' },
  createdAt: '2026-09-03T10:00:00.000Z',
};

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuditPage />
    </QueryClientProvider>,
  );
};

describe('AuditPage — Week 16.6 audit trail viewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditFn.mockResolvedValue({
      data: [ENTRY],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });

  it('renders entries with action, actor, target and metadata', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('staff.role_changed')).toBeInTheDocument());
    expect(screen.getByText('Page 1 of 1 · 1 entries')).toBeInTheDocument();
    expect(screen.getByText('User:00000000…')).toBeInTheDocument();
    expect(screen.getByText(/"from":"SERVER"/)).toBeInTheDocument();
    expect(auditFn).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('applies filters from page 1', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('staff.role_changed')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'staff.created' } });
    fireEvent.change(screen.getByLabelText('Target type'), { target: { value: 'User' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() =>
      expect(auditFn).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        action: 'staff.created',
        targetType: 'User',
      }),
    );
  });

  it('paginates forward and back', async () => {
    // Echo the requested page back in meta — the header renders server meta.
    auditFn.mockImplementation((params: { page: number }) =>
      Promise.resolve({ data: [ENTRY], meta: { page: params.page, limit: 20, total: 45, pages: 3 } }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Page 1 of 3 · 45 entries')).toBeInTheDocument());

    const next = screen.getByRole('button', { name: 'Next →' });
    expect(screen.getByRole('button', { name: '← Prev' })).toBeDisabled();
    fireEvent.click(next);

    await waitFor(() => expect(auditFn).toHaveBeenLastCalledWith({ page: 2, limit: 20 }));
    await waitFor(() => expect(screen.getByText('Page 2 of 3 · 45 entries')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '← Prev' })).toBeEnabled();
  });

  it('shows the empty state when no entries match', async () => {
    auditFn.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    renderPage();

    await waitFor(() => expect(screen.getByText('No audit entries match these filters.')).toBeInTheDocument());
  });

  it('shows an error state when the log cannot be loaded', async () => {
    auditFn.mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => expect(screen.getByText('Could not load the audit log')).toBeInTheDocument());
  });
});