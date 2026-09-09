import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { getCurrentUser } from '@/lib/current-user';
import { GuestFridgeIsland } from '@/components/guest-fridge-island';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Try it without an account — Fridgeplan' };

export default async function GuestPage() {
  const mode = await getDeploymentMode();
  if (!mode) redirect('/setup');
  // Self-host has no accounts to opt out of, and a signed-in user has the real
  // thing — neither needs the browser-only version.
  if (mode === 'personal_self_host') redirect('/');
  if (await getCurrentUser()) redirect('/');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Your fridge, in this browser</h1>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Guest mode keeps everything on this device and sends nothing to the server to keep. Clear
          your browser data and it is gone, and it cannot be shared with anyone. Recipe lookups go
          through the server without being stored.{' '}
          <Link href="/register" className="font-medium underline">
            Create an account
          </Link>{' '}
          to keep a fridge, share it with your household, and have cooking update your inventory.
        </p>
        <Link
          href="/signin"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          Already have an account? Sign in
        </Link>
      </header>

      <GuestFridgeIsland />
    </main>
  );
}
