'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unit } from '@/generated/prisma/enums';
import { UNITS, type ClientCompartment } from '@/lib/serialize';
import { shrinkForVision } from '@/lib/receipts/shrink';
import { IngredientAutocomplete } from '@/components/ingredient-autocomplete';
import { Dialog } from '@/components/dialog';

type DraftItem = {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  raw: string;
  known: boolean;
};

type Row = {
  key: string;
  include: boolean;
  name: string;
  quantity: string;
  unit: Unit;
  compartmentId: string;
  raw: string;
  known: boolean;
};

/**
 * Reads a receipt photo into inventory, but never straight into it: the model's
 * reading is a draft the user checks line by line, with the printed text beside
 * each one. The photo is sent for the one request and is not stored anywhere.
 */
export function ReceiptScanner({
  compartments,
  defaultCompartmentId,
  onAdded,
}: {
  compartments: ClientCompartment[];
  defaultCompartmentId: string;
  onAdded: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'reading' | 'review'>('idle');
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function onPick(file: File) {
    setStage('reading');
    setError(null);
    setDone(null);

    try {
      const shrunk = await shrinkForVision(file);
      const form = new FormData();
      form.set('photo', shrunk);

      const res = await fetch('/api/receipts/scan', { method: 'POST', body: form });
      const body = (await res.json().catch(() => null)) as
        | { items?: DraftItem[]; note?: string | null; error?: string }
        | null;

      if (!res.ok) {
        setError(body?.error ?? 'Could not read that photo.');
        setStage('idle');
        return;
      }

      const items = body?.items ?? [];
      if (items.length === 0) {
        setError(
          body?.note ??
            'Nothing food-shaped was found on that photo. A flatter, better-lit shot usually helps.',
        );
        setStage('idle');
        return;
      }

      setRows(
        items.map((item, index) => ({
          key: `${index}-${item.name}`,
          include: true,
          name: item.name,
          quantity: item.quantity === null ? '1' : String(item.quantity),
          unit: item.unit ?? Unit.count,
          compartmentId: defaultCompartmentId,
          raw: item.raw,
          known: item.known,
        })),
      );
      setNote(body?.note ?? null);
      setStage('review');
    } catch (caught) {
      setError((caught as Error).message);
      setStage('idle');
    }
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const included = rows.filter((row) => row.include);
  const invalid = included.filter((row) => !row.name.trim() || !(Number(row.quantity) > 0));

  async function confirm() {
    setSaving(true);
    setError(null);

    const res = await fetch('/api/inventory/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: included.map((row) => ({
          compartmentId: row.compartmentId,
          ingredientName: row.name.trim(),
          quantity: Number(row.quantity),
          unit: row.unit,
        })),
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not add those items.');
      setSaving(false);
      return;
    }

    const body = (await res.json()) as { added: number };
    setSaving(false);
    setStage('idle');
    setRows([]);
    setDone(`Added ${body.added} item${body.added === 1 ? '' : 's'} from the receipt.`);
    onAdded();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        // On a phone this opens the camera directly.
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onPick(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={stage === 'reading'}
        className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {stage === 'reading' ? 'Reading the receipt…' : 'Scan a receipt'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {done ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{done}</p> : null}

      {stage === 'review' ? (
        <Dialog title="What the receipt says" onDismiss={() => setStage('idle')}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Check each line before it goes in — the printed text is shown beside the reading.
            Nothing is added until you confirm, and the photo was not stored.
          </p>

          {note ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              {note}
            </p>
          ) : null}

          <ul className="flex max-h-[50vh] flex-col gap-3 overflow-auto">
            {rows.map((row) => (
              <li key={row.key} className="flex flex-col gap-1.5 border-b border-slate-200 pb-3 last:border-0 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.include}
                    aria-label={`Add ${row.name}`}
                    onChange={(event) => update(row.key, { include: event.target.checked })}
                    className="size-4"
                  />
                  <div className="min-w-0 flex-1">
                    <IngredientAutocomplete
                      value={row.name}
                      onChange={(name) => update(row.key, { name })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2 pl-6">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.quantity}
                      disabled={!row.include}
                      onChange={(event) => update(row.key, { quantity: event.target.value })}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Unit</span>
                    <select
                      aria-label={`Unit for ${row.name}`}
                      value={row.unit}
                      disabled={!row.include}
                      onChange={(event) => update(row.key, { unit: event.target.value as Unit })}
                      className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {UNITS.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Goes in</span>
                    <select
                      aria-label={`Where to put ${row.name}`}
                      value={row.compartmentId}
                      disabled={!row.include}
                      onChange={(event) => update(row.key, { compartmentId: event.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {compartments.map((compartment) => (
                        <option key={compartment.id} value={compartment.id}>
                          {compartment.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {row.raw ? (
                    <span className="max-w-full truncate text-xs text-slate-500 dark:text-slate-400">
                      printed: <code>{row.raw}</code>
                    </span>
                  ) : null}
                  {row.known ? null : (
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-400">
                      new ingredient
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {invalid.length > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Give a name and an amount for every line you are keeping, or uncheck it.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={saving || included.length === 0 || invalid.length > 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {saving
                ? 'Adding…'
                : `Add ${included.length} item${included.length === 1 ? '' : 's'}`}
            </button>
            <button
              type="button"
              onClick={() => setStage('idle')}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Discard
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
