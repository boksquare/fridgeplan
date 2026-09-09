'use client';

import { useState } from 'react';
import { RecipeSummaryList } from '@/components/recipe-summary-list';
import type { RecipeSummary } from '@/lib/recipes/service';

/** Free-text and cuisine search over the configured sources. */
export function RecipeSearch() {
  const [query, setQuery] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [results, setResults] = useState<RecipeSummary[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    setErrors([]);

    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (cuisine.trim()) params.set('cuisine', cuisine.trim());

    const res = await fetch(`/api/recipes/search?${params.toString()}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErrors([body?.error ?? 'Search failed.']);
      setResults([]);
      setSearching(false);
      return;
    }

    const body = (await res.json()) as { results: RecipeSummary[]; errors: string[] };
    setResults(body.results);
    setErrors(body.errors ?? []);
    setSearching(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Dish or ingredient</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="pasta, chicken, laksa…"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cuisine (optional)</span>
          <input
            type="text"
            value={cuisine}
            onChange={(event) => setCuisine(event.target.value)}
            placeholder="Italian"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <button
          type="submit"
          disabled={searching || (!query.trim() && !cuisine.trim())}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {errors.length > 0 ? (
        <ul className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {results ? (
        <RecipeSummaryList recipes={results} emptyMessage="Nothing came back for that." />
      ) : null}
    </div>
  );
}
