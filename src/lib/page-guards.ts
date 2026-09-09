import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user';
import { getDeploymentMode } from '@/lib/deployment-mode';
import type { User } from '@/generated/prisma/client';

/**
 * Every fridge page needs a set-up instance and an acting user. On a hosted
 * instance a visitor without an account is sent to guest mode, which keeps its
 * fridge in their browser, rather than to a sign-in wall.
 */
export async function requireUserPage(): Promise<User> {
  if (!(await getDeploymentMode())) redirect('/setup');
  const user = await getCurrentUser();
  if (!user) redirect('/guest');
  return user;
}
