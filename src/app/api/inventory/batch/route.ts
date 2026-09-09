import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Unit } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, withUser } from '@/lib/api';
import { getAccessibleCompartment, resolveIngredient } from '@/lib/inventory';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        compartmentId: z.string().min(1),
        ingredientName: z.string().trim().min(1).max(100),
        quantity: z.number().positive().max(100000),
        unit: z.nativeEnum(Unit),
        expirationDate: dateOnly.optional(),
      }),
    )
    .min(1, 'Pick at least one line to add.')
    .max(60, 'That is more than 60 lines; add them in two goes.'),
});

/**
 * Adds several items at once — what confirming a scanned receipt does. All or
 * nothing, so a bad line cannot leave half a receipt in the fridge.
 */
export async function POST(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid items.');

  // Check every compartment before writing anything.
  const compartmentIds = [...new Set(parsed.data.items.map((item) => item.compartmentId))];
  for (const compartmentId of compartmentIds) {
    if (!(await getAccessibleCompartment(compartmentId, user.id))) {
      return notFound('No such compartment.');
    }
  }

  const resolved = await Promise.all(
    parsed.data.items.map(async (item) => ({
      item,
      ingredientId: (await resolveIngredient(item.ingredientName)).id,
    })),
  );

  const created = await prisma.$transaction(
    resolved.map(({ item, ingredientId }) =>
      prisma.inventoryItem.create({
        data: {
          compartmentId: item.compartmentId,
          ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          expirationDate: item.expirationDate ?? null,
        },
      }),
    ),
  );

  return NextResponse.json({ added: created.length }, { status: 201 });
}
