import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Unit } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, withUser } from '@/lib/api';
import { ownRecipeFilter } from '@/lib/recipes/access';
import { getRecipeWithMatch } from '@/lib/recipes/service';

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(100000).nullable().optional(),
  unit: z.nativeEnum(Unit).nullable().optional(),
  raw: z.string().max(200).optional(),
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  cuisine: z.string().trim().max(60).nullable().optional(),
  instructions: z.string().trim().max(20000).optional(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const found = await getRecipeWithMatch(user.id, id);
  if (!found) return notFound('No such recipe.');

  return NextResponse.json({
    recipe: found.recipe,
    match: found.match,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid change.');

  // Only private recipes of the user's household are editable — cached
  // provider recipes are not ours to change.
  const existing = await prisma.recipe.findFirst({
    where: { AND: [{ id }, await ownRecipeFilter(user.id)] },
  });
  if (!existing) return notFound('No such recipe.');

  const recipe = await prisma.recipe.update({
    where: { id },
    data: {
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.cuisine === undefined ? {} : { cuisine: parsed.data.cuisine || null }),
      ...(parsed.data.instructions === undefined ? {} : { instructions: parsed.data.instructions }),
      ...(parsed.data.ingredients
        ? {
            ingredients: parsed.data.ingredients.map((ingredient) => ({
              name: ingredient.name,
              quantity: ingredient.quantity ?? null,
              unit: ingredient.unit ?? null,
              raw: ingredient.raw ?? '',
            })),
          }
        : {}),
    },
  });

  return NextResponse.json({ recipe: { id: recipe.id, title: recipe.title } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const existing = await prisma.recipe.findFirst({
    where: { AND: [{ id }, await ownRecipeFilter(user.id)] },
  });
  if (!existing) return notFound('No such recipe.');

  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
