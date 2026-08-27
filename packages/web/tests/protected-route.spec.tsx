// ⚠️ Import-order contract (ts-jest does NOT hoist jest.mock): this module
// registers the next/navigation replacement, so it MUST load before any
// component that captures useRouter at render time.
import { mockReplace } from './mocks/next-navigation';
import { makeAuthUser } from './factories/user';

import { render, screen, waitFor } from '@testing-library/react';
import ProtectedRoute from '@/components/auth/protected-route';
import { useAuthStore } from '@/store/auth.store';

const hydrateAs = () => {
  jest.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(true);
  jest.spyOn(useAuthStore.persist, 'onFinishHydration').mockImplementation((cb) => {
    cb();
    return () => {};
  });
};

afterEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
  jest.restoreAllMocks();
});

describe('ProtectedRoute hydration gate', () => {
  it('renders a loading placeholder instead of children while rehydrating', () => {
    jest.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(false);
    render(
      <ProtectedRoute>
        <div>secret-dashboard</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('secret-dashboard')).not.toBeInTheDocument();
  });

  it('bounces unauthenticated users to login preserving next path', async () => {
    hydrateAs();
    useAuthStore.setState({ user: null, isAuthenticated: false });

    render(
      <ProtectedRoute>
        <div>secret-dashboard</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/login?next=%2Forders%2Fopen');
    expect(screen.queryByText('secret-dashboard')).not.toBeInTheDocument();
  });

  it('renders protected content for authenticated users without redirect', async () => {
    hydrateAs();
    useAuthStore.setState({
      user: makeAuthUser(),
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute>
        <div>secret-dashboard</div>
      </ProtectedRoute>,
    );

    expect(await screen.findByText('secret-dashboard')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects role-mismatched users to forbidden dashboard state', async () => {
    hydrateAs();
    useAuthStore.setState({
      user: makeAuthUser({ role: 'SERVER' }),
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute roles={['ADMIN']}>
        <div>admin-only-panel</div>
      </ProtectedRoute>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard?error=forbidden'));
    expect(screen.queryByText('admin-only-panel')).not.toBeInTheDocument();
  });

  it('grants access when ANY listed role matches', async () => {
    hydrateAs();
    useAuthStore.setState({
      user: makeAuthUser({ role: 'MANAGER' }),
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
        <div>manager-panel</div>
      </ProtectedRoute>,
    );

    expect(await screen.findByText('manager-panel')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('auth store plumbing (consumer contract)', () => {
  it('clearAuth resets credentials synchronously for consumers like logout flows', () => {
    useAuthStore.setState({ user: makeAuthUser(), isAuthenticated: true });

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false });
  });
});
