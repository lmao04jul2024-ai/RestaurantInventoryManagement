jest.mock('@/services/staff.service', () => ({
  staffService: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    auditLogs: jest.fn(),
  },
}));

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StaffPage from '@/components/dashboard/staff-page';
import { staffService } from '@/services/staff.service';
import { useAuth } from '@/hooks/use-auth';

const listFn = staffService.list as jest.Mock;
const updateFn = staffService.update as jest.Mock;
const createFn = staffService.create as jest.Mock;
const useAuthFn = useAuth as jest.Mock;

const SERVER_MEMBER = {
  id: 'user-2',
  email: 'sam@bloom.test',
  firstName: 'Sam',
  lastName: 'Lee',
  role: 'SERVER',
  isActive: true,
  permissionOverrides: { 'inventory:update:stock': true },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const LIST = { data: [SERVER_MEMBER], meta: { page: 1, limit: 10, total: 1, pages: 1 } };

const renderAs = (role: string) => {
  useAuthFn.mockReturnValue({ user: { id: 'u1', role, firstName: 'Ada' } });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StaffPage />
    </QueryClientProvider>,
  );
};

describe('StaffPage — Week 16.3/16.5 directory, role & override editor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listFn.mockResolvedValue(LIST);
    updateFn.mockResolvedValue(SERVER_MEMBER);
    createFn.mockResolvedValue(SERVER_MEMBER);
  });

  it('renders the directory table and meta count', async () => {
    renderAs('ADMIN');

    await waitFor(() => expect(screen.getByText('sam@bloom.test')).toBeInTheDocument());
    expect(screen.getByText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByText('1 staff · page 1/1')).toBeInTheDocument();
    // Role + override count asserted inside the member row — the filter bar
    // also renders role names as <option> text.
    const row = screen.getByText('sam@bloom.test').closest('tr') as HTMLTableRowElement;
    expect(within(row).getByText('SERVER')).toBeInTheDocument();
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(listFn).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('opens the editor from Manage and saves profile-only diffs', async () => {
    renderAs('MANAGER');
    await waitFor(() => expect(screen.getByText('sam@bloom.test')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(screen.getByText('Manage Sam Lee')).toBeInTheDocument();

    // Non-admins must not see the role selector or the override fieldset.
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument();
    expect(screen.queryByText('Permission overrides')).not.toBeInTheDocument();

    // The editor and the add form both render a "Last name" label — the editor
    // card mounts above the add form, so its field is the first match.
    fireEvent.change(screen.getAllByLabelText('Last name')[0], { target: { value: 'Park' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateFn).toHaveBeenCalledTimes(1));
    // Only the changed field is sent — unchanged profile fields are omitted.
    // Hook shape: staffService.update(id, payload).
    expect(updateFn).toHaveBeenCalledWith('user-2', { lastName: 'Park' });
  });

  it('admin can change role and deny a permission, sent as overrides payload', async () => {
    renderAs('ADMIN');
    await waitFor(() => expect(screen.getByText('sam@bloom.test')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
    expect(screen.getByText('Permission overrides')).toBeInTheDocument();
    // Existing override is reflected in the tri-state editor.
    expect(screen.getByLabelText('inventory:update:stock permission')).toHaveValue('allow');

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'KITCHEN' } });
    fireEvent.change(screen.getByLabelText('inventory:read permission'), { target: { value: 'deny' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateFn).toHaveBeenCalledTimes(1));
    // Hook shape: staffService.update(id, payload) → payload is call arg 1.
    const payload = updateFn.mock.calls[0][1];
    expect(payload.role).toBe('KITCHEN');
    // Full effective override map: the new deny plus the pre-existing allow
    // re-sent verbatim (idempotent server-side). A choice flipped back to
    // "Role default" would send null instead.
    expect(payload.permissionOverrides).toEqual({ 'inventory:read': false, 'inventory:update:stock': true });
  });

  it('creates a staff account from the add form', async () => {
    renderAs('ADMIN');
    await waitFor(() => expect(screen.getByText('sam@bloom.test')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Chen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@bloom.test' } });
    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'Passw0rd!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create staff account' }));

    await waitFor(() => expect(createFn).toHaveBeenCalledTimes(1));
    expect(createFn).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'Chen',
      email: 'ana@bloom.test',
      password: 'Passw0rd!',
      role: 'SERVER',
    });
  });

  it('shows an error state when the directory fails to load', async () => {
    listFn.mockRejectedValue(new Error('boom'));
    renderAs('MANAGER');

    await waitFor(() => expect(screen.getByText('Could not load staff directory')).toBeInTheDocument());
  });
});
