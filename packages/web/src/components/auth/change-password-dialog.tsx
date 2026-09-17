'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { authService } from '@/services/auth.service';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api';

/**
 * Self-service password change for the signed-in user.
 *
 * Rendered from the UserMenu, so the SAME dialog serves the tenant dashboard
 * (ADMIN/MANAGER/…) and the platform operator console at /platform — the API
 * route (PATCH /auth/password) is not tenant-gated, which is exactly why the
 * operator role can use it (resolveTenant rejects PLATFORM_ADMIN on tenant
 * surfaces with 403 PLATFORM_ADMIN_FORBIDDEN).
 *
 * The API revokes every session on success, so the dialog signs the user out
 * and sends them back to /login with the new credential.
 */

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Esc closes; the mutation stays mounted so a slow PATCH isn't orphaned.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Session revocation is server-side, so the local session cannot continue —
  // sign out and hand the user the login screen (also offered as a button).
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => void logout(), 2500);
    return () => clearTimeout(timer);
  }, [done, logout]);

  const onSubmit = async ({ currentPassword, newPassword }: FormValues) => {
    setServerError(null);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setDone(true);
    } catch (err) {
      const code = getApiErrorCode(err);
      setServerError(
        code === 'CURRENT_PASSWORD_INCORRECT'
          ? 'Your current password is incorrect.'
          : code === 'PASSWORD_UNCHANGED'
            ? 'Choose a password different from your current one.'
            : getApiErrorMessage(err),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        className="mt-8 w-full max-w-md rounded-card bg-surface p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Change password</h2>
            <p className="mt-1 text-sm text-content-muted">
              You stay in control of your own credential — no email round trip needed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-content-muted hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="mt-5 space-y-4">
            <Alert tone="success" title="Password updated">
              Every device has been signed out for security. Sign in again with your new password.
            </Alert>
            <div className="flex justify-end">
              <Button type="button" onClick={() => void logout()}>
                Go to sign in
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
            {serverError && <Alert tone="error">{serverError}</Alert>}
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              error={errors.currentPassword?.message}
              {...register('currentPassword')}
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="Min 8 chars incl. upper, lower & number"
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Update password
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
