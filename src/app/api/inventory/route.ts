import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Unit } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, withUser } from '@/lib/api';
import { getAccessibleCompartment, resolveIngredient } from '@/lib/inventory';

// Dates arrive as plain YYYY-MM-DD from the date pickers and are stored at UTC
// midnight, so an expiry never shifts a day because of the viewer's timezone.
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const createSchema = z.object({
  compartmentId: z.string().min(1),
  ingredientName: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(100000),
  unit: z.nativeEnum(Unit),
  dateAdded: dateOnly.optional(),
  expirationDate: dateOnly.optional(),
});

export async function POST(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid item.');

  const compartment = await getAccessibleCompartment(parsed.data.compartmentId, user.id);
  if (!compartment) return notFound('No such compartment.');

  const ingredient = await resolveIngredient(parsed.data.ingredientName);

  const item = await prisma.inventoryItem.create({
    data: {
      compartmentId: compartment.id,
      ingredientId: ingredient.id,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      ...(parsed.data.dateAdded ? { dateAdded: parsed.data.dateAdded } : {}),
      expirationDate: parsed.data.expirationDate ?? null,
    },
    include: { ingredient: true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
