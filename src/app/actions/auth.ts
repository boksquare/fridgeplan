'use server';

import { redirect } from 'next/navigation';
import { signOut } from '@/auth';

/**
 * Signing out, as a server action so the control is a plain form button that
 * works without client JavaScript.
 *
 * Auth.js resolves its own `redirectTo` against the origin it was configured
 * with (AUTH_URL / NEXTAUTH_URL), not the origin the request actually came in
 * on. An instance whose configured URL does not match where it is served — the
 * default in docker-compose was `http://localhost:3000` — would therefore send
 * everyone signing out to a host that does not exist for them.
 *
 * So the sign-out and the redirect are separated: Auth.js clears the session,
 * and Next issues a same-origin relative redirect, which is correct on whatever
 * host served the request and needs no configuration to be right.
 *
 * Only reachable on a hosted instance: personal self-host has no login to end.
 */
export async function signOutAction() {
  await signOut({ redirect: false });
  // Throws the NEXT_REDIRECT sentinel, so it must not sit inside a try/catch.
  redirect('/signin');
}
