'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { expiryStatus } from '@/lib/expiry';
import { formatAmount, worstExpiry, type ClientFridge } from '@/lib/serialize';
import { Fridge3DIsland } from '@/components/fridge-3d-island';
import { CompartmentPanel } from '@/components/compartment-panel';

/**
 * The landing view: the fridge itself. Picking a compartment opens it and
 * reveals what is inside.
 */
export function FridgeView({ fridge, otherFridges }: {
  fridge: ClientFridge;
  otherFridges: { id: string; name: string }[];
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

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{fridge.name}</h1>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          {otherFridges.map((other) => (
            <Link
              key={other.id}
              href={`/?fridge=${other.id}`}
              className="text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              {other.name}
            </Link>
          ))}
          <Link
            href="/fridges"
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Manage fridges
          </Link>
        </nav>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Fridge3DIsland
            type={fridge.type}
            compartments={compartments}
            selectedId={openPanel?.id ?? null}
            onSelect={togglePanel}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click a door or drawer on the model, or use the buttons.
          </p>

          {/* Only shown when something is actually flagged. */}
          {compartments.some((compartment) => compartment.worstExpiry === 'soon') ||
          compartments.some((compartment) => compartment.worstExpiry === 'expired') ? (
            <ul className="flex flex-wrap justify-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full border border-amber-600 bg-amber-200" />
                Use soon (within 3 days)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full border border-red-600 bg-red-200" />
                Expired
              </li>
            </ul>
          ) : null}
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
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nothing open yet. Choose a compartment on the left to add or check items.
          </p>
        )}
      </div>
    </div>
  );
}
