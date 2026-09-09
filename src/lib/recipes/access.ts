import { prisma } from '@/lib/prisma';
import type { RecipeIngredient } from '@/lib/recipes/types';

/**
 * Private recipes belong to the household, not just the person who typed them
 * in: every member of the creator's household can see and edit them. A creator
 * with no household keeps them to themselves.
 */
export async function householdIdsFor(userId: string): Promise<string[]> {
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    select: { householdId: true },
  });
  return memberships.map((membership) => membership.householdId);
}

/** The household a new private recipe should be shared with, if any. */
export async function primaryHouseholdId(userId: string): Promise<string | null> {
  const ids = await householdIdsFor(userId);
  return ids[0] ?? null;
}

export async function recipeVisibilityFilter(userId: string) {
  const households = await householdIdsFor(userId);
  return {
    OR: [
      { isPrivate: false },
      { ownerUserId: userId },
      ...(households.length > 0 ? [{ householdId: { in: households } }] : []),
    ],
  };
}

/** Private recipes the user may read and edit. */
export async function ownRecipeFilter(userId: string) {
  const households = await householdIdsFor(userId);
  return {
    isPrivate: true,
    OR: [
      { ownerUserId: userId },
      ...(households.length > 0 ? [{ householdId: { in: households } }] : []),
    ],
  };
}

export function parseIngredientsJson(value: unknown): RecipeIngredient[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Partial<RecipeIngredient>;
    if (typeof row.name !== 'string' || row.name.trim() === '') return [];
    return [
      {
        name: row.name,
        quantity: typeof row.quantity === 'number' ? row.quantity : null,
        unit: (row.unit ?? null) as RecipeIngredient['unit'],
        raw: typeof row.raw === 'string' ? row.raw : '',
      },
    ];
  });
}
