'use server';

import { signOut } from '@/auth';

/**
 * Signing out, as a server action so the control is a plain form button that
 * works without client JavaScript.
 *
 * Only reachable on a hosted instance: personal self-host has no login to end.
 */
export async function signOutAction() {
  await signOut({ redirectTo: '/signin' });
}
