'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import { useCreatePlatformTenant } from '@/hooks/use-platform';
import { getApiErrorMessage } from '@/lib/api';
import type { PlanTier, PlatformTenantCreatePayload, SubscriptionStatus } from '@/types/platform';

const PLANS: PlanTier[] = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];
const STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'];

const SELECT_CLS =
  'block w-full rounded border border-gray-300 bg-surface px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

const schema = z.object({
  restaurantName: z.string().trim().min(2, 'Restaurant name is required (min 2 characters)'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[0-9]/, 'Include a number'),
  plan: z.enum(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE']),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']),
  seatsLimit: z.coerce.number().int('Whole seats only').min(1, 'At least 1 seat').max(10_000, 'Max 10,000 seats'),
});

type FormValues = z.infer<typeof schema>;

/**
 * S5 — operator provisions a workspace + its first ADMIN in one audited call.
 *
 * Rendered as a modal from the Workspaces list. Unlike self-serve
 * `/onboarding` (TRIAL-only, signs the new user in), this sets commercial
 * state upfront (plan/status/seats) and keeps the OPERATOR's session — the
 * new ADMIN signs in with the credentials shown here.
 */
export function PlatformCreateTenantDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreatePlatformTenant();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'TRIAL', subscriptionStatus: 'TRIAL', seatsLimit: 10 },
  });

  // Esc closes; the mutation stays mounted so a slow POST isn't orphaned.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onSubmit = async (values: FormValues) => {
    const payload: PlatformTenantCreatePayload = { ...values };
    const created = await create.mutateAsync(payload);
    onClose();
    router.push(`/platform/tenants/${created.data.id}`);
  };

  const apiError = create.isError ? getApiErrorMessage(create.error) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Provision a new workspace"
        className="mt-8 w-full max-w-lg rounded-card bg-surface p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-content-default">New workspace</h2>
            <p className="mt-1 text-sm text-content-muted">
              Creates the restaurant, its first admin, and a starter menu. Commercial state is set now —
              every field is audit-logged.
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

        {apiError && (
          <div className="mt-4">
            <Alert tone="error">{apiError}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid grid-cols-2 gap-4" noValidate>
          <div className="col-span-2">
            <Input
              label="Restaurant name"
              placeholder="e.g. Harbor Test Kitchen"
              error={errors.restaurantName?.message}
              {...register('restaurantName')}
            />
          </div>
          <Input label="Admin first name" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Admin last name" autoComplete="off" error={errors.lastName?.message} {...register('lastName')} />
          <div className="col-span-2">
            <Input
              label="Admin email"
              type="email"
              autoComplete="off"
              hint="The new admin signs in with this — hand it to them securely."
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
          <div className="col-span-2">
            <Input
              label="Temporary admin password"
              type="password"
              autoComplete="new-password"
              hint="Min 8 chars incl. upper, lower & number. They can change it after signing in."
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
          <div>
            <label htmlFor="platform-create-plan" className="mb-1.5 block text-sm font-medium text-content-default">
              Plan
            </label>
            <select id="platform-create-plan" aria-label="Plan" className={SELECT_CLS} {...register('plan')}>
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="platform-create-status" className="mb-1.5 block text-sm font-medium text-content-default">
              Subscription status
            </label>
            <select id="platform-create-status" aria-label="Subscription status" className={SELECT_CLS} {...register('subscriptionStatus')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Input
              label="Seat limit"
              type="number"
              min={1}
              max={10000}
              hint="Max staff accounts for this workspace."
              error={errors.seatsLimit?.message}
              {...register('seatsLimit')}
            />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={create.isPending}>
              Create workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
