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
import { useAuth } from '@/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const sessionExpired = params.get('session') === 'expired';
  const nextUrl = params.get('next') ?? '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values);
      router.replace(nextUrl);
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  };

  return (
    <Card className="space-y-6">
      <div className="lg:hidden">
        <p className="text-lg font-bold text-primary-700">🍽️ Restaurant Manager</p>
      </div>
      <div>
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="mt-1 text-sm text-content-muted">Sign in to your account to continue</p>
      </div>

      {sessionExpired && !serverError && (
        <Alert tone="warning">Your session expired. Please sign in again.</Alert>
      )}
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
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" isLoading={isSubmitting} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-content-muted">
        New here?{' '}
        <Link href="/register" className="font-medium text-primary-600 hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
