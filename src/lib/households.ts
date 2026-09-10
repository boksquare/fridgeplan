import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { HouseholdRole } from '@/generated/prisma/enums';

/**
 * Households: how two people end up managing the same fridge.
 *
 * A fridge belongs either to one user or to a household, so sharing is a matter
 * of moving it into one. Creating a household therefore moves the creator's
 * fridges across — sharing nothing would make the household pointless — and the
 * UI says so before you press the button.
 *
 * Invitations are unguessable links rather than emails, because the app sends
 * no mail. That makes each link a bearer token: whoever opens it can read and
 * change everything in the household's fridges. Hence single-use, seven-day
 * expiry, and revocable.
 */
export const INVITE_TTL_DAYS = 7;

/** How many bytes of randomness back an invite code. */
const CODE_BYTES = 24;

export type HouseholdSummary = {
  id: string;
  name: string;
  role: HouseholdRole;
  members: {
    userId: string;
    name: string;
    email: string;
    role: HouseholdRole;
    joinedAt: Date;
    isYou: boolean;
  }[];
  fridgeCount: number;
};

/** The household this user belongs to, or null. */
export async function getHouseholdFor(userId: string): Promise<HouseholdSummary | null> {
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    include: {
      household: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { joinedAt: 'asc' },
          },
          _count: { select: { fridges: true } },
        },
      },
    },
  });
  if (!membership) return null;

  const { household } = membership;
  return {
    id: household.id,
    name: household.name,
    role: membership.role,
    fridgeCount: household._count.fridges,
    members: household.members.map((member) => ({
      userId: member.userId,
      name: member.user.name ?? member.user.email,
      email: member.user.email,
      role: member.role,
      joinedAt: member.joinedAt,
      isYou: member.userId === userId,
    })),
  };
}

/**
 * Creates a household and moves the creator's own fridges into it.
 *
 * One household per user for now: the access filter and every "your fridges"
 * query assume a single membership, and letting someone join a second one would
 * silently mix two homes' inventories into one list.
 */
export async function createHousehold(userId: string, name: string) {
  const existing = await prisma.householdMember.findFirst({ where: { userId } });
  if (existing) throw new Error('You are already in a household.');

  return prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        name,
        members: { create: { userId, role: 'owner' } },
      },
    });

    // The point of a household is shared fridges, so the creator's come with
    // them. Ownership moves rather than being copied: a fridge is owned by the
    // household or by a user, never both.
    await tx.fridge.updateMany({
      where: { ownerUserId: userId },
      data: { householdId: household.id, ownerUserId: null },
    });

    return household;
  });
}

export async function createInvite(householdId: string, createdById: string) {
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return prisma.householdInvite.create({
    data: {
      householdId,
      createdById,
      code: randomBytes(CODE_BYTES).toString('base64url'),
      expiresAt,
    },
  });
}

/** Invites still worth showing: not used, not revoked, not expired. */
export async function listOpenInvites(householdId: string) {
  return prisma.householdInvite.findMany({
    where: {
      householdId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeInvite(inviteId: string, householdId: string) {
  // Scoped by household so an id from elsewhere cannot revoke someone's invite.
  const result = await prisma.householdInvite.updateMany({
    where: { id: inviteId, householdId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export type InviteProblem =
  | 'unknown'
  | 'revoked'
  | 'expired'
  | 'used'
  | 'already-in-a-household'
  | 'own-household';

/**
 * Looks an invite up without consuming it, so the join page can say who invited
 * whom before anyone commits to anything.
 */
export async function inspectInvite(code: string, userId: string) {
  const invite = await prisma.householdInvite.findUnique({
    where: { code },
    include: {
      household: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!invite) return { invite: null, problem: 'unknown' as InviteProblem };
  if (invite.revokedAt) return { invite, problem: 'revoked' as InviteProblem };
  if (invite.acceptedAt) return { invite, problem: 'used' as InviteProblem };
  if (invite.expiresAt <= new Date()) return { invite, problem: 'expired' as InviteProblem };

  const membership = await prisma.householdMember.findFirst({ where: { userId } });
  if (membership) {
    return {
      invite,
      problem: (membership.householdId === invite.householdId
        ? 'own-household'
        : 'already-in-a-household') as InviteProblem,
    };
  }

  return { invite, problem: null };
}

/**
 * Redeems an invite, moving the joiner's own fridges into the household too.
 *
 * The claim is a conditional update rather than a check followed by a write, so
 * two people opening the same link at once cannot both get in: whoever's UPDATE
 * matches first leaves nothing for the second to match.
 */
export async function acceptInvite(code: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.householdInvite.updateMany({
      where: {
        code,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { acceptedAt: new Date(), acceptedById: userId },
    });
    if (claimed.count === 0) throw new Error('That invitation is no longer valid.');

    const invite = await tx.householdInvite.findUniqueOrThrow({ where: { code } });

    await tx.householdMember.create({
      data: { userId, householdId: invite.householdId, role: 'member' },
    });

    // Whatever they already had comes with them, the same as for the creator.
    await tx.fridge.updateMany({
      where: { ownerUserId: userId },
      data: { householdId: invite.householdId, ownerUserId: null },
    });

    return invite;
  });
}

/**
 * Removes a member, handing their shared fridges back only if the household is
 * being emptied.
 *
 * A departing member's fridges stay with the household: they were moved in on
 * joining and other members have been filling them since. Working out which
 * ones "belong" to whom is not something the data can answer, so nothing is
 * split up — except for the last member out, who takes everything, because
 * otherwise the fridges would belong to a household with nobody in it.
 */
export async function removeMember(householdId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const members = await tx.householdMember.findMany({ where: { householdId } });
    const leaving = members.find((member) => member.userId === userId);
    if (!leaving) throw new Error('They are not in this household.');

    const owners = members.filter((member) => member.role === 'owner');
    if (leaving.role === 'owner' && owners.length === 1 && members.length > 1) {
      throw new Error(
        'You are the only owner. Make someone else an owner before leaving.',
      );
    }

    await tx.householdMember.delete({ where: { id: leaving.id } });

    if (members.length === 1) {
      await tx.fridge.updateMany({
        where: { householdId },
        data: { ownerUserId: userId, householdId: null },
      });
      await tx.household.delete({ where: { id: householdId } });
    }
  });
}

export async function setMemberRole(
  householdId: string,
  userId: string,
  role: HouseholdRole,
) {
  const result = await prisma.householdMember.updateMany({
    where: { householdId, userId },
    data: { role },
  });
  return result.count > 0;
}

/** Is this user an owner of this household? */
export async function isOwner(householdId: string, userId: string) {
  const member = await prisma.householdMember.findFirst({
    where: { householdId, userId, role: 'owner' },
  });
  return Boolean(member);
}
