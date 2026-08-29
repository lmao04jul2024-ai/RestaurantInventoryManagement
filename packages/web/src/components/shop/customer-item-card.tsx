'use client';

import Button from '@/components/ui/button';
import DietaryBadges from '@/components/shop/dietary-badges';
import { formatPrice } from '@/lib/menu-ui';
import type { MenuItem } from '@/types/menu';

/** One dish card on the customer browsing grid (Week 10 / 10.1). */
export default function CustomerItemCard({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}) {
  return (
    <li className="flex flex-col rounded-card border border-gray-100 bg-surface p-4 shadow-card">
      {item.image ? (
        <img src={item.image} alt={item.name} className="mb-3 h-36 w-full rounded-lg object-cover" />
      ) : (
        <div
          aria-hidden
          className="mb-3 flex h-36 w-full items-center justify-center rounded-lg bg-surface-muted text-4xl"
        >
          🍜
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-content-default">{item.name}</h2>
        <span className="whitespace-nowrap font-semibold text-primary-700">
          {formatPrice(item.price)}
        </span>
      </div>
      {item.description && (
        <p className="mt-1 line-clamp-2 text-sm text-content-muted">{item.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DietaryBadges item={item} />
        {item.calories != null && (
          <span className="text-xs text-content-muted">{item.calories} kcal</span>
        )}
        {item.preparationTime != null && (
          <span className="text-xs text-content-muted">~{item.preparationTime} min</span>
        )}
      </div>
      <div className="mt-3 flex-1" />
      <Button size="sm" onClick={() => onAdd(item)}>
        Add to cart
      </Button>
    </li>
  );
}