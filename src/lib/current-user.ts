import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getDeploymentMode } from '@/lib/deployment-mode';
import type { User } from '@/generated/prisma/client';

export const IMPLICIT_USER_EMAIL = 'local@fridgeplan.localhost';

/**
 * In personal self-host mode there is no login: one implicit User row backs
 * everything, created on first use. It is an ordinary row, so such an instance
 * can later grow real accounts and households without a migration.
 */
async function getOrCreateImplicitUser(): Promise<User> {
  return prisma.user.upsert({
    where: { email: IMPLICIT_USER_EMAIL },
    update: {},
    create: { email: IMPLICIT_USER_EMAIL, name: 'You' },
  });
}

/**
 * The acting user, or null when nobody is acting (public hosted mode with no
 * session — i.e. a guest). Guest-mode persistence is deliberately not decided
 * yet (plan §8), so callers must handle null rather than assume a user.
 */
export async function getCurrentUser(): Promise<User | null> {
  const mode = await getDeploymentMode();
  if (mode === 'personal_self_host') return getOrCreateImplicitUser();

  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}
