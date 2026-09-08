'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EMPTY_SHAPE,
  FridgeShapePicker,
  shapeToRequest,
  type FridgeShape,
} from '@/components/fridge-shape-picker';
import { Dialog } from '@/components/dialog';

type Step = 'shape' | 'migrate-choice' | 'delete-understand' | 'delete-confirm';

/**
 * Replacing a fridge, per the agreed flow: describe the new fridge, then decide
 * what happens to the inventory. Choosing not to migrate is a two-step
 * confirmation — first that the user understands the items are deleted, then an
 * explicit delete — and backing out of either returns to the original choice.
 */
export function ReplaceFridgeFlow({
  fridge,
  itemCount,
}: {
  fridge: { id: string; name: string };
  itemCount: number;
}) {
  const router = useRouter();
  const [shape, setShape] = useState<FridgeShape>(EMPTY_SHAPE);
  const [step, setStep] = useState<Step>('shape');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = `${itemCount} item${itemCount === 1 ? '' : 's'}`;

  async function replace(inventory: 'migrate' | 'delete') {
    if (!shape.type) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/fridges/${fridge.id}/replace`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...shapeToRequest(shape), inventory }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not replace the fridge.');
      setSubmitting(false);
      setStep('shape');
      return;
    }

    const body = (await res.json()) as { fridge: { id: string } };
    router.replace(`/?fridge=${body.fridge.id}`);
    router.refresh();
  }

  function onContinue() {
    // Nothing to decide when the old fridge is empty.
    if (itemCount === 0) {
      void replace('delete');
      return;
    }
    setStep('migrate-choice');
  }

  return (
    <div className="flex flex-col gap-8">
      <FridgeShapePicker value={shape} onChange={setShape} />

      {shape.type ? (
        <div className="flex flex-col gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={onContinue}
            disabled={submitting}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {submitting ? 'Replacing…' : `Replace ${fridge.name}`}
          </button>
        </div>
      ) : null}

      {step === 'migrate-choice' ? (
        <Dialog title="Bring your inventory across?" onDismiss={() => setStep('shape')}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {fridge.name} still holds {items}. Would you like to move them into the new fridge?
            Items go to the matching compartment where there is one, and to the main fridge or
            freezer section otherwise.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => replace('migrate')}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              {submitting ? 'Moving…' : `Yes, move my ${items}`}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep('delete-understand')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              No, don&apos;t move them
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep('shape')}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </Dialog>
      ) : null}

      {step === 'delete-understand' ? (
        <Dialog title="Your inventory will be deleted" onDismiss={() => setStep('migrate-choice')}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            If you don&apos;t move them, all {items} in {fridge.name} are permanently deleted along
            with the fridge. This cannot be undone. Do you understand?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep('delete-confirm')}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
            >
              Yes, I understand
            </button>
            <button
              type="button"
              onClick={() => setStep('migrate-choice')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              No, take me back
            </button>
          </div>
        </Dialog>
      ) : null}

      {step === 'delete-confirm' ? (
        <Dialog title="Delete the inventory and replace?" onDismiss={() => setStep('migrate-choice')}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Last check: replacing {fridge.name} now deletes {items}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => replace('delete')}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? 'Replacing…' : `Delete ${items} and replace`}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep('migrate-choice')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
