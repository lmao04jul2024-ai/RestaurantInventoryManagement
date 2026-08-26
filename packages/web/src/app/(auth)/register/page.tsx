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
import { useAuth } from '@/hooks/use-auth';
import { getApiErrorMessage, getApiErrorCode } from '@/lib/api';

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().optional(),
    organizationCode: z.string().optional(),
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

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({
    confirmPassword: _c,
    ...values
  }: FormValues) => {
    setServerError(null);
    try {
      await registerUser({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        // Optional: join an existing restaurant via invite/organization code
        tenantId: values.organizationCode || undefined,
        password: values.password,
      });
      router.replace('/dashboard');
    } catch (err) {
      const code = getApiErrorCode(err);
      setServerError(
        code === 'EMAIL_EXISTS'
          ? 'An account with this email already exists. Try signing in instead.'
          : getApiErrorMessage(err),
      );
    }
  };

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Create your account</h2>
        <p className="mt-1 text-sm text-content-muted">
          Have an organization code from your restaurant? Include it below to join their workspace.
        </p>
      </div>

      {serverError && <Alert tone="error">{serverError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
        <Input label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} />
        <div className="col-span-2 space-y-4">
          <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Input label="Phone (optional)" type="tel" autoComplete="tel" placeholder="+1 555 000 1234" error={errors.phone?.message} {...register('phone')} />
          <Input
            label="Organization code (optional)"
            hint="Leave blank if you're opening your own restaurant workspace"
            {...register('organizationCode')}
          />
          <Input label="Password" type="password" autoComplete="new-password" hint="Min 8 chars incl. upper, lower & number" error={errors.password?.message} {...register('password')} />
          <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        </div>
        <Button type="submit" size="lg" isLoading={isSubmitting} className="col-span-2">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-content-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
