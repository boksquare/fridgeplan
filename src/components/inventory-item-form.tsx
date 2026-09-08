'use client';

import { useState } from 'react';
import { Unit } from '@/generated/prisma/enums';
import { UNITS, toDateInputValue, type ClientItem } from '@/lib/serialize';
import { IngredientAutocomplete } from '@/components/ingredient-autocomplete';

type Props = {
  compartmentId: string;
  /** Editing an existing item when set, otherwise adding a new one. */
  item?: ClientItem;
  onDone: () => void;
  onCancel?: () => void;
};

export function InventoryItemForm({ compartmentId, item, onDone, onCancel }: Props) {
  const [ingredientName, setIngredientName] = useState(item?.ingredientName ?? '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '1');
  const [unit, setUnit] = useState<Unit>(item?.unit ?? Unit.count);
  const [dateAdded, setDateAdded] = useState(item?.dateAdded ?? toDateInputValue(new Date()));
  const [expirationDate, setExpirationDate] = useState(item?.expirationDate ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Give a quantity greater than zero.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      ingredientName: ingredientName.trim(),
      quantity: amount,
      unit,
      ...(dateAdded ? { dateAdded } : {}),
      expirationDate: expirationDate || null,
    };

    const res = item
      ? await fetch(`/api/inventory/${item.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // A new item needs no explicit expiry key when it has no date.
          body: JSON.stringify({
            compartmentId,
            ...payload,
            ...(expirationDate ? { expirationDate } : { expirationDate: undefined }),
          }),
        });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not save the item.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <IngredientAutocomplete value={ingredientName} onChange={setIngredientName} required />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Amount</span>
          <input
            type="number"
            required
            min="0.001"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Unit</span>
          <select
            // Named explicitly: a wrapping label would otherwise fold every
            // option's text into the control's accessible name.
            aria-label="Unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value as Unit)}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            {UNITS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Bought (optional)</span>
          <input
            type="date"
            value={dateAdded}
            onChange={(event) => setDateAdded(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Expires (optional)</span>
          <input
            type="date"
            value={expirationDate}
            onChange={(event) => setExpirationDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {submitting ? 'Saving…' : item ? 'Save changes' : 'Add to compartment'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
