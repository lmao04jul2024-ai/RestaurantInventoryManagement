import { parse } from 'csv-parse/sync';

/**
 * Phase 5 S3.1 — CSV inventory import parsing.
 *
 * Spreadsheet exports vary wildly (header names, casing, quoting), so parsing
 * is header-tolerant: headers are lower-cased/trimmed and matched through an
 * alias table. The first line is ALWAYS treated as a header row. Unknown
 * columns are ignored; missing optional columns fall back to schema defaults.
 */

export interface ParsedImportTable {
  headers: string[];
  records: Record<string, string>[];
}

/** Header alias → canonical import-row field. */
const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  item: 'name',
  title: 'name',
  itemname: 'name',
  product: 'name',
  sku: 'sku',
  code: 'sku',
  itemcode: 'sku',
  productcode: 'sku',
  currentstock: 'currentStock',
  stock: 'currentStock',
  qty: 'currentStock',
  quantity: 'currentStock',
  onhand: 'currentStock',
  minstock: 'minStock',
  min: 'minStock',
  minimum: 'minStock',
  reorder: 'minStock',
  reorderlevel: 'minStock',
  reorderpoint: 'minStock',
  maxstock: 'maxStock',
  max: 'maxStock',
  maximum: 'maxStock',
  unit: 'unit',
  uom: 'unit',
  units: 'unit',
  costprice: 'costPrice',
  cost: 'costPrice',
  unitcost: 'costPrice',
  sellingprice: 'sellingPrice',
  price: 'sellingPrice',
  sellprice: 'sellingPrice',
  saleprice: 'sellingPrice',
  suppliername: 'supplierName',
  supplier: 'supplierName',
  vendor: 'supplierName',
  vendorname: 'supplierName',
};

const CANONICAL_FIELDS = new Set(Object.values(HEADER_ALIASES));

function normalizeHeader(header: string): string | null {
  const key = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const canonical = HEADER_ALIASES[key];
  return canonical && CANONICAL_FIELDS.has(canonical) ? canonical : null;
}

/**
 * Parse CSV text into header-normalized string records.
 * @throws Error with code CSV_EMPTY when there is no data, CSV_NO_COLUMNS
 * when no header maps to a known field.
 */
export function parseInventoryCsv(data: string): ParsedImportTable {
  const records = parse(data, {
    columns: false,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as string[][];

  const nonEmpty = records.filter((row) => row.some((cell) => cell !== ''));
  if (nonEmpty.length === 0) throw Object.assign(new Error('CSV has no rows'), { code: 'CSV_EMPTY' });

  const rawHeaders = nonEmpty[0];
  const mapped = rawHeaders.map(normalizeHeader);
  if (!mapped.some((h): h is string => h !== null)) {
    throw Object.assign(new Error('CSV header matches no known inventory column'), {
      code: 'CSV_NO_COLUMNS',
    });
  }

  const out: Record<string, string>[] = [];
  for (const row of nonEmpty.slice(1)) {
    const record: Record<string, string> = {};
    row.forEach((cell, i) => {
      const field = mapped[i];
      if (field && cell !== '') record[field] = cell;
    });
    if (Object.keys(record).length > 0) out.push(record);
  }
  return { headers: rawHeaders, records: out };
}
