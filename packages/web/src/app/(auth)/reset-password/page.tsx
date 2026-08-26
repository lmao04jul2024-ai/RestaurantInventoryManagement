'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import { authService } from '@/services/auth.service';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }: FormValues) => {
    setServerError(null);
    if (!token) {
      setServerError('This reset link is missing its token. Request a new link.');
      return;
    }
    try {
      await authService.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err) {
      setServerError(
        getApiErrorCode(err) === 'RESET_TOKEN_INVALID'
          ? 'This reset link is invalid or has expired. Please request a new one.'
          : getApiErrorMessage(err),
      );
    }
  };

  if (!token && !done) {
    return (
      <Card className="space-y-6">
        <Alert tone="error" title="Reset link required">
          Open the reset link from your email, or request a new one.
        </Alert>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-primary-600 hover:underline">
            Request new link
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose a new password</h2>
        <p className="mt-1 text-sm text-content-muted">
          Your existing sessions will be signed out when the password changes.
        </p>
      </div>

      {done ? (
        <Alert tone="success" title="Password updated">
          Redirecting you to sign in…
        </Alert>
      ) : (
        <>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input label="New password" type="password" autoComplete="new-password" hint="Min 8 chars incl. upper, lower & number" error={errors.password?.message} {...register('password')} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
            <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
              Reset password
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
