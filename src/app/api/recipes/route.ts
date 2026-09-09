import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Unit } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, withUser } from '@/lib/api';
import { ownRecipeFilter, primaryHouseholdId } from '@/lib/recipes/access';

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(100000).nullable().optional(),
  unit: z.nativeEnum(Unit).nullable().optional(),
  raw: z.string().max(200).optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  cuisine: z.string().trim().max(60).optional(),
  instructions: z.string().trim().max(20000).default(''),
  ingredients: z.array(ingredientSchema).min(1),
});

export async function GET() {
  const { user, response } = await withUser();
  if (response) return response;

  const recipes = await prisma.recipe.findMany({
    where: await ownRecipeFilter(user.id),
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, cuisine: true, imageUrl: true, createdAt: true },
  });
  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid recipe.');

  const recipe = await prisma.recipe.create({
    data: {
      sourceApi: 'user',
      title: parsed.data.title,
      cuisine: parsed.data.cuisine || null,
      instructions: parsed.data.instructions,
      ingredients: parsed.data.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity ?? null,
        unit: ingredient.unit ?? null,
        raw: ingredient.raw ?? '',
      })),
      isPrivate: true,
      ownerUserId: user.id,
      // Shared with the creator's household, per the agreed scoping.
      householdId: await primaryHouseholdId(user.id),
    },
  });

  return NextResponse.json({ recipe: { id: recipe.id, title: recipe.title } }, { status: 201 });
}
