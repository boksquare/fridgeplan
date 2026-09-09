import { prisma } from '@/lib/prisma';
import { fridgeAccessFilter } from '@/lib/fridges';
import type { InventoryEntry } from '@/lib/recipes/matching';

/** Everything currently in every fridge the user can reach. */
export async function loadInventory(userId: string): Promise<InventoryEntry[]> {
  const items = await prisma.inventoryItem.findMany({
    where: { consumedAt: null, compartment: { fridge: fridgeAccessFilter(userId) } },
    include: {
      ingredient: true,
      compartment: { include: { fridge: { select: { name: true } } } },
    },
  });

  return items.map((item) => ({
    itemId: item.id,
    ingredientId: item.ingredientId,
    ingredientName: item.ingredient.name,
    aliases: item.ingredient.aliases,
    quantity: Number(item.quantity.toString()),
    unit: item.unit,
    compartmentLabel: item.compartment.label,
    fridgeName: item.compartment.fridge.name,
  }));
}
