'use client';

import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { useEffectivePrice } from '@/hooks/use-menu';
import { formatPrice } from '@/lib/menu-ui';
import type { MenuItem } from '@/types/menu';

interface ItemCardProps {
  item: MenuItem;
  categoryName?: string;
  onEdit: () => void;
  onToggleAvailability: (item: MenuItem) => void;
}

export default function ItemCard({
  item,
  categoryName,
  onEdit,
  onToggleAvailability,
}: ItemCardProps) {
  const { data: effective } = useEffectivePrice(item.id);
  const hasBadge = item.isVegetarian || item.isVegan || item.isGlutenFree;
  const discounted = effective && effective.discountAmount > 0;

  return (
    <Card className="flex gap-4">
      {item.image ? (
        <img src={item.image} alt={item.name} className="h-20 w-20 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-surface-muted text-2xl text-content-muted">
          🍽️
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{item.name}</h3>
            <p className="truncate text-xs text-content-muted">{categoryName ?? 'Uncategorised'}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        </div>

        <p className="mt-1 line-clamp-2 text-sm text-content-muted">{item.description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">
            {effective ? formatPrice(effective.effectivePrice) : formatPrice(item.price)}
          </span>
          {discounted && (
            <span className="text-xs text-content-muted line-through">
              {formatPrice(effective.basePrice)}
            </span>
          )}
          {effective && !effective.orderableNow && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
              Unavailable now
            </span>
          )}
          {hasBadge && (
            <span className="flex gap-1">
              {item.isVegetarian && <Badge label="Veg" />}
              {item.isVegan && <Badge label="Vegan" />}
              {item.isGlutenFree && <Badge label="GF" />}
            </span>
          )}
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => onToggleAvailability(item)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              item.isAvailable
                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-gray-200 bg-gray-50 text-content-muted hover:bg-gray-100'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${item.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            {item.isAvailable ? 'Available' : 'Unavailable'}
          </button>
        </div>
      </div>
    </Card>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-700">
      {label}
    </span>
  );
}
