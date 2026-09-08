import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user';
import { getDeploymentMode } from '@/lib/deployment-mode';
import type { User } from '@/generated/prisma/client';

/**
 * Every fridge page needs a set-up instance and an acting user. A guest in
 * public hosted mode is sent to sign in — client-only guest persistence is
 * still an open product question, so there is nothing to show them yet.
 */
export async function requireUserPage(): Promise<User> {
  if (!(await getDeploymentMode())) redirect('/setup');
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  return user;
}
