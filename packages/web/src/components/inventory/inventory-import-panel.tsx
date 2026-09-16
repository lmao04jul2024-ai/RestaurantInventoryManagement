'use client';

import { useState } from 'react';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import { useImportItems } from '@/hooks/use-inventory';
import type { InventoryImportResult } from '@/types/inventory';

const SAMPLE_CSV = `name,sku,unit,currentStock,minStock,costPrice,supplierName
Flour,FL-001,kg,25,10,2.50,Acme Foods
Tomatoes,TM-001,kg,8,15,3.20,
Olive Oil,OO-001,L,5,2,9.99,Acme Foods`;

/**
 * Phase 5 S3.1 — CSV inventory import panel. Paste CSV (or exported from a
 * spreadsheet), preview with Dry run first, then Import. Per-row errors are
 * reported with row numbers so the operator can fix the sheet and re-run.
 */
export default function InventoryImportPanel() {
  const importItems = useImportItems();
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<InventoryImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean) => {
    setError(null);
    setResult(null);
    if (!csv.trim()) {
      setError('Paste CSV data first — or load the sample to try it out.');
      return;
    }
    try {
      const res = await importItems.mutateAsync({ data: csv, dryRun });
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Import inventory from CSV</h2>
          <p className="mt-1 text-sm text-content-muted">
            Columns: <code>name, sku, unit, currentStock, minStock, costPrice, supplierName</code>.
            Only <code>name</code> and <code>sku</code> are required — the rest default sensibly.
          </p>
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={() => setCsv(SAMPLE_CSV)}>
          Load sample
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-content-default">CSV data</span>
        <textarea
          aria-label="CSV data"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={SAMPLE_CSV}
          className="block w-full rounded border border-gray-200 bg-surface px-3.5 py-2.5 font-mono text-xs shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          isLoading={importItems.isPending}
          onClick={() => void run(true)}
        >
          Preview (dry run)
        </Button>
        <Button type="button" isLoading={importItems.isPending} onClick={() => void run(false)}>
          Import items
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          <Alert tone={result.errors.length > 0 ? 'warning' : 'success'}>
            {result.dryRun ? 'Preview — nothing was saved. ' : ''}
            {result.created} of {result.total} rows {result.dryRun ? 'would be created' : 'created'}
            {result.skipped > 0 && `, ${result.skipped} skipped`}.
          </Alert>
          {result.warnings.length > 0 && (
            <ul className="space-y-1 text-sm text-content-muted">
              {result.warnings.map((w, i) => (
                <li key={i}>
                  Row {w.row}: {w.message}
                </li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-content-muted">
                  <tr>
                    <th className="pb-2 pr-4 font-semibold">Row</th>
                    <th className="pb-2 pr-4 font-semibold">Field</th>
                    <th className="pb-2 font-semibold">Problem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.errors.map((e, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4">{e.row}</td>
                      <td className="py-2 pr-4">{e.field}</td>
                      <td className="py-2">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
