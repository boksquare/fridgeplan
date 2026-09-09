'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ProviderOption = {
  id: string;
  label: string;
  needsApiKey: boolean;
  defaultModel: string;
};

/**
 * Self-host only. On a hosted instance the provider is whatever the operator
 * configured, so this form is not rendered at all.
 */
export function AISettingsForm({
  providers,
  active,
}: {
  providers: ProviderOption[];
  active: { id: string; model: string } | null;
}) {
  const router = useRouter();
  const [providerId, setProviderId] = useState(active?.id ?? providers[0]?.id ?? '');
  const [model, setModel] = useState(active?.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const provider = providers.find((entry) => entry.id === providerId);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/ai', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: providerId,
        model: model.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Could not save those settings.');
      setSaving(false);
      return;
    }

    setApiKey('');
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Provider</span>
        <select
          value={providerId}
          onChange={(event) => {
            setProviderId(event.target.value);
            setModel('');
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          {providers.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Model</span>
        <input
          type="text"
          value={model}
          placeholder={provider?.defaultModel ?? ''}
          onChange={(event) => setModel(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      {provider?.needsApiKey ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">API key</span>
          <input
            type="password"
            value={apiKey}
            autoComplete="off"
            placeholder={active?.id === providerId ? 'Leave blank to keep the stored key' : ''}
            onChange={(event) => setApiKey(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Stored encrypted, and never sent back to the browser.
          </span>
        </label>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {provider?.id === 'claude_code'
            ? 'Uses the `claude` CLI already signed in on this host. Nothing to paste.'
            : 'This provider needs no API key.'}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          {provider?.id === 'claude_code' ? 'CLI path (optional)' : 'Base URL (optional)'}
        </span>
        <input
          type="text"
          value={baseUrl}
          placeholder={provider?.id === 'claude_code' ? 'claude' : 'https://…'}
          onChange={(event) => setBaseUrl(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
      >
        {saving ? 'Saving…' : 'Use this provider'}
      </button>
    </form>
  );
}
