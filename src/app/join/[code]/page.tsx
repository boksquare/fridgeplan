import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { inspectInvite, type InviteProblem } from '@/lib/households';
import { JoinForm } from '@/components/join-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Join a household — Fridgeplan' };

const REASONS: Record<InviteProblem, string> = {
  unknown: 'That invitation link is not one we recognise. Ask for a fresh one.',
  revoked: 'That invitation was cancelled. Ask for a fresh one.',
  expired: 'That invitation has expired. Ask for a fresh one.',
  used: 'That invitation has already been used. Each one works once, so ask for a fresh one.',
  'already-in-a-household':
    'You are already in a household. Leave it first, from Settings → Household.',
  'own-household': 'You are already a member of this household.',
};

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (!(await getDeploymentMode())) redirect('/setup');

  const { code } = await params;
  const user = await getCurrentUser();

  // Signing in has to come first: joining attaches the household to an account.
  // The link is carried through so it still works on the way back.
  if (!user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/join/${code}`)}`);
  }

  const { invite, problem } = await inspectInvite(code, user.id);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Join a household</h1>

      {problem || !invite ? (
        <>
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            {REASONS[problem ?? 'unknown']}
          </p>
          <Link
            href="/"
            className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Back to your fridge
          </Link>
        </>
      ) : (
        <>
          <p className="text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-white">
              {invite.createdBy.name ?? invite.createdBy.email}
            </span>{' '}
            invited you to <span className="font-medium">{invite.household.name}</span>. Joining
            lets you see and change everything in their fridges, and any fridge of your own
            comes with you into the household.
          </p>

          <JoinForm code={code} householdName={invite.household.name} />
        </>
      )}
    </main>
  );
}
