'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import { tenantService } from '@/services/tenants.service';
import { useAuthStore } from '@/store/auth.store';
import { getApiErrorMessage, getApiErrorCode } from '@/lib/api';

const schema = z
  .object({
    restaurantName: z.string().min(2, 'Restaurant name is required'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email address'),
    timezone: z.string().optional(),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

/** Week 15.4 — self-serve onboarding: open a brand-new restaurant workspace. */
export default function OnboardingPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ confirmPassword: _c, ...values }: FormValues) => {
    setServerError(null);
    try {
      const res = await tenantService.onboard({
        restaurantName: values.restaurantName,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        timezone: values.timezone || 'UTC',
      });
      // Session straight in — the onboarded user is the new tenant's ADMIN.
      useAuthStore.getState().setCredentials(res.user, {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      router.replace('/dashboard');
    } catch (err) {
      const code = getApiErrorCode(err);
      setServerError(
        code === 'TENANT_NOT_FOUND' || code === 'EMAIL_EXISTS'
          ? 'An account with this email already exists. Try signing in instead.'
          : getApiErrorMessage(err),
      );
    }
  };

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Open your restaurant</h2>
        <p className="mt-1 text-sm text-content-muted">
          Create your workspace — we set up your admin account, your restaurant
          profile, and a starter menu automatically.
        </p>
      </div>

      {serverError && <Alert tone="error">{serverError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
        <div className="col-span-2">
          <Input
            label="Restaurant name"
            placeholder="e.g. The Bloom Bistro"
            error={errors.restaurantName?.message}
            {...register('restaurantName')}
          />
        </div>
        <Input label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} />
        <div className="col-span-2 space-y-4">
          <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Input
            label="Timezone (optional)"
            placeholder="America/New_York"
            hint="Defaults to UTC"
            {...register('timezone')}
          />
          <Input label="Password" type="password" autoComplete="new-password" hint="Min 8 chars incl. upper, lower & number" error={errors.password?.message} {...register('password')} />
          <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        </div>
        <Button type="submit" size="lg" isLoading={isSubmitting} className="col-span-2">
          Open my restaurant
        </Button>
      </form>

      <p className="text-center text-sm text-content-muted">
        Joining an existing restaurant?{' '}
        <Link href="/register" className="font-medium text-primary-600 hover:underline">
          Use your organization code
        </Link>
      </p>
    </Card>
  );
}