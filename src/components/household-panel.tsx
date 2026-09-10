'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/dialog';

type Member = {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  isYou: boolean;
};

type Invite = { id: string; code: string; expiresAt: string };

export type HouseholdData = {
  id: string;
  name: string;
  role: 'owner' | 'member';
  members: Member[];
  fridgeCount: number;
} | null;

/**
 * Creating a household, and running one once it exists.
 *
 * The invite is shown as a whole link rather than a code to type, because it is
 * going to be pasted into a message either way.
 */
export function HouseholdPanel({
  household,
  invites,
  fridgeCount,
  origin,
}: {
  household: HouseholdData;
  invites: Invite[];
  fridgeCount: number;
  origin: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function call(url: string, init?: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'That did not work.');
        return null;
      }
      router.refresh();
      return (await res.json().catch(() => ({}))) as unknown;
    } catch (caught) {
      setError((caught as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // A blocked clipboard is not worth an error: the link is on screen and
      // selectable, which is the fallback anyway.
      setCopied(null);
    }
  }

  if (!household) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-semibold">Share your fridge</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            A household is a group of people who manage the same fridges. Create one
            and you can invite the people you live with.
          </p>
        </div>

        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {fridgeCount === 0
            ? 'Any fridge you make from now on will belong to the household.'
            : `Your ${fridgeCount} fridge${fridgeCount === 1 ? '' : 's'} will move into the household, and everyone you invite will be able to see and change what is inside.`}
        </p>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            await call('/api/households', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: name.trim() }),
            });
          }}
        >
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Household name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="The Patels"
              className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {busy ? 'Creating…' : 'Create household'}
          </button>
        </form>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }

  const owner = household.role === 'owner';

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{household.name}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {household.members.length} member{household.members.length === 1 ? '' : 's'} ·{' '}
            {household.fridgeCount} fridge{household.fridgeCount === 1 ? '' : 's'} shared
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          {household.members.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.name}
                  {member.isYou ? (
                    <span className="ml-1.5 text-xs font-normal text-slate-500">you</span>
                  ) : null}
                </p>
                {/* Falls back to the email when no name is set, so only show
                    the address again when it adds something. */}
                {member.name === member.email ? null : (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {member.email}
                  </p>
                )}
              </div>

              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                {member.role}
              </span>

              {owner && !member.isYou ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      call(`/api/households/members/${member.userId}`, {
                        method: 'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          role: member.role === 'owner' ? 'member' : 'owner',
                        }),
                      })
                    }
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Make {member.role === 'owner' ? 'member' : 'owner'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      call(`/api/households/members/${member.userId}`, { method: 'DELETE' })
                    }
                    className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {owner ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-semibold">Invite someone</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Send them the link. It works once, expires in seven days, and lets whoever
              opens it see and change everything in your fridges — so send it the way you
              would a door key.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => call('/api/households/invites', { method: 'POST' })}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {busy ? 'Working…' : 'Create an invitation link'}
          </button>

          {invites.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {invites.map((invite) => {
                const link = `${origin}/join/${invite.code}`;
                return (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-800"
                  >
                    <code className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-400">
                      {link}
                    </code>
                    <span className="text-xs text-slate-500">
                      expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(link)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      {copied === link ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        call(`/api/households/invites/${invite.id}`, { method: 'DELETE' })
                      }
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No invitations waiting to be used.
            </p>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Leave</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The shared fridges stay with the household and you lose access to them. If you
          are the last one out, they come with you instead.
        </p>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="w-fit rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Leave {household.name}
        </button>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {leaving ? (
        <Dialog title={`Leave ${household.name}?`} onDismiss={() => setLeaving(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {household.members.length === 1
              ? 'You are the only member, so the household is dissolved and its fridges become yours again.'
              : `You will lose access to ${household.fridgeCount} shared fridge${household.fridgeCount === 1 ? '' : 's'}. Someone can invite you back.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const you = household.members.find((member) => member.isYou);
                if (!you) return;
                const result = await call(`/api/households/members/${you.userId}`, {
                  method: 'DELETE',
                });
                if (result) {
                  setLeaving(false);
                  router.push('/');
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
            >
              {busy ? 'Leaving…' : 'Yes, leave'}
            </button>
            <button
              type="button"
              onClick={() => setLeaving(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Stay
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
