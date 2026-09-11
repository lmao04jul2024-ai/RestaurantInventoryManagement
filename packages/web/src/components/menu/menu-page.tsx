'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import {
  useCategories,
  useMenuItems,
  useMenus,
  useUpdateMenuItem,
} from '@/hooks/use-menu';
import { flattenCategories } from '@/lib/menu-ui';
import type { MenuItem, MenuItemListQuery } from '@/types/menu';
import ItemCard from './menu-item-card';
import MenuItemForm from './menu-item-form';
import type { CategoryOption } from './menu-item-form';

const SORT_OPTIONS: Array<{ value: NonNullable<MenuItemListQuery['sort']>; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'price_asc', label: 'Price (low → high)' },
  { value: 'price_desc', label: 'Price (high → low)' },
];

const selectCls =
  'rounded border border-gray-300 bg-surface text-content-default px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200';

export default function MenuPage() {
  const { data: menus } = useMenus();
  const menuId = menus?.[0]?.id;
  const { data: categories } = useCategories(menuId);
  const updateAvailability = useUpdateMenuItem();

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [available, setAvailable] = useState('all');
  const [dietary, setDietary] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<NonNullable<MenuItemListQuery['sort']>>('newest');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);

  const query: MenuItemListQuery = useMemo(() => {
    const result: MenuItemListQuery = { q: q || undefined, sort, page, limit: 20 };
    if (categoryId !== 'all') result.categoryId = categoryId;
    if (available !== 'all') result.available = available === 'true';
    if (dietary.vegetarian) result.vegetarian = true;
    if (dietary.vegan) result.vegan = true;
    if (dietary.glutenFree) result.glutenFree = true;
    return result;
  }, [q, categoryId, available, dietary, sort, page]);

  const { data, isLoading, isError } = useMenuItems(query);

  const flatCategories: CategoryOption[] = useMemo(
    () => flattenCategories(categories ?? []),
    [categories],
  );
  const categoryName = (id: string) => flatCategories.find((c) => c.id === id)?.name;

  const onToggle = async (item: MenuItem) => {
    await updateAvailability.mutateAsync({ id: item.id, payload: { isAvailable: !item.isAvailable } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menu</h1>
          <p className="mt-1 text-sm text-content-muted">
            {menus?.[0] ? `Menu: ${menus[0].name}` : 'Loading menu…'}
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>+ New item</Button>
      </div>

      <Card padded={false} className="divide-y divide-gray-100">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Input
            className="max-w-xs"
            placeholder="Search items…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className={selectCls}
          >
            <option value="all">All categories</option>
            {flatCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.depth ? '— '.repeat(c.depth) : ''}
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Availability"
            value={available}
            onChange={(e) => {
              setAvailable(e.target.value);
              setPage(1);
            }}
            className={selectCls}
          >
            <option value="all">Any availability</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as NonNullable<MenuItemListQuery['sort']>);
              setPage(1);
            }}
            className={selectCls}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm text-content-muted">
          {(['vegetarian', 'vegan', 'glutenFree'] as const).map((key) => (
            <label key={key} className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={!!dietary[key]}
                onChange={(e) => {
                  setDietary((d) => ({ ...d, [key]: e.target.checked }));
                  setPage(1);
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              {key[0].toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>
      </Card>
      {isError && <Alert tone="error">Failed to load menu items.</Alert>}
      {isLoading && <p className="text-sm text-content-muted">Loading items…</p>}
      {!isLoading && data && data.data.length === 0 && (
        <Card>
          <p className="text-sm text-content-muted">
            No items match. Create your first item or adjust the filters.
          </p>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {data?.data.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            categoryName={categoryName(item.categoryId)}
            onEdit={() => setEditing(item)}
            onToggleAvailability={onToggle}
          />
        ))}
      </div>
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Prev
          </Button>
          <span className="text-sm text-content-muted">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next →
          </Button>
        </div>
      )}
      {editing && (
        <MenuItemForm
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          categories={flatCategories}
          onClose={() => setEditing(null)}
        />
      )}

    </div>
  );
}
