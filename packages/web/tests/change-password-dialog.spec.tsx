// ⚠️ Import-order contract (ts-jest does NOT hoist jest.mock): these modules
// register the next/navigation and auth-HTTP replacements and MUST load before
// the dialog captures useRouter/useAuth.
import { mockReplace } from './mocks/next-navigation';
import { mockChangePassword } from './mocks/auth-service';
import { makeAuthUser } from './factories/user';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChangePasswordDialog from '@/components/auth/change-password-dialog';
import { useAuthStore } from '@/store/auth.store';

/**
 * Password change replaces the old email-reset-only story: the platform
 * operator (PLATFORM_ADMIN) could not rotate their own credential from the
 * console, and neither could any tenant user from the dashboard.
 */

const renderDialog = (onClose = jest.fn()) => {
  render(<ChangePasswordDialog onClose={onClose} />);
  return onClose;
};

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  jest.clearAllMocks();
});

describe('ChangePasswordDialog', () => {
  beforeEach(() => {
    mockChangePassword.mockResolvedValue({ message: 'Password updated.' });
    useAuthStore.setState({
      user: makeAuthUser({ role: 'PLATFORM_ADMIN' }),
      accessToken: 'a',
      refreshToken: 'r',
      isAuthenticated: true,
    });
  });

  it('validates the new password client-side before hitting the API', async () => {
    renderDialog();

    fill('Current password', 'Sup3rSecret!');
    fill('New password', 'short');
    fill('Confirm new password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('At least 8 characters')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('flags mismatched confirmation without calling the API', async () => {
    renderDialog();

    fill('Current password', 'Sup3rSecret!');
    fill('New password', 'Ev3nBetterOne!');
    fill('Confirm new password', 'Different01!');
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('submits current + new password and hands the operator over to sign in', async () => {
    renderDialog();

    fill('Current password', 'Sup3rSecret!');
    fill('New password', 'Ev3nBetterOne!');
    fill('Confirm new password', 'Ev3nBetterOne!');
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'Sup3rSecret!',
        newPassword: 'Ev3nBetterOne!',
      }),
    );

    // Server-side session revocation means the local session cannot continue.
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to sign in' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('surfaces the API message when the current password is rejected', async () => {
    mockChangePassword.mockRejectedValue(new Error('Your current password is incorrect'));
    renderDialog();

    fill('Current password', 'WrongOne1!');
    fill('New password', 'Ev3nBetterOne!');
    fill('Confirm new password', 'Ev3nBetterOne!');
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Your current password is incorrect')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update password' })).toBeInTheDocument();
  });

  it('closes on Escape and on Cancel', async () => {
    const onClose = renderDialog();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});