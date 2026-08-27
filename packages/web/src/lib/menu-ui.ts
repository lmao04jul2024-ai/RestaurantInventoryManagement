import type { Category } from '@/types/menu';

/** Flattens a category tree into display rows carrying their nesting depth. */
export function flattenCategories(
  categories: Category[] | undefined,
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  if (!categories) return [];
  const rows: Array<{ id: string; name: string; depth: number }> = [];
  for (const cat of categories) {
    rows.push({ id: cat.id, name: cat.name, depth });
    if (cat.children && cat.children.length > 0) {
      rows.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return rows;
}

/** Formats a price in the tenant's default currency (USD placeholder currency symbol). */
export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}
