import { prisma } from '@/lib/prisma';
import { convertAmount } from '@/lib/recipes/units';
import { getAccessibleItem } from '@/lib/inventory';
import type { Unit } from '@/generated/prisma/enums';

/**
 * Cook confirmation (plan §6). The user is always asked what was actually used
 * before anything is decremented — the app proposes a line per recipe
 * ingredient it could match, and the user edits or drops lines before
 * confirming. Nothing is guessed: where units do not line up cleanly the
 * proposal is left blank for the user to fill in.
 *
 * Unit-aware reconciliation (recipe wants 2 cups of flour, the fridge holds a
 * bag) stays deliberately out of scope.
 */

export type CookLine = { itemId: string; quantity: number; unit: Unit };

export type CookResult = {
  decremented: { itemId: string; ingredientName: string; used: number; unit: Unit; remaining: number }[];
  usedUp: string[];
};

/**
 * Applies the confirmed lines: each item loses what the user said was used, and
 * anything that reaches zero is marked used up rather than deleted, so cook
 * history survives.
 */
export async function applyCook(userId: string, lines: CookLine[]): Promise<CookResult> {
  const result: CookResult = { decremented: [], usedUp: [] };

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const item = await getAccessibleItem(line.itemId, userId);
      if (!item) throw new Error('One of those items is not in your fridges any more.');

      const stocked = Number(item.quantity.toString());
      const used = convertAmount(line.quantity, line.unit, item.unit);
      if (used === null) {
        throw new Error(
          `Cannot convert ${line.unit} into ${item.unit} — confirm the amount in ${item.unit}.`,
        );
      }

      const remaining = Number(Math.max(0, stocked - used).toFixed(3));
      const ingredient = await tx.ingredient.findUnique({ where: { id: item.ingredientId } });

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: remaining,
          ...(remaining === 0 ? { consumedAt: new Date() } : {}),
        },
      });

      result.decremented.push({
        itemId: item.id,
        ingredientName: ingredient?.name ?? 'Item',
        used,
        unit: item.unit,
        remaining,
      });
      if (remaining === 0) result.usedUp.push(item.id);
    }
  });

  return result;
}
