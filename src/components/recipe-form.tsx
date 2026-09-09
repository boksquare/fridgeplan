'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unit } from '@/generated/prisma/enums';
import { UNITS } from '@/lib/serialize';
import { IngredientAutocomplete } from '@/components/ingredient-autocomplete';

type Row = { name: string; quantity: string; unit: Unit | ''; };

export type RecipeFormValues = {
  id?: string;
  title: string;
  cuisine: string;
  instructions: string;
  imageUrl: string | null;
  ingredients: { name: string; quantity: number | null; unit: Unit | null }[];
};

const EMPTY_ROW: Row = { name: '', quantity: '', unit: '' };

/**
 * Your own recipe. Private to your household, and with no photo unless you add
 * one — nothing is fetched in to stand in for it.
 */
export function RecipeForm({ initial }: { initial?: RecipeFormValues }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [rows, setRows] = useState<Row[]>(
    initial?.ingredients.length
      ? initial.ingredients.map((ingredient) => ({
          name: ingredient.name,
          quantity: ingredient.quantity === null ? '' : String(ingredient.quantity),
          unit: ingredient.unit ?? '',
        }))
      : [{ ...EMPTY_ROW }],
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function uploadPhoto(recipeId: string) {
    if (!photo) return;
    const form = new FormData();
    form.set('photo', photo);
    const res = await fetch(`/api/recipes/${recipeId}/photo`, { method: 'POST', body: form });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'The recipe saved, but the photo did not upload.');
    }
  }

  async function removePhoto() {
    if (!initial?.id) {
      setPhoto(null);
      return;
    }
    const res = await fetch(`/api/recipes/${initial.id}/photo`, { method: 'DELETE' });
    if (res.ok) {
      setImageUrl(null);
      setPhoto(null);
      router.refresh();
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const ingredients = rows
      .filter((row) => row.name.trim().length > 0)
      .map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity ? Number(row.quantity) : null,
        unit: row.unit || null,
        raw: [row.quantity, row.unit === Unit.count ? '' : row.unit].filter(Boolean).join(' ').trim(),
      }));

    if (ingredients.length === 0) {
      setError('Add at least one ingredient.');
      setSubmitting(false);
      return;
    }

    const payload = { title: title.trim(), cuisine: cuisine.trim(), instructions, ingredients };

    try {
      const res = initial?.id
        ? await fetch(`/api/recipes/${initial.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/recipes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not save the recipe.');
      }

      const body = (await res.json()) as { recipe: { id: string } };
      await uploadPhoto(body.recipe.id);
      router.replace(`/recipes/${body.recipe.id}`);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!initial?.id) return;
    setSubmitting(true);
    const res = await fetch(`/api/recipes/${initial.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Could not delete the recipe.');
      setSubmitting(false);
      return;
    }
    router.replace('/recipes');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input
          type="text"
          required
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="font-medium">Cuisine (optional)</span>
        <input
          type="text"
          maxLength={60}
          value={cuisine}
          onChange={(event) => setCuisine(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Ingredients</legend>
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-44 flex-1">
              <IngredientAutocomplete
                value={row.name}
                onChange={(name) => updateRow(index, { name })}
              />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Amount</span>
              <input
                type="number"
                min="0"
                step="any"
                value={row.quantity}
                onChange={(event) => updateRow(index, { quantity: event.target.value })}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Unit</span>
              <select
                aria-label={`Unit for ingredient ${index + 1}`}
                value={row.unit}
                onChange={(event) => updateRow(index, { unit: event.target.value as Unit | '' })}
                className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">—</option>
                {UNITS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])}
          className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Add ingredient
        </button>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Method</span>
        <textarea
          rows={8}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Photo (optional)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>
        {imageUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
            <button
              type="button"
              onClick={removePhoto}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Remove photo
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {submitting ? 'Saving…' : initial?.id ? 'Save changes' : 'Save recipe'}
        </button>
        {initial?.id ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
          >
            Delete recipe
          </button>
        ) : null}
      </div>
    </form>
  );
}
