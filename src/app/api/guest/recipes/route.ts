import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Unit } from '@/generated/prisma/enums';
import { availableProviders } from '@/lib/recipes/registry';
import { matchRecipe, scoreRecipe } from '@/lib/recipes/matching';
import { getDeploymentMode } from '@/lib/deployment-mode';
import type { InventoryEntry } from '@/lib/recipes/matching';
import type { ProviderRecipe } from '@/lib/recipes/types';

/**
 * The stateless half of guest mode: a guest's inventory lives only in their
 * browser, so it is posted here, matched in memory, and the results are
 * returned whole. Nothing is written to the database — no rows, no cache, no
 * identity — which also means a guest recipe cannot be re-opened by id later,
 * so the full recipe travels with the response.
 */
const bodySchema = z.object({
  mode: z.enum(['suggest', 'search']),
  query: z.string().trim().max(120).optional(),
  cuisine: z.string().trim().max(60).optional(),
  inventory: z
    .array(
      z.object({
        ingredientName: z.string().trim().min(1).max(120),
        quantity: z.number().nonnegative().max(100000),
        unit: z.nativeEnum(Unit),
      }),
    )
    .max(200)
    .default([]),
  limit: z.number().int().min(1).max(24).default(12),
});

export async function POST(request: Request) {
  // Guest mode only exists on a hosted instance; a self-host install has real
  // persistence and no reason to route around it.
  if ((await getDeploymentMode()) !== 'public_hosted') {
    return NextResponse.json({ error: 'Guest mode is not enabled here.' }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    );
  }

  const inventory: InventoryEntry[] = parsed.data.inventory.map((entry, index) => ({
    itemId: `guest-${index}`,
    ingredientId: `guest-${index}`,
    ingredientName: entry.ingredientName,
    aliases: [],
    quantity: entry.quantity,
    unit: entry.unit,
    compartmentLabel: '',
    fridgeName: '',
  }));

  const errors: string[] = [];
  const fetched: ProviderRecipe[] = [];

  for (const provider of availableProviders()) {
    try {
      if (parsed.data.mode === 'suggest') {
        if (inventory.length === 0) continue;
        const names = [...inventory]
          .sort((a, b) => b.quantity - a.quantity)
          .map((entry) => entry.ingredientName);
        fetched.push(...(await provider.searchByIngredients(names, parsed.data.limit)));
      } else {
        fetched.push(
          ...(await provider.searchByText({
            query: parsed.data.query,
            cuisine: parsed.data.cuisine,
            limit: parsed.data.limit,
          })),
        );
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  const results = fetched
    .map((recipe) => {
      const match = matchRecipe(recipe.ingredients, inventory);
      return {
        recipe,
        haveCount: match.haveCount,
        totalCount: match.totalCount,
        missing: match.missing.map((ingredient) => ingredient.name),
        score: scoreRecipe(match),
      };
    })
    .filter((entry) => (parsed.data.mode === 'suggest' ? entry.haveCount > 0 : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, parsed.data.limit);

  return NextResponse.json({ results, errors });
}
