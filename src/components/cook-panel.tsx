'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unit } from '@/generated/prisma/enums';
import { convertAmount } from '@/lib/recipes/units';
import { UNITS } from '@/lib/serialize';
import { Dialog } from '@/components/dialog';

export type CookCandidate = {
  ingredientName: string;
  recipeAmount: string;
  recipeQuantity: number | null;
  recipeUnit: Unit | null;
  match: {
    itemId: string;
    label: string;
    stocked: number;
    unit: Unit;
  } | null;
};

type Line = {
  key: string;
  include: boolean;
  itemId: string;
  quantity: string;
  unit: Unit;
  ingredientName: string;
  stocked: number;
  /** True when we could not convert the recipe amount into the stocked unit. */
  needsConfirmation: boolean;
};

function buildLines(candidates: CookCandidate[]): Line[] {
  return candidates
    .filter((candidate) => candidate.match !== null)
    .map((candidate, index) => {
      const match = candidate.match!;
      const converted =
        candidate.recipeQuantity !== null && candidate.recipeUnit
          ? convertAmount(candidate.recipeQuantity, candidate.recipeUnit, match.unit)
          : null;

      return {
        key: `${match.itemId}-${index}`,
        include: true,
        itemId: match.itemId,
        // Left blank when the units do not reconcile: the user says what was
        // used rather than the app guessing.
        quantity: converted === null ? '' : String(Math.min(converted, match.stocked)),
        unit: match.unit,
        ingredientName: candidate.ingredientName,
        stocked: match.stocked,
        needsConfirmation: converted === null,
      };
    });
}

/**
 * "Did you cook this?" — the app proposes what to take out of the fridge, the
 * user confirms or edits it, and only then is inventory decremented.
 */
export function CookPanel({
  recipeId,
  candidates,
}: {
  recipeId: string;
  candidates: CookCandidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>(() => buildLines(candidates));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const unmatched = candidates.filter((candidate) => candidate.match === null);
  const included = lines.filter((line) => line.include);
  const blanks = included.filter((line) => !Number(line.quantity));

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function confirm() {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/recipes/${recipeId}/cook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lines: included.map((line) => ({
          itemId: line.itemId,
          quantity: Number(line.quantity),
          unit: line.unit,
        })),
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not update your inventory.');
      setSubmitting(false);
      return;
    }

    const body = (await res.json()) as { decremented: { ingredientName: string }[]; usedUp: string[] };
    setSubmitting(false);
    setOpen(false);
    setDone(
      `Updated ${body.decremented.length} item${body.decremented.length === 1 ? '' : 's'}${
        body.usedUp.length > 0 ? `, ${body.usedUp.length} now used up` : ''
      }.`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          setLines(buildLines(candidates));
          setDone(null);
          setOpen(true);
        }}
        disabled={candidates.length === 0}
        className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
      >
        Mark as cooked
      </button>

      {done ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{done}</p> : null}

      {open ? (
        <Dialog title="Did you cook this?" onDismiss={() => setOpen(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Confirm what you actually used and your fridges will be updated. Uncheck anything you
            did not use.
          </p>

          <ul className="flex max-h-72 flex-col gap-2 overflow-auto">
            {lines.map((line) => (
              <li key={line.key} className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={line.include}
                  aria-label={`Used ${line.ingredientName}`}
                  onChange={(event) => update(line.key, { include: event.target.checked })}
                  className="size-4"
                />
                <span className="min-w-28 flex-1">{line.ingredientName}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={line.quantity}
                  disabled={!line.include}
                  aria-label={`Amount of ${line.ingredientName} used`}
                  onChange={(event) => update(line.key, { quantity: event.target.value })}
                  className={`w-20 rounded-lg border px-2 py-1 dark:bg-slate-900 ${
                    line.include && !Number(line.quantity)
                      ? 'border-amber-400'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                <select
                  value={line.unit}
                  disabled={!line.include}
                  aria-label={`Unit for ${line.ingredientName}`}
                  onChange={(event) => update(line.key, { unit: event.target.value as Unit })}
                  className="rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                >
                  {UNITS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {line.stocked} {line.unit} in stock
                  {line.needsConfirmation ? ' · amount needs confirming' : ''}
                </span>
              </li>
            ))}
          </ul>

          {unmatched.length > 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Not in your fridges, so nothing to deduct:{' '}
              {unmatched.map((candidate) => candidate.ingredientName).join(', ')}.
            </p>
          ) : null}

          {blanks.length > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Fill in how much you used of {blanks.map((line) => line.ingredientName).join(', ')}, or
              uncheck them.
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={submitting || included.length === 0 || blanks.length > 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {submitting ? 'Updating…' : 'Yes, I cooked it'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Not yet
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
