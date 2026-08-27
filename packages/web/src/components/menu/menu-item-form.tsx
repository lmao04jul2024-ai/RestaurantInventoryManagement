'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import { useCreateMenuItem, useUpdateMenuItem } from '@/hooks/use-menu';
import { getApiErrorMessage } from '@/lib/api';
import type { MenuItem } from '@/types/menu';
import PricingRuleEditor from './pricing-rule-editor';
import AvailabilityWindowEditor from './availability-window-editor';

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().gt(0, 'Price must be greater than zero'),
  categoryId: z.string().min(1, 'Choose a category'),
  image: z.string().optional(),
  isAvailable: z.boolean(),
  isVegetarian: z.boolean(),
  isVegan: z.boolean(),
  isGlutenFree: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export default function MenuItemForm({
  item,
  categories,
  onClose,
}: {
  item: MenuItem | null;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateMenuItem();
  const update = useUpdateMenuItem();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: (item?.price ?? 0) as number,
      categoryId: item?.categoryId ?? categories[0]?.id ?? '',
      image: item?.image ?? '',
      isAvailable: item?.isAvailable ?? true,
      isVegetarian: item?.isVegetarian ?? false,
      isVegan: item?.isVegan ?? false,
      isGlutenFree: item?.isGlutenFree ?? false,
    },
  });

  const dietary = watch();

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const payload = {
      name: values.name,
      description: values.description || undefined,
      price: values.price,
      categoryId: values.categoryId,
      image: values.image || null,
      isAvailable: values.isAvailable,
      isVegetarian: values.isVegetarian,
      isVegan: values.isVegan,
      isGlutenFree: values.isGlutenFree,
    };
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{item ? 'Edit item' : 'New menu item'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-content-muted hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input label="Name" error={errors.name?.message} {...register('name')} />
          <Input label="Description" {...register('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Price ($)"
              type="number"
              step="0.01"
              error={errors.price?.message}
              {...register('price')}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-content-default">
                Category
              </label>
              <select
                {...register('categoryId')}
                className="block w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.depth ? '— '.repeat(c.depth) : ''}
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>
              )}
            </div>
          </div>
          <Input
            label="Image URL (7.3)"
            placeholder="https://… (optional)"
            {...register('image')}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            {(['isVegetarian', 'isVegan', 'isGlutenFree'] as const).map((key) => (
              <label key={key} className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={dietary[key]}
                  onChange={(e) => setValue(key, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {key[0].toUpperCase() + key.slice(1)}
              </label>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={dietary.isAvailable}
                onChange={(e) => setValue('isAvailable', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Available
            </label>
          </div>
          {item && <PricingRuleEditor itemId={item.id} rules={item.pricingRules} />}
          {item && <AvailabilityWindowEditor itemId={item.id} windows={item.availabilityWindows} />}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {item ? 'Save changes' : 'Create item'}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
