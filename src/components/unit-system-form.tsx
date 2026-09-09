'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UnitSystem } from '@/generated/prisma/enums';

const OPTIONS: { value: UnitSystem; label: string; example: string }[] = [
  { value: UnitSystem.imperial, label: 'Imperial', example: 'ground beef in lb, milk in cups' },
  { value: UnitSystem.metric, label: 'Metric', example: 'ground beef in kg, milk in litres' },
];

/** Which way unit suggestions lean when you type an ingredient. */
export function UnitSystemForm({ current }: { current: UnitSystem }) {
  const router = useRouter();
  const [saving, setSaving] = useState<UnitSystem | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(unitSystem: UnitSystem) {
    setSaving(unitSystem);
    setError(null);
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ unitSystem }),
    });
    setSaving(null);
    if (!res.ok) {
      setError('Could not save that.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {OPTIONS.map((option) => {
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={saving !== null}
              onClick={() => choose(option.value)}
              className={`flex flex-col gap-1 rounded-xl border p-4 text-left text-sm disabled:opacity-60 ${
                active
                  ? 'border-slate-900 bg-white shadow-sm dark:border-white dark:bg-slate-900'
                  : 'border-slate-200 bg-white/60 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900/60'
              }`}
            >
              <span className="font-medium">
                {option.label}
                {active ? ' · in use' : ''}
              </span>
              <span className="text-slate-600 dark:text-slate-400">{option.example}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Suggestions only fill a unit you have not set yourself, and whatever you last used for an
        ingredient always wins.
      </p>
    </div>
  );
}
