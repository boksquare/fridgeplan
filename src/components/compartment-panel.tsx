'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UNITS, type ClientCompartment, type ClientItem } from '@/lib/serialize';
import { ExpiryBadge } from '@/components/expiry-badge';
import { InventoryItemForm } from '@/components/inventory-item-form';

function unitLabel(item: ClientItem) {
  const unit = UNITS.find((entry) => entry.value === item.unit);
  if (item.unit === 'count') return `${item.quantity}×`;
  return `${item.quantity} ${unit?.label ?? item.unit}`;
}

/** What is inside the compartment you just opened, and how to change it. */
export function CompartmentPanel({
  compartment,
  onChanged,
}: {
  compartment: ClientCompartment;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mutate(item: ClientItem, action: 'consume' | 'delete') {
    setBusyId(item.id);
    setError(null);
    const res =
      action === 'delete'
        ? await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' })
        : await fetch(`/api/inventory/${item.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ consumed: true }),
          });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not update the item.');
      setBusyId(null);
      return;
    }
    setBusyId(null);
    onChanged();
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-4"
      aria-label={`Contents of ${compartment.label}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{compartment.label}</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {compartment.items.length === 0
            ? 'Empty'
            : `${compartment.items.length} item${compartment.items.length === 1 ? '' : 's'}`}
        </span>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {compartment.items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              {editingId === item.id ? (
                <InventoryItemForm
                  compartmentId={compartment.id}
                  item={item}
                  onDone={() => {
                    setEditingId(null);
                    onChanged();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.ingredientName}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {unitLabel(item)}
                      </span>
                      <ExpiryBadge
                        expirationDate={item.expirationDate ? new Date(item.expirationDate) : null}
                      />
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Added {item.dateAdded}
                      {item.expirationDate ? ` · expires ${item.expirationDate}` : ''}
                    </span>
                  </div>

                  <div className="flex shrink-0 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingId(item.id)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => mutate(item, 'consume')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Used up
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => mutate(item, 'delete')}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {adding ? (
        <InventoryItemForm
          compartmentId={compartment.id}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Add an item
        </button>
      )}
    </motion.section>
  );
}
