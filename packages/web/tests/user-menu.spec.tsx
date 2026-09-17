// ⚠️ Import-order contract (ts-jest does NOT hoist jest.mock): these modules
// register the next/navigation and auth-HTTP replacements and MUST load before
// UserMenu captures useRouter/useAuth.
import { mockReplace } from './mocks/next-navigation';
import { mockLogout } from './mocks/auth-service';
import { makeAuthUser } from './factories/user';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserMenu from '@/components/layout/user-menu';
import { useAuthStore } from '@/store/auth.store';

/**
 * The operator console (/platform) and the tenant dashboard share this avatar
 * menu — the platform admin's only password-scoped affordance lives here.
 */

afterEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  jest.clearAllMocks();
});

describe('UserMenu', () => {
  beforeEach(() => {
    mockLogout.mockResolvedValue(undefined);
    useAuthStore.setState({
      // makeAuthUser pins Testy McFace → avatar initials "TM".
      user: makeAuthUser({ role: 'PLATFORM_ADMIN' }),
      accessToken: 'a',
      refreshToken: 'r',
      isAuthenticated: true,
    });
  });

  it('offers "Change password" to the platform operator and opens the dialog', async () => {
    render(<UserMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'TM' }));
    expect(screen.getByRole('menuitem', { name: 'Change password' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Change password' }));

    expect(await screen.findByRole('dialog', { name: 'Change password' })).toBeInTheDocument();
    // The dropdown closes so the modal owns the screen.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('still signs out from the same menu', async () => {
    render(<UserMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'TM' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});