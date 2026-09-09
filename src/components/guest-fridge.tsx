'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Unit } from '@/generated/prisma/enums';
import { expiryStatus, expiryLabel } from '@/lib/expiry';
import { UNITS, toDateInputValue } from '@/lib/serialize';
import {
  EMPTY_SHAPE,
  FridgeShapePicker,
  shapeToRequest,
  type FridgeShape,
} from '@/components/fridge-shape-picker';
import { Fridge3DIsland } from '@/components/fridge-3d-island';
import { IngredientAutocomplete } from '@/components/ingredient-autocomplete';
import { Dialog } from '@/components/dialog';
import {
  addGuestItem,
  createGuestFridge,
  getGuestFridgeServerSnapshot,
  getGuestFridgeSnapshot,
  guestInventory,
  removeGuestItem,
  saveGuestFridge,
  subscribeToGuestFridge,
  type GuestCompartment,
  type GuestFridgeState,
} from '@/lib/guest-store';
import type { ProviderRecipe } from '@/lib/recipes/types';

type GuestResult = {
  recipe: ProviderRecipe;
  haveCount: number;
  totalCount: number;
  missing: string[];
};

/**
 * Guest mode: the whole fridge lives in this browser. The server is only ever
 * asked to look up recipes, and is told nothing that it keeps.
 */
