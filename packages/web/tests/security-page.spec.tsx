jest.mock('@/hooks/use-security', () => ({
  useSecurityEvents: jest.fn(),
  useSecurityHealth: jest.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import SecurityPage from '@/components/dashboard/security-page';
import { useSecurityEvents, useSecurityHealth } from '@/hooks/use-security';

const eventsFn = useSecurityEvents as jest.Mock;
const healthFn = useSecurityHealth as jest.Mock;

const HEALTH = {
  healthy: true,
  checkedAt: '2026-09-10T00:00:00Z',
  checks: {
    rateLimit: { ok: true, detail: 'limiters mounted' },
    encryptionAtRest: { ok: false, detail: 'key not set' },
  },
};

const EVENTS = {
  data: [{ id: 'e1', action: 'security:rate_limited', targetType: 'security', targetId: 'rate_limited', actorId: 'system', createdAt: '2026-09-10T00:00:00Z' }],
  meta: { page: 1, limit: 20, total: 1, pages: 1 },
  summary: { last24h: 2, byAction: { 'security:rate_limited': 2 } },
};

beforeEach(() => {
  jest.clearAllMocks();
  healthFn.mockReturnValue({ data: HEALTH, isLoading: false, isError: false, error: null });
  eventsFn.mockReturnValue({ data: EVENTS, isLoading: false, isFetching: false, isError: false, error: null });
});

describe('SecurityPage — Week 22.6 monitoring surface', () => {
  it('renders control objectives with pass/fail detail', () => {
    render(<SecurityPage />);

    expect(screen.getByText('rateLimit')).toBeInTheDocument();
    expect(screen.getByText('encryptionAtRest')).toBeInTheDocument();
    expect(screen.getByText('key not set')).toBeInTheDocument();
  });

  it('renders the 24h rollup with counts', () => {
    render(<SecurityPage />);

    expect(screen.getByTestId('rollup-list')).toHaveTextContent('security:rate_limited');
    expect(screen.getByTestId('rollup-list')).toHaveTextContent('2');
    expect(screen.getByTestId('last24h-count')).toHaveTextContent('2 security events');
  });

  it('shows a quiet state when there is nothing to alert on', () => {
    eventsFn.mockReturnValue({
      data: { ...EVENTS, data: [], summary: { last24h: 0, byAction: {} } },
      isLoading: false, isFetching: false, isError: false, error: null,
    });
    render(<SecurityPage />);

    expect(screen.getByText(/Quiet — no security events/)).toBeInTheDocument();
  });

  it('pages backward only after page 1... guards the Previous button on page 1', () => {
    render(<SecurityPage />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  });
});