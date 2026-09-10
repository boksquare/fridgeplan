'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { expiryStatus } from '@/lib/expiry';
import { formatAmount, worstExpiry, type ClientFridge } from '@/lib/serialize';
import { Fridge3DIsland } from '@/components/fridge-3d-island';
import { CompartmentPanel } from '@/components/compartment-panel';

/**
 * The landing view: the fridge itself.
 *
 * The appliance is the interface, so it gets the middle of the screen and as
 * much height as the viewport allows. It used to sit in a narrow left column
 * beside a mostly empty right one, which made the whole page read as a sidebar
 * with nothing next to it.
 *
 * Opening a compartment is what changes the shape: the fridge steps aside into
 * a column and the contents take the space that was empty before, so the layout
 * is only ever as wide as it has something to say.
 */
export function FridgeView({
  fridge,
  otherFridges,
  totalItems,
}: {
  fridge: ClientFridge;
  otherFridges: { id: string; name: string }[];
  /** Across every fridge, since that is what the recipe matcher looks at. */
  totalItems: number;
}) {
  const router = useRouter();
  // The open door or drawer, and which of the compartments behind it is being
  // shown — a fridge door covers the shelves, its bins and the crisper.
  const [openPanel, setOpenPanel] = useState<{ id: string; compartmentIds: string[] } | null>(null);
  const [shownCompartmentId, setShownCompartmentId] = useState<string | null>(null);

  const behindDoor = (openPanel?.compartmentIds ?? [])
    .map((id) => fridge.compartments.find((compartment) => compartment.id === id))
    .filter((compartment): compartment is ClientFridge['compartments'][number] => Boolean(compartment));
  const selected =
    behindDoor.find((compartment) => compartment.id === shownCompartmentId) ?? behindDoor[0] ?? null;

  function togglePanel(panelId: string, compartmentIds: string[]) {
    setOpenPanel((current) => (current?.id === panelId ? null : { id: panelId, compartmentIds }));
    setShownCompartmentId(compartmentIds[0] ?? null);
  }

  const compartments = fridge.compartments.map((compartment) => ({
    id: compartment.id,
    type: compartment.type,
    label: compartment.label,
    position: compartment.position,
    itemCount: compartment.items.length,
    worstExpiry: worstExpiry(compartment.items),
    // What is actually on the shelves, shown once the door is open.
    itemLabels: compartment.items.map((item) => ({
      id: item.id,
      label:
        item.unit === 'count'
          ? `${item.quantity}× ${item.ingredientName}`
          : `${item.ingredientName} ${formatAmount(item.quantity, item.unit)}`,
      expiry: expiryStatus(item.expirationDate ? new Date(item.expirationDate) : null),
    })),
  }));

  const items = fridge.compartments.flatMap((compartment) => compartment.items);
  const soon = items.filter(
    (item) => expiryStatus(item.expirationDate ? new Date(item.expirationDate) : null) === 'soon',
  ).length;
  const expired = items.filter(
    (item) => expiryStatus(item.expirationDate ? new Date(item.expirationDate) : null) === 'expired',
  ).length;

  const open = Boolean(selected);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{fridge.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Stat>{items.length} item{items.length === 1 ? '' : 's'}</Stat>
            {soon > 0 ? <Stat tone="soon">{soon} to use soon</Stat> : null}
            {expired > 0 ? <Stat tone="expired">{expired} expired</Stat> : null}
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {otherFridges.map((other) => (
            <Link
              key={other.id}
              href={`/?fridge=${other.id}`}
              className="rounded-lg px-2.5 py-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {other.name}
            </Link>
          ))}
          <Link
            href="/fridges"
            className="rounded-lg border border-slate-300 bg-white/60 px-3 py-1.5 font-medium transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800"
          >
            Manage fridges
          </Link>
        </nav>
      </header>

      <div
        className={
          open
            ? 'grid items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]'
            : 'flex justify-center'
        }
      >
        <div
          className={`flex w-full flex-col gap-3 ${
            // Hero: as wide as the layout allows, but sized so the buttons
            // underneath still land above the fold. The model is 1.16 times as
            // tall as it is wide, and the 20rem is everything else stacked on
            // this page — header, title row, the caption, legend and actions
            // below it, measured rather than guessed — so the height works out
            // as whatever is left.
            open ? '' : 'max-w-[min(34rem,calc((100vh-22.5rem)/1.16))]'
          }`}
        >
          <Fridge3DIsland
            type={fridge.type}
            compartments={compartments}
            selectedId={openPanel?.id ?? null}
            onSelect={togglePanel}
          />
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Click a door or drawer on the model, or use the buttons.
          </p>

          {/* Only shown when something is actually flagged. */}
          {soon > 0 || expired > 0 ? (
            <ul className="flex flex-wrap justify-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              {soon > 0 ? (
                <li className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full border border-amber-600 bg-amber-200" />
                  Use soon (within 3 days)
                </li>
              ) : null}
              {expired > 0 ? (
                <li className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full border border-red-600 bg-red-200" />
                  Expired
                </li>
              ) : null}
            </ul>
          ) : null}

          {/* With nothing open the fridge is the whole page, so the next thing
              to do belongs directly under it rather than at the bottom. */}
          {open ? null : <RecipeActions totalItems={totalItems} />}
        </div>

        {selected ? (
          <CompartmentPanel
            compartment={selected}
            onChanged={() => router.refresh()}
            onClose={() => setOpenPanel(null)}
            siblings={behindDoor.map((compartment) => ({
              id: compartment.id,
              label: compartment.label,
              itemCount: compartment.items.length,
            }))}
            onSelectSibling={setShownCompartmentId}
            allCompartments={fridge.compartments}
          />
        ) : null}
      </div>

      {open ? <RecipeActions totalItems={totalItems} /> : null}
    </div>
  );
}

function Stat({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'soon' | 'expired';
}) {
  const styles =
    tone === 'expired'
      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
      : tone === 'soon'
        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
        : 'border-slate-300 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400';
  return <span className={`rounded-full border px-2.5 py-1 ${styles}`}>{children}</span>;
}

function RecipeActions({ totalItems }: { totalItems: number }) {
  if (totalItems === 0) {
    return (
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        Add something to a compartment and recipe suggestions appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Link
        href="/recipes/suggest"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Suggest recipes
      </Link>
      <Link
        href="/recipes/search"
        className="rounded-lg border border-slate-300 bg-white/60 px-4 py-2 text-sm font-medium transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800"
      >
        Search recipes
      </Link>
      <Link
        href="/recipes"
        className="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        Your recipes
      </Link>
    </div>
  );
}