export function GuestFridge() {
  const fridge = useSyncExternalStore(
    subscribeToGuestFridge,
    getGuestFridgeSnapshot,
    getGuestFridgeServerSnapshot,
  );
  const [shape, setShape] = useState<FridgeShape>(EMPTY_SHAPE);
  const [openPanel, setOpenPanel] = useState<{ id: string; compartmentIds: string[] } | null>(null);
  const [shownCompartmentId, setShownCompartmentId] = useState<string | null>(null);
  const [results, setResults] = useState<GuestResult[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [openRecipe, setOpenRecipe] = useState<GuestResult | null>(null);
  const [resetting, setResetting] = useState(false);

  function update(next: GuestFridgeState | null) {
    // Writing notifies the store, which re-renders this component.
    saveGuestFridge(next);
  }

  const behindDoor = (openPanel?.compartmentIds ?? [])
    .map((id) => fridge?.compartments.find((compartment) => compartment.id === id))
    .filter((compartment): compartment is GuestCompartment => Boolean(compartment));
  const selected =
    behindDoor.find((compartment) => compartment.id === shownCompartmentId) ?? behindDoor[0] ?? null;

  const compartments = useMemo(
    () =>
      (fridge?.compartments ?? []).map((compartment) => ({
        id: compartment.id,
        type: compartment.type,
        label: compartment.label,
        position: compartment.position,
        itemCount: compartment.items.length,
        worstExpiry: compartment.items.reduce<'none' | 'fresh' | 'soon' | 'expired'>(
          (worst, item) => {
            const status = expiryStatus(item.expirationDate ? new Date(item.expirationDate) : null);
            const rank = { none: 0, fresh: 1, soon: 2, expired: 3 } as const;
            return rank[status] > rank[worst] ? status : worst;
          },
          'none',
        ),
        itemLabels: compartment.items.map((item) => ({
          id: item.id,
          label:
            item.unit === Unit.count
              ? `${item.quantity}× ${item.ingredientName}`
              : `${item.ingredientName} ${item.quantity}${
                  UNITS.find((unit) => unit.value === item.unit)?.label ?? item.unit
                }`,
          expiry: expiryStatus(item.expirationDate ? new Date(item.expirationDate) : null),
        })),
      })),
    [fridge],
  );

  async function findRecipes(mode: 'suggest' | 'search', query?: string) {
    if (!fridge) return;
    setBusy(true);
    setErrors([]);

    const res = await fetch('/api/guest/recipes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode,
        query,
        inventory: guestInventory(fridge).map((entry) => ({
          ingredientName: entry.ingredientName,
          quantity: entry.quantity,
          unit: entry.unit,
        })),
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErrors([body?.error ?? 'Could not look up recipes.']);
      setResults([]);
      setBusy(false);
      return;
    }

    const body = (await res.json()) as { results: GuestResult[]; errors: string[] };
    setResults(body.results);
    setErrors(body.errors ?? []);
    setBusy(false);
  }

  if (!fridge) {
    return (
      <div className="flex flex-col gap-8">
        <FridgeShapePicker value={shape} onChange={setShape} />
        {shape.type ? (
          <button
            type="button"
            onClick={() => update(createGuestFridge(shapeToRequest(shape)))}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            Create my fridge
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Fridge3DIsland
            type={fridge.type}
            compartments={compartments}
            selectedId={openPanel?.id ?? null}
            onSelect={(panelId, compartmentIds) => {
              setOpenPanel((current) => (current?.id === panelId ? null : { id: panelId, compartmentIds }));
              setShownCompartmentId(compartmentIds[0] ?? null);
            }}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click a door or drawer on the model, or use the buttons.
          </p>
        </div>

        {selected ? (
          <GuestCompartmentPanel
            compartment={selected}
            siblings={behindDoor.map((compartment) => ({
              id: compartment.id,
              label: compartment.label,
              itemCount: compartment.items.length,
            }))}
            onSelectSibling={setShownCompartmentId}
            onClose={() => setOpenPanel(null)}
            onAdd={(item) => update(addGuestItem(fridge, selected.id, item))}
            onRemove={(itemId) => update(removeGuestItem(fridge, itemId))}
          />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nothing open yet. Choose a compartment to add or check items.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || guestInventory(fridge).length === 0}
            onClick={() => findRecipes('suggest')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {busy ? 'Looking…' : 'Suggest recipes'}
          </button>
          <GuestSearch onSearch={(query) => findRecipes('search', query)} disabled={busy} />
          <button
            type="button"
            onClick={() => setResetting(true)}
            className="text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Start over
          </button>
        </div>

        {errors.length > 0 ? (
          <ul className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}

        {results ? (
          results.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Nothing matched.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {results.map((result) => (
                <li
                  key={`${result.recipe.sourceApi}-${result.recipe.externalId}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => setOpenRecipe(result)}
                    className="flex h-full w-full flex-col text-left"
                  >
                    {result.recipe.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.recipe.imageUrl}
                        alt=""
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="flex flex-1 flex-col gap-1 p-4">
                      <span className="font-medium">{result.recipe.title}</span>
                      <span className="text-sm">
                        {result.haveCount} of {result.totalCount} ingredients
                        {result.missing.length > 0
                          ? ` · missing ${result.missing.slice(0, 3).join(', ')}`
                          : ' · you have everything'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {openRecipe ? (
        <Dialog title={openRecipe.recipe.title} onDismiss={() => setOpenRecipe(null)}>
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-auto text-sm">
            <ul className="flex flex-col gap-1">
              {openRecipe.recipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient.name}-${index}`}>
                  {ingredient.raw ? `${ingredient.raw} ` : ''}
                  <span className="font-medium">{ingredient.name}</span>
                  {openRecipe.missing.includes(ingredient.name) ? (
                    <span className="ml-2 text-slate-500 dark:text-slate-400">(missing)</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">
              {openRecipe.recipe.instructions}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Marking a recipe cooked and having your inventory updated needs an account — guest
              mode keeps no history to update.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenRecipe(null)}
            className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </Dialog>
      ) : null}

      {resetting ? (
        <Dialog title="Start over?" onDismiss={() => setResetting(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This clears the fridge stored in this browser. There is no copy on the server, so it
            cannot be recovered.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                update(null);
                setOpenPanel(null);
                setResults(null);
                setResetting(false);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Clear it
            </button>
            <button
              type="button"
              onClick={() => setResetting(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Keep it
            </button>
          </div>
        </Dialog>
      ) : null}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Want this to survive a cache clear, be shared with your household, or update itself when you
        cook?{' '}
        <Link href="/register" className="underline">
          Create an account
        </Link>
        .
      </p>
    </div>
  );
}

function GuestSearch({
  onSearch,
  disabled,
}: {
  onSearch: (query: string) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) onSearch(query.trim());
      }}
      className="flex items-center gap-2"
    >
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search recipes…"
        aria-label="Search recipes"
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <button
        type="submit"
        disabled={disabled || !query.trim()}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Search
      </button>
    </form>
  );
}

function GuestCompartmentPanel({
  compartment,
  siblings,
  onSelectSibling,
  onClose,
  onAdd,
  onRemove,
}: {
  compartment: GuestCompartment;
  siblings: { id: string; label: string; itemCount: number }[];
  onSelectSibling: (compartmentId: string) => void;
  onClose: () => void;
  onAdd: (item: {
    ingredientName: string;
    quantity: number;
    unit: Unit;
    dateAdded: string;
    expirationDate: string | null;
  }) => void;
  onRemove: (itemId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<Unit>(Unit.count);
  const [expires, setExpires] = useState('');

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{compartment.label}</h2>
        <span className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {compartment.items.length === 0 ? 'Empty' : `${compartment.items.length} items`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Close {compartment.label.toLowerCase()}
          </button>
        </span>
      </header>

      {siblings.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Storage behind this door">
          {siblings.map((sibling) => {
            const active = sibling.id === compartment.id;
            return (
              <button
                key={sibling.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectSibling(sibling.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {sibling.label} <span className="opacity-70">{sibling.itemCount}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {compartment.items.map((item) => {
          const label = expiryLabel(item.expirationDate ? new Date(item.expirationDate) : null);
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="flex flex-col">
                <span>
                  <span className="font-medium">{item.ingredientName}</span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    {item.quantity} {item.unit === Unit.count ? '' : item.unit}
                  </span>
                </span>
                {label ? <span className="text-xs text-amber-700 dark:text-amber-300">{label}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(quantity);
            if (!Number.isFinite(amount) || amount <= 0 || !name.trim()) return;
            onAdd({
              ingredientName: name.trim(),
              quantity: amount,
              unit,
              dateAdded: toDateInputValue(new Date()),
              expirationDate: expires || null,
            });
            setName('');
            setQuantity('1');
            setExpires('');
            setAdding(false);
          }}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <IngredientAutocomplete value={name} onChange={setName} required />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Amount</span>
              <input
                type="number"
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Expires (optional)</span>
            <input
              type="date"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            >
              Add to compartment
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Add an item
        </button>
      )}
    </section>
  );
}
