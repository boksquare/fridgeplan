'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * What the rest of a household sees instead of your email address.
 *
 * Optional on purpose: everywhere a name is shown falls back to the email, so
 * leaving it blank costs nothing but privacy in a shared list.
 */
export function DisplayNameForm({ current, email }: { current: string | null; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(current ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== (current ?? '');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not save that.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Display name</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            maxLength={80}
            placeholder={email}
            autoComplete="name"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !dirty}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {name.trim()
          ? `Household members see “${name.trim()}”.`
          : `Leave it blank and household members see ${email}.`}
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !error ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
      ) : null}
    </form>
  );
}
