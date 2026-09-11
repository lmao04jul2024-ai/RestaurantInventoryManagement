'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import CustomerItemCard from '@/components/shop/customer-item-card';
import ItemCustomizer from '@/components/shop/item-customizer';
import { useCategories, useMenuItems, useMenus } from '@/hooks/use-menu';
import type { MenuItem, MenuItemListQuery } from '@/types/menu';

type DietaryFilter = 'vegetarian' | 'vegan' | 'glutenFree';

const DIETARY_FILTERS: Array<{ key: DietaryFilter; label: string }> = [
  { key: 'vegetarian', label: '🌱 Vegetarian' },
  { key: 'vegan', label: '🌿 Vegan' },
  { key: 'glutenFree', label: 'Gluten-free' },
];

const SORTS: Array<{ value: NonNullable<MenuItemListQuery['sort']>; label: string }> = [
  { value: 'name', label: 'A–Z' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'newest', label: 'Newest' },
];

const PAGE_SIZE = 12;

/**
 * Week 10 (10.1) — customer menu browsing. Only currently-available items are
 * listed (`available: true`); category chips use top-level categories because
 * the API expands a category filter into its subtree.
 */
export default function CustomerMenu() {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [dietary, setDietary] = useState<Record<DietaryFilter, boolean>>({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  });
  const [sort, setSort] = useState<NonNullable<MenuItemListQuery['sort']>>('name');
  const [page, setPage] = useState(1);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);

  const { data: menus } = useMenus();
  const primaryMenu = menus?.find((m) => m.isActive) ?? menus?.[0];
  const { data: categories } = useCategories(primaryMenu?.id);

  const itemsQuery = useMenuItems({
    q: q.trim() || undefined,
    categoryId,
    available: true,
    vegetarian: dietary.vegetarian || undefined,
    vegan: dietary.vegan || undefined,
    glutenFree: dietary.glutenFree || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  });
  const items = itemsQuery.data?.data ?? [];
  const pagination = itemsQuery.data?.pagination;

  const topLevelCategories = (categories ?? []).filter((c) => c.parentId === null);

  const chooseCategory = (id: string | undefined) => {
    setCategoryId(id);
    setPage(1);
  };

  const toggleDietary = (key: DietaryFilter) => {
    setDietary((prev) => ({ ...prev, [key]: !prev[key] }));
    setPage(1);
  };

  const chipClasses = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-primary-600 text-on-primary'
        : 'border border-gray-200 bg-surface text-content-muted hover:bg-gray-50'
    }`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-bold text-content-default">Browse the menu</h1>
      <p className="mt-1 text-sm text-content-muted">
        {primaryMenu?.name ?? "Today's menu"} — add items to your cart and check out when ready.
      </p>

      {/* Toolbar: search + dietary filters + sort + categories */}
      <div className="mt-6 space-y-3">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search dishes…"
          aria-label="Search dishes"
          className="block w-full rounded border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <div className="flex flex-wrap items-center gap-2">
          {DIETARY_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={dietary[f.key]}
              onClick={() => toggleDietary(f.key)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                dietary[f.key]
                  ? 'bg-primary-600 text-on-primary'
                  : 'border border-gray-200 bg-surface text-content-muted hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as NonNullable<MenuItemListQuery['sort']>);
              setPage(1);
            }}
            aria-label="Sort items"
            className="ml-auto rounded border border-gray-300 bg-surface px-3 py-1.5 text-sm text-content-default focus:border-primary-500 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Categories">
          <button
            type="button"
            onClick={() => chooseCategory(undefined)}
            aria-pressed={categoryId === undefined}
            className={chipClasses(categoryId === undefined)}
          >
            All
          </button>
          {topLevelCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => chooseCategory(cat.id)}
              aria-pressed={categoryId === cat.id}
              className={chipClasses(categoryId === cat.id)}
            >
              {cat.icon ? `${cat.icon} ` : ''}
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items grid */}
      {itemsQuery.isLoading ? (
        <div className="mt-10 flex justify-center">
          <span
            aria-hidden
            className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"
          />
          <span className="sr-only">Loading menu…</span>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-content-muted">
          No dishes match your filters right now.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CustomerItemCard key={item.id} item={item} onAdd={setCustomizing} />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Previous
          </Button>
          <span className="text-sm text-content-muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      )}

      {customizing && <ItemCustomizer item={customizing} onClose={() => setCustomizing(null)} />}
    </div>
  );
}