import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUserPage } from '@/lib/page-guards';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { getHouseholdFor, listOpenInvites } from '@/lib/households';
import { listFridges } from '@/lib/fridges';
import { HouseholdPanel } from '@/components/household-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Household — Fridgeplan' };

export default async function HouseholdPage() {
  const user = await requireUserPage();

  // Personal self-host has a single implicit user, so there is nobody to share
  // with and no account to share as.
  if ((await getDeploymentMode()) !== 'public_hosted') redirect('/settings');

  const household = await getHouseholdFor(user.id);
  const invites = household ? await listOpenInvites(household.id) : [];
  const fridges = await listFridges(user.id);

  // Invite links have to be absolute to be pasted into a message, and the app
  // does not otherwise know its own public URL.
  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/settings"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Household</h1>
      </header>

      <HouseholdPanel
        household={household}
        invites={invites.map((invite) => ({
          id: invite.id,
          code: invite.code,
          expiresAt: invite.expiresAt.toISOString(),
        }))}
        fridgeCount={fridges.length}
        origin={`${proto}://${host}`}
      />
    </main>
  );
}
