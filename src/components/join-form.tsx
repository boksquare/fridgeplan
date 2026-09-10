'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Accepting an invitation, which is a POST rather than a link so it cannot be
 *  consumed by a link preview or a prefetch. */
export function JoinForm({ code, householdName }: { code: string; householdName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const res = await fetch('/api/households/join', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ code }),
            });
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as { error?: string } | null;
              setError(body?.error ?? 'Could not join.');
              setBusy(false);
              return;
            }
            router.push('/');
            router.refresh();
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {busy ? 'Joining…' : `Join ${householdName}`}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Not now
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
