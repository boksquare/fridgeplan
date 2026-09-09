import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { resolveActiveProvider, selectableProviders } from '@/lib/ai/registry';
import { AISettingsForm } from '@/components/ai-settings-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI provider — Fridgeplan' };

export default async function AISettingsPage() {
  const user = await requireUserPage();
  const mode = await getDeploymentMode();
  const active = await resolveActiveProvider(user.id);
  const providers = await selectableProviders();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to the fridge
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">AI provider</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Used for ingredient substitutions today, and anything AI-shaped later.
        </p>
      </header>

      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        {active ? (
          <>
            Currently using <span className="font-medium">{active.provider.label}</span>
            {active.config.model ? ` (${active.config.model})` : ''}.
          </>
        ) : (
          'No provider is configured yet, so substitution suggestions are unavailable.'
        )}
      </p>

      {mode === 'personal_self_host' ? (
        <AISettingsForm
          providers={providers.map((provider) => ({
            id: provider.id,
            label: provider.label,
            needsApiKey: provider.needsApiKey,
            defaultModel: provider.defaultModel,
          }))}
          active={active ? { id: active.provider.id, model: active.config.model ?? '' } : null}
        />
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This is a hosted instance, so its operator chooses the provider and model. It is set in the
          instance configuration.
        </p>
      )}
    </main>
  );
}
