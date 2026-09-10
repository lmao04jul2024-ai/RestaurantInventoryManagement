jest.mock('@/hooks/use-orders', () => ({
  useKitchenQueue: jest.fn(),
  useUpdateOrderItemStatus: jest.fn(),
  useAssignOrderStaff: jest.fn(),
  useUnassignOrderStaff: jest.fn(),
  useKitchenSettings: jest.fn(),
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/use-staff', () => ({
  useStaff: jest.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import KitchenBoard from '@/components/orders/kitchen-board';
import {
  useKitchenQueue,
  useUpdateOrderItemStatus,
  useAssignOrderStaff,
  useUnassignOrderStaff,
  useKitchenSettings,
} from '@/hooks/use-orders';
import { useAuth } from '@/hooks/use-auth';
import { useStaff } from '@/hooks/use-staff';
import type { KitchenQueueEntry, KitchenQueueResponse } from '@/types/order';

const queueFn = useKitchenQueue as jest.Mock;
const moveItemFn = useUpdateOrderItemStatus as jest.Mock;
const assignFn = useAssignOrderStaff as jest.Mock;
const unassignFn = useUnassignOrderStaff as jest.Mock;
const settingsFn = useKitchenSettings as jest.Mock;
const authFn = useAuth as jest.Mock;
const staffFn = useStaff as jest.Mock;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'order-1',
  orderNumber: 'ORD-1001',
  status: 'CONFIRMED',
  paymentStatus: 'PENDING',
  totalAmount: 20,
  taxAmount: 0,
  discountAmount: 0,
  tableNumber: null,
  specialRequests: null,
  scheduledFor: null,
  customerId: 'cust-1',
  tenantId: 'tenant-1',
  tableId: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
  items: [],
  ...over,
}) as unknown as KitchenQueueEntry;

const QUEUE: KitchenQueueResponse = {
  live: [
    row({
      id: 'order-1',
      assignedStaff: { id: 'staff-1', name: 'Ana Lee' },
      prepElapsedMinutes: 8,
      prepTargetMet: null,
    }),
    row({
      id: 'order-2',
      orderNumber: 'ORD-1002',
      assignedStaff: null,
      prepElapsedMinutes: 30,
      prepTargetMet: false,
    }),
  ],
  scheduled: [],
};

const mutation = () => ({ mutate: jest.fn(), isPending: false, error: null });

beforeEach(() => {
  jest.clearAllMocks();
  queueFn.mockReturnValue({ data: QUEUE, isLoading: false, isError: false, dataUpdatedAt: Date.now() });
  moveItemFn.mockReturnValue(mutation());
  assignFn.mockReturnValue(mutation());
  unassignFn.mockReturnValue(mutation());
  settingsFn.mockReturnValue({ data: { prepTimeTargetMinutes: 15, capacity: 20 } });
  authFn.mockReturnValue({ hasRole: (r: string[]) => ['KITCHEN', 'MANAGER', 'ADMIN'].some((x) => r.includes(x)) });
  staffFn.mockReturnValue({ data: { data: [{ id: 'staff-1', firstName: 'Ana', lastName: 'Lee' }] } });
});

describe('KitchenBoard — Week 21 kitchen hardening', () => {
  it('renders assigned staff, prep elapsed, and the capacity indicator (21.2/21.3/21.5)', () => {
    render(<KitchenBoard />);

    expect(screen.getByText('👨‍🍳 Ana Lee')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByTestId('prep-elapsed-order-1')).toHaveTextContent('Prep 8m');
    // Over target → flagged, not celebrated.
    expect(screen.getByTestId('prep-elapsed-order-2')).toHaveTextContent('over target');
    expect(screen.getByTestId('capacity-indicator')).toHaveTextContent('2/20 active');
  });

  it('hides the prep line when prep has not started', () => {
    queueFn.mockReturnValue({
      data: { live: [row({ preparationStartedAt: null, prepElapsedMinutes: null, prepTargetMet: null })], scheduled: [] },
      isLoading: false, isError: false, dataUpdatedAt: Date.now(),
    });
    render(<KitchenBoard />);

    expect(screen.queryByTestId('prep-elapsed-order-1')).not.toBeInTheDocument();
  });

  it('omits the capacity indicator when capacity is disabled (0)', () => {
    settingsFn.mockReturnValue({ data: { prepTimeTargetMinutes: 15, capacity: 0 } });
    render(<KitchenBoard />);

    expect(screen.queryByTestId('capacity-indicator')).not.toBeInTheDocument();
  });

  it('shows assignment controls for kitchen+ and fires assign with the chosen staff id', () => {
    render(<KitchenBoard />);

    const select = screen.getByLabelText('Assign staff to ORD-1002') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'staff-1' } });

    expect(assignFn.mock.results[0].value.mutate).toHaveBeenCalledWith({ id: 'order-2', staffId: 'staff-1' });
  });

  it('fires unassign from the assigned card', () => {
    render(<KitchenBoard />);

    fireEvent.click(screen.getByRole('button', { name: 'Unassign' }));

    expect(unassignFn.mock.results[0].value.mutate).toHaveBeenCalledWith('order-1');
  });

  it('hides assignment controls for SERVER/CUSTOMER roles', () => {
    authFn.mockReturnValue({ hasRole: () => false });
    render(<KitchenBoard />);

    expect(screen.queryByLabelText('Assign staff to ORD-1002')).not.toBeInTheDocument();
    // Assigned chip still renders read-only.
    expect(screen.getByText('👨‍🍳 Ana Lee')).toBeInTheDocument();
  });
});
