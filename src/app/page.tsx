import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { getCurrentUser } from '@/lib/current-user';

// Every page here branches on the DeploymentMode row, so nothing may be
// prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const mode = await getDeploymentMode();
  if (!mode) redirect('/setup');

  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Fridgeplan</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Your fridge is the interface. Phase 0 scaffold — fridge selection and inventory land in
          Phase 1.
        </p>
      </header>

      <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Deployment mode</dt>
          <dd className="font-medium">{mode.replace(/_/g, ' ')}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Signed in as</dt>
          <dd className="font-medium">{user ? user.email : 'guest (not signed in)'}</dd>
        </div>
      </dl>

      {mode === 'public_hosted' && !user ? (
        <Link
          href="/signin"
          className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Sign in
        </Link>
      ) : null}
    </main>
  );
}
