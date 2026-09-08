import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Unit } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, withUser } from '@/lib/api';
import { getAccessibleCompartment, getAccessibleItem, resolveIngredient } from '@/lib/inventory';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const patchSchema = z
  .object({
    ingredientName: z.string().trim().min(1).max(100).optional(),
    quantity: z.number().positive().max(100000).optional(),
    unit: z.nativeEnum(Unit).optional(),
    // Explicit null clears the date; omitting the key leaves it untouched.
    dateAdded: dateOnly.optional(),
    expirationDate: dateOnly.nullable().optional(),
    compartmentId: z.string().min(1).optional(),
    // Marks the item used up without deleting the row.
    consumed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to change.');

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid change.');

  const existing = await getAccessibleItem(id, user.id);
  if (!existing) return notFound('No such item.');

  const { ingredientName, consumed, compartmentId, ...rest } = parsed.data;

  if (compartmentId) {
    const target = await getAccessibleCompartment(compartmentId, user.id);
    if (!target) return notFound('No such compartment.');
  }

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      ...rest,
      ...(compartmentId ? { compartmentId } : {}),
      ...(ingredientName ? { ingredientId: (await resolveIngredient(ingredientName)).id } : {}),
      ...(consumed === undefined ? {} : { consumedAt: consumed ? new Date() : null }),
    },
    include: { ingredient: true },
  });

  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const existing = await getAccessibleItem(id, user.id);
  if (!existing) return notFound('No such item.');

  await prisma.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
