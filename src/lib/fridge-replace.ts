import { CompartmentType } from '@/generated/prisma/enums';
import type { FridgeType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { generateCompartments, normalizeConfig } from '@/lib/fridge-config';
import type { FridgeConfig } from '@/lib/fridge-config';
import { isFreezerCompartment } from '@/lib/fridge-layout';

type Compartmentish = { id: string; type: CompartmentType; position: number };

/**
 * Where each of the old fridge's compartments should land in the new one.
 *
 * Same type, same order first ("middle drawer 2" → "middle drawer 2"); if the
 * new fridge has fewer of that type, everything extra lands in the last one of
 * that type, so nothing is silently dropped. With no matching type at all,
 * frozen food stays frozen and everything else goes to the main fridge
 * compartment.
 */
export function mapCompartments<T extends Compartmentish, U extends Compartmentish>(
  from: T[],
  to: U[],
): Map<string, string> {
  const ordered = [...to].sort((a, b) => a.position - b.position);
  const byType = new Map<CompartmentType, U[]>();
  for (const compartment of ordered) {
    const bucket = byType.get(compartment.type) ?? [];
    bucket.push(compartment);
    byType.set(compartment.type, bucket);
  }

  const fallbackFrozen =
    byType.get(CompartmentType.freezer)?.[0] ?? byType.get(CompartmentType.freezer_door)?.[0];
  const fallbackFresh =
    byType.get(CompartmentType.fridge_main)?.[0] ?? byType.get(CompartmentType.fridge_door)?.[0];

  const seenOfType = new Map<CompartmentType, number>();
  const mapping = new Map<string, string>();

  for (const source of [...from].sort((a, b) => a.position - b.position)) {
    const index = seenOfType.get(source.type) ?? 0;
    seenOfType.set(source.type, index + 1);

    const sameType = byType.get(source.type);
    const target =
      sameType?.[Math.min(index, sameType.length - 1)] ??
      (isFreezerCompartment(source.type)
        ? (fallbackFrozen ?? fallbackFresh)
        : (fallbackFresh ?? fallbackFrozen)) ??
      ordered[0];

    if (target) mapping.set(source.id, target.id);
  }

  return mapping;
}

export type ReplaceInventoryChoice = 'migrate' | 'delete';

/**
 * Replaces a fridge: the new one is created, the old one's inventory is either
 * moved across or deleted with it, and the old fridge goes away. All of it in
 * one transaction, so a failure never leaves two fridges or orphaned items.
 */
export async function replaceFridge(input: {
  userId: string;
  oldFridgeId: string;
  name: string;
  type: FridgeType;
  config: FridgeConfig;
  inventory: ReplaceInventoryChoice;
}) {
  const config = normalizeConfig(input.type, input.config);
  const newCompartments = generateCompartments(input.type, config);

  return prisma.$transaction(async (tx) => {
    const oldFridge = await tx.fridge.findUnique({
      where: { id: input.oldFridgeId },
      include: { compartments: true },
    });
    if (!oldFridge) throw new Error('The fridge being replaced no longer exists.');

    const created = await tx.fridge.create({
      data: {
        ownerUserId: oldFridge.ownerUserId,
        householdId: oldFridge.householdId,
        name: input.name,
        type: input.type,
        config,
        compartments: { create: newCompartments },
      },
      include: { compartments: true },
    });

    let migratedItems = 0;
    if (input.inventory === 'migrate') {
      const mapping = mapCompartments(oldFridge.compartments, created.compartments);
      for (const [oldCompartmentId, newCompartmentId] of mapping) {
        const moved = await tx.inventoryItem.updateMany({
          where: { compartmentId: oldCompartmentId },
          data: { compartmentId: newCompartmentId },
        });
        migratedItems += moved.count;
      }
    }

    // Whatever was not migrated cascades away with the old compartments.
    await tx.fridge.delete({ where: { id: oldFridge.id } });

    return { fridge: created, migratedItems };
  });
}
