import { redirect } from 'next/navigation';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { SetupWizard } from '@/components/setup-wizard';

// Every page here branches on the DeploymentMode row, so nothing may be
// prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'First-run setup — Fridgeplan' };

/**
 * Deploy-time setup, not per end-user onboarding: whoever brings the instance
 * up picks its mode once, and it is written to the DeploymentMode singleton.
 */
export default async function SetupPage() {
  if (await getDeploymentMode()) redirect('/');
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">First-run setup</p>
        <h1 className="text-3xl font-semibold tracking-tight">How is this instance being used?</h1>
        <p className="text-slate-600 dark:text-slate-400">
          You only answer this once, when the instance comes up. It decides whether accounts are
          required and who controls the AI provider settings.
        </p>
      </header>
      <SetupWizard />
    </main>
  );
}
