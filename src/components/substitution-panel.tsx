'use client';

import { useState } from 'react';
import type { Substitution } from '@/lib/ai/substitutions';

/**
 * AI substitutions for what is missing. Suggestions already in the fridge are
 * marked, since those are what the prompt asks for first.
 */
export function SubstitutionPanel({
  recipeId,
  missing,
}: {
  recipeId: string;
  missing: string[];
}) {
  const [substitutions, setSubstitutions] = useState<Substitution[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/recipes/${recipeId}/substitutions`, { method: 'POST' });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not get substitutions.');
      setLoading(false);
      return;
    }

    const body = (await res.json()) as { substitutions: Substitution[] };
    setSubstitutions(body.substitutions);
    setLoading(false);
  }

  if (missing.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={ask}
        disabled={loading}
        className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {loading ? 'Thinking…' : 'Suggest substitutions'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {substitutions ? (
        substitutions.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No substitutions came back for this one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {substitutions.map((substitution) => (
              <li
                key={`${substitution.missing}-${substitution.suggestion}`}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{substitution.missing}</span>
                  <span aria-hidden>→</span>
                  <span>{substitution.suggestion}</span>
                  {substitution.fromInventory ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                      already in your fridge
                    </span>
                  ) : null}
                </p>
                {substitution.note ? (
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{substitution.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
