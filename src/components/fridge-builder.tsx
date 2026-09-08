'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EMPTY_SHAPE,
  FridgeShapePicker,
  shapeToRequest,
  type FridgeShape,
} from '@/components/fridge-shape-picker';

/** First-run fridge creation and "add another fridge". */
export function FridgeBuilder({ firstFridge }: { firstFridge: boolean }) {
  const router = useRouter();
  const [shape, setShape] = useState<FridgeShape>(EMPTY_SHAPE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!shape.type) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/fridges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(shapeToRequest(shape)),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not create the fridge.');
      setSubmitting(false);
      return;
    }

    const body = (await res.json()) as { fridge: { id: string } };
    router.replace(`/?fridge=${body.fridge.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <FridgeShapePicker value={shape} onChange={setShape} />

      {shape.type ? (
        <div className="flex flex-col gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {submitting ? 'Creating…' : firstFridge ? 'Create my fridge' : 'Add this fridge'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
