'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import { authService } from '@/services/auth.service';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormValues) => {
    setServerError(null);
    try {
      await authService.forgotPassword({ email });
      // Always show success — mirrors the API's anti-enumeration behavior
      setSent(true);
    } catch (err) {
      setServerError('Something went wrong. Please try again.');
      void err;
    }
  };

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Forgot your password?</h2>
        <p className="mt-1 text-sm text-content-muted">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <>
          <Alert tone="success" title="Check your inbox">
            If an account exists for that email, a reset link has been sent. The link expires in 1 hour.
          </Alert>
          <p className="text-center text-sm text-content-muted">
            <Link href="/login" className="font-medium text-primary-600 hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@restaurant.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
              Send reset link
            </Button>
          </form>
          <p className="text-center text-sm text-content-muted">
            Remembered it?{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </Card>
  );
}
