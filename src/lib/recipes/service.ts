import { prisma } from '@/lib/prisma';
import { availableProviders, getProvider } from '@/lib/recipes/registry';
import { cacheProviderRecipes, purgeExpiredRecipes } from '@/lib/recipes/cache';
import { loadInventory } from '@/lib/recipes/inventory-view';
import { matchRecipe, scoreRecipe } from '@/lib/recipes/matching';
import { parseIngredientsJson, recipeVisibilityFilter } from '@/lib/recipes/access';
import type { RecipeMatch } from '@/lib/recipes/matching';
import type { ProviderRecipe } from '@/lib/recipes/types';

export type RecipeSummary = {
  id: string;
  sourceApi: string;
  title: string;
  cuisine: string | null;
  imageUrl: string | null;
  isPrivate: boolean;
  haveCount: number;
  totalCount: number;
  missing: string[];
  score: number;
};

function summarize(
  recipe: { id: string; sourceApi: string; title: string; cuisine: string | null; imageUrl: string | null; isPrivate: boolean },
  match: RecipeMatch,
): RecipeSummary {
  return {
    id: recipe.id,
    sourceApi: recipe.sourceApi,
    title: recipe.title,
    cuisine: recipe.cuisine,
    imageUrl: recipe.imageUrl,
    isPrivate: recipe.isPrivate,
    haveCount: match.haveCount,
    totalCount: match.totalCount,
    missing: match.missing.map((ingredient) => ingredient.name),
    score: scoreRecipe(match),
  };
}

/** Free-text / cuisine search across the configured sources plus own recipes. */
export async function searchRecipes(input: {
  userId: string;
  query?: string;
  cuisine?: string;
  sourceApi?: string;
  limit?: number;
}) {
  await purgeExpiredRecipes();
  const limit = input.limit ?? 12;
  const inventory = await loadInventory(input.userId);
  const errors: string[] = [];

  const providers = input.sourceApi
    ? [getProvider(input.sourceApi)].filter((provider) => provider !== null)
    : availableProviders();

  const fetched: ProviderRecipe[] = [];
  for (const provider of providers) {
    try {
      fetched.push(
        ...(await provider.searchByText({ query: input.query, cuisine: input.cuisine, limit })),
      );
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  const cached = await cacheProviderRecipes(fetched);

  // Private recipes of the user's household participate in search too.
  const own = input.query
    ? await prisma.recipe.findMany({
        where: {
          AND: [
            await recipeVisibilityFilter(input.userId),
            { isPrivate: true, title: { contains: input.query, mode: 'insensitive' } },
          ],
        },
        take: limit,
      })
    : [];

  const results = [...own, ...cached].map((recipe) =>
    summarize(recipe, matchRecipe(parseIngredientsJson(recipe.ingredients), inventory)),
  );

  return { results: results.sort((a, b) => b.score - a.score), errors };
}

/** "Suggest meals": what can be cooked from what is in the fridges. */
export async function suggestRecipes(input: { userId: string; limit?: number }) {
  await purgeExpiredRecipes();
  const limit = input.limit ?? 12;
  const inventory = await loadInventory(input.userId);
  const errors: string[] = [];

  if (inventory.length === 0) {
    return { results: [], errors, inventoryCount: 0 };
  }

  // Ask for the ingredients there is most of first; providers cap how many
  // they will consider.
  const names = [...inventory]
    .sort((a, b) => b.quantity - a.quantity)
    .map((entry) => entry.ingredientName);

  const fetched: ProviderRecipe[] = [];
  for (const provider of availableProviders()) {
    try {
      fetched.push(...(await provider.searchByIngredients(names, limit)));
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  const cached = await cacheProviderRecipes(fetched);

  // Own recipes are matched locally — no API involved.
  const own = await prisma.recipe.findMany({
    where: { AND: [await recipeVisibilityFilter(input.userId), { isPrivate: true }] },
    take: 50,
  });

  const results = [...own, ...cached]
    .map((recipe) => summarize(recipe, matchRecipe(parseIngredientsJson(recipe.ingredients), inventory)))
    .filter((summary) => summary.haveCount > 0)
    .sort((a, b) => b.score - a.score || b.haveCount - a.haveCount)
    .slice(0, limit);

  return { results, errors, inventoryCount: inventory.length };
}

/** One recipe, with what the user has and is missing for it. */
export async function getRecipeWithMatch(userId: string, recipeId: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { AND: [{ id: recipeId }, await recipeVisibilityFilter(userId)] },
  });
  if (!recipe) return null;

  const inventory = await loadInventory(userId);
  const ingredients = parseIngredientsJson(recipe.ingredients);
  return { recipe, match: matchRecipe(ingredients, inventory), inventory };
}
