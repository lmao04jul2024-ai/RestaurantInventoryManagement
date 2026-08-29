'use client';

import type { MenuItem } from '@/types/menu';

const BADGES: Array<{ test: (item: MenuItem) => boolean; label: string; className: string }> = [
  { test: (i) => i.isVegetarian, label: '🌱 Veg', className: 'bg-emerald-50 text-emerald-700' },
  { test: (i) => i.isVegan, label: '🌿 Vegan', className: 'bg-green-50 text-green-700' },
  { test: (i) => i.isGlutenFree, label: 'GF', className: 'bg-amber-50 text-amber-700' },
];

/** Dietary chips shared by the customer menu cards and the item customizer. */
export default function DietaryBadges({ item }: { item: MenuItem }) {
  const active = BADGES.filter((b) => b.test(item));
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((b) => (
        <span
          key={b.label}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${b.className}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}