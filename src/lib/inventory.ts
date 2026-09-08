import { prisma } from '@/lib/prisma';
import { fridgeAccessFilter } from '@/lib/fridges';

/**
 * Resolves a free-text ingredient name to a dictionary row, creating it when
 * the user types something new. Names are matched case-insensitively so the
 * dictionary does not sprout "Milk"/"milk" duplicates.
 */
export async function resolveIngredient(rawName: string) {
  const name = rawName.trim();
  const existing = await prisma.ingredient.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing;

  try {
    return await prisma.ingredient.create({ data: { name } });
  } catch {
    // Lost a race against a concurrent insert of the same name.
    const raced = await prisma.ingredient.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (raced) return raced;
    throw new Error(`Could not resolve ingredient "${name}".`);
  }
}

/** A compartment the user is allowed to put things in, or null. */
export async function getAccessibleCompartment(compartmentId: string, userId: string) {
  return prisma.compartment.findFirst({
    where: { id: compartmentId, fridge: fridgeAccessFilter(userId) },
  });
}

export async function getAccessibleItem(itemId: string, userId: string) {
  return prisma.inventoryItem.findFirst({
    where: { id: itemId, compartment: { fridge: fridgeAccessFilter(userId) } },
  });
}
