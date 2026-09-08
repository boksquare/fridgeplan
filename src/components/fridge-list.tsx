'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FridgeType } from '@/generated/prisma/enums';
import { defaultFridgeName } from '@/lib/fridge-config';
import { Dialog } from '@/components/dialog';

type FridgeSummary = {
  id: string;
  name: string;
  type: FridgeType;
  compartmentCount: number;
  itemCount: number;
};

export function FridgeList({ fridges }: { fridges: FridgeSummary[] }) {
  const router = useRouter();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [deleting, setDeleting] = useState<FridgeSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(fridge: FridgeSummary) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/fridges/${fridge.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: draftName.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not rename the fridge.');
      return;
    }
    setRenamingId(null);
    router.refresh();
  }

  async function remove(fridge: FridgeSummary) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/fridges/${fridge.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not delete the fridge.');
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="flex flex-col gap-3">
        {fridges.map((fridge) => (
          <li
            key={fridge.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            {renamingId === fridge.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={draftName}
                  maxLength={60}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  disabled={busy || draftName.trim().length === 0}
                  onClick={() => rename(fridge)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link href={`/?fridge=${fridge.id}`} className="font-medium hover:underline">
                  {fridge.name}
                </Link>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {defaultFridgeName(fridge.type)} · {fridge.compartmentCount} compartments ·{' '}
                  {fridge.itemCount} item{fridge.itemCount === 1 ? '' : 's'}
                </span>
              </div>
            )}

            <div className="flex shrink-0 flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRenamingId(fridge.id);
                  setDraftName(fridge.name);
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Rename
              </button>
              <Link
                href={`/fridges/${fridge.id}/replace`}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Replace
              </Link>
              <button
                type="button"
                onClick={() => setDeleting(fridge)}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {deleting ? (
        <Dialog title={`Delete ${deleting.name}?`} onDismiss={() => setDeleting(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {deleting.itemCount === 0
              ? 'This fridge is empty, so only the fridge and its compartments go away.'
              : `Deleting this fridge also permanently deletes the ${deleting.itemCount} item${
                  deleting.itemCount === 1 ? '' : 's'
                } inside it. To keep them, replace the fridge instead and choose to move your inventory across.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(deleting)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Delete fridge'}
            </button>
            {deleting.itemCount > 0 ? (
              <Link
                href={`/fridges/${deleting.id}/replace`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Replace instead
              </Link>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeleting(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
