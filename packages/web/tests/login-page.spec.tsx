// ⚠️ Import-order contract (ts-jest does NOT hoist jest.mock): the mock modules
// below register the next/navigation and auth-HTTP replacements and MUST load
// before the page module captures useRouter/useAuth.
import { mockReplace, mockSearchParams } from './mocks/next-navigation';
import { mockLogin } from './mocks/auth-service';
import { makeAuthUser } from './factories/user';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/types';

/** Signs in as `role` and returns once the login POST has resolved. */
const signInAs = async (role: UserRole) => {
  // The API envelope (not a bare user) — `useAuth.login` stores `res.user`.
  mockLogin.mockImplementation(async () => {
    const user = makeAuthUser({ role });
    useAuthStore.getState().setCredentials(user, { accessToken: 'a', refreshToken: 'r' });
    return { user, accessToken: 'a', refreshToken: 'r' };
  });

  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'who@restaurant.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
};

afterEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
  jest.clearAllMocks();
});

describe('login landing by role (S2.1/S2.4)', () => {
  it('sends a platform operator to the console, never the tenant dashboard', async () => {
    await signInAs('PLATFORM_ADMIN');

    // /platform → /platform/tenants (the operator shell); the tenant shell would
    // bounce them straight back with 403 PLATFORM_ADMIN_FORBIDDEN.
    expect(mockReplace).toHaveBeenCalledWith('/platform');
  });

  it('sends staff to the dashboard', async () => {
    await signInAs('MANAGER');

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('sends customers to the ordering experience', async () => {
    await signInAs('CUSTOMER');

    expect(mockReplace).toHaveBeenCalledWith('/menu');
  });

  it('still honours an explicit ?next= deep link', async () => {
    mockSearchParams.get.mockImplementation((key: string) => (key === 'next' ? '/orders/42' : null));

    await signInAs('MANAGER');

    expect(mockReplace).toHaveBeenCalledWith('/orders/42');
  });
});