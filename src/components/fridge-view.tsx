'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { worstExpiry, type ClientFridge } from '@/lib/serialize';
import { FridgeIllustration } from '@/components/fridge-illustration';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = fridge.compartments.find((compartment) => compartment.id === selectedId) ?? null;

  const compartments = fridge.compartments.map((compartment) => ({
    id: compartment.id,
    type: compartment.type,
    label: compartment.label,
    position: compartment.position,
    itemCount: compartment.items.length,
    worstExpiry: worstExpiry(compartment.items),
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <FridgeIllustration
            type={fridge.type}
            compartments={compartments}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
          />
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Pick a door or drawer to see what is inside.
          </p>
        </div>

        {selected ? (
          <CompartmentPanel compartment={selected} onChanged={() => router.refresh()} />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nothing open yet. Choose a compartment on the left to add or check items.
          </p>
        )}
      </div>
    </div>
  );
}
