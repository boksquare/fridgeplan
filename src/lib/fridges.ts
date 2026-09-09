import { prisma } from '@/lib/prisma';
import { generateCompartments, normalizeConfig } from '@/lib/fridge-config';
import type { FridgeConfig } from '@/lib/fridge-config';
import type { FridgeType } from '@/generated/prisma/enums';

/**
 * A fridge is reachable by a user either directly (ownerUserId) or through a
 * household they belong to. Every query goes through this filter so the two
 * ownership paths can never be forgotten at a call site.
 */
export function fridgeAccessFilter(userId: string) {
  return {
    OR: [{ ownerUserId: userId }, { household: { members: { some: { userId } } } }],
  };
}

export async function listFridges(userId: string) {
  return prisma.fridge.findMany({
    where: fridgeAccessFilter(userId),
    orderBy: { createdAt: 'asc' },
    include: {
      compartments: {
        orderBy: { position: 'asc' },
        include: {
          _count: { select: { items: { where: { consumedAt: null } } } },
        },
      },
    },
  });
}

export async function getFridgeForUser(fridgeId: string, userId: string) {
  return prisma.fridge.findFirst({
    where: { id: fridgeId, ...fridgeAccessFilter(userId) },
    include: {
      compartments: {
        orderBy: { position: 'asc' },
        include: {
          items: {
            where: { consumedAt: null },
            orderBy: [{ expirationDate: { sort: 'asc', nulls: 'last' } }, { dateAdded: 'asc' }],
            include: { ingredient: true },
          },
        },
      },
    },
  });
}

export async function createFridgeForUser(input: {
  userId: string;
  name: string;
  type: FridgeType;
  config: FridgeConfig;
}) {
  const config = normalizeConfig(input.type, input.config);
  const compartments = generateCompartments(input.type, config);

  return prisma.fridge.create({
    data: {
      ownerUserId: input.userId,
      name: input.name,
      type: input.type,
      config,
      compartments: { create: compartments },
    },
    include: { compartments: { orderBy: { position: 'asc' } } },
  });
}

/** Items across every fridge the user can reach — what recipe matching sees. */
export async function countAccessibleItems(userId: string) {
  return prisma.inventoryItem.count({
    where: { consumedAt: null, compartment: { fridge: fridgeAccessFilter(userId) } },
  });
}

/** Items still in a fridge, so a delete confirmation can say what is at stake. */
export async function countItemsInFridge(fridgeId: string) {
  return prisma.inventoryItem.count({
    where: { consumedAt: null, compartment: { fridgeId } },
  });
}
