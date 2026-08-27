'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import { useCreatePricingRule, useDeletePricingRule } from '@/hooks/use-menu';
import type { MenuItem } from '@/types/menu';

export default function PricingRuleEditor({
  itemId,
  rules,
}: {
  itemId: string;
  rules: MenuItem['pricingRules'];
}) {
  const create = useCreatePricingRule();
  const del = useDeletePricingRule();
  const [type, setType] = useState<'PERCENT_DISCOUNT' | 'FIXED_PRICE'>('PERCENT_DISCOUNT');
  const [amount, setAmount] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const num = Number(amount);
    if (!num || num <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        itemId,
        payload: {
          adjustmentType: type,
          amount: num,
          startTime: start || null,
          endTime: end || null,
          daysOfWeek: [],
        },
      });
      setAmount('');
      setStart('');
      setEnd('');
    } catch {
      setError('Could not save the rule.');
    }
  };

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <p className="text-sm font-semibold">Pricing rules (7.6)</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {rules.length === 0 && <p className="text-xs text-content-muted">No pricing rules yet.</p>}
      <ul className="space-y-1">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {r.adjustmentType === 'PERCENT_DISCOUNT' ? `${r.amount}% off` : `$${r.amount}`}{' '}
              {formatWindow(r.startTime, r.endTime)}
              <span className="text-content-muted"> · priority {r.priority}</span>
            </span>
            <button
              type="button"
              onClick={() => del.mutate({ itemId, ruleId: r.id })}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'PERCENT_DISCOUNT' | 'FIXED_PRICE')}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="PERCENT_DISCOUNT">% off</option>
          <option value="FIXED_PRICE">Fixed $</option>
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={type === 'PERCENT_DISCOUNT' ? '%' : '$'}
          type="number"
          className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="HH:MM"
          className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-content-muted">to</span>
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          placeholder="HH:MM"
          className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <Button variant="outline" size="sm" type="button" onClick={add}>
          + Rule
        </Button>
      </div>
    </div>
  );
}

function formatWindow(start: string | null, end: string | null): string {
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return '(all day)';
}
