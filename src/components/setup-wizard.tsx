'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'personal_self_host' | 'public_hosted';

const OPTIONS: { mode: Mode; title: string; points: string[] }[] = [
  {
    mode: 'personal_self_host',
    title: 'Personal self-host',
    points: [
      'No login — a single implicit user, upgradeable to accounts later',
      'You choose and change the AI provider yourself in settings',
    ],
  },
  {
    mode: 'public_hosted',
    title: 'Public hosted',
    points: [
      'Visitors sign in with email and password; households can share a fridge',
      'AI provider is locked to whatever this instance is configured with',
    ],
  },
];

export function SetupWizard() {
  const router = useRouter();
  const [selected, setSelected] = useState<Mode>('personal_self_host');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: selected }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not save the deployment mode.');
      setSubmitting(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const active = selected === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setSelected(option.mode)}
              aria-pressed={active}
              className={`flex flex-col gap-3 rounded-xl border p-5 text-left transition ${
                active
                  ? 'border-slate-900 bg-white shadow-sm dark:border-white dark:bg-slate-900'
                  : 'border-slate-200 bg-white/60 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900/60'
              }`}
            >
              <span className="font-medium">{option.title}</span>
              <ul className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
                {option.points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
      >
        {submitting ? 'Saving…' : 'Finish setup'}
      </button>
    </div>
  );
}
