import { prisma } from '@/lib/prisma';
import { getProvider } from '@/lib/recipes/registry';
import type { ProviderRecipe } from '@/lib/recipes/types';

/**
 * Stores what a provider returned so a recipe can be opened, cooked from and
 * linked to afterwards. Rows from a provider with a cache limit carry an expiry
 * and are swept away once it passes; TheMealDB rows have none and stay.
 */
export async function cacheProviderRecipes(recipes: ProviderRecipe[]) {
  const stored = [];
  for (const recipe of recipes) {
    const provider = getProvider(recipe.sourceApi);
    const cacheExpiresAt = provider?.cacheMinutes
      ? new Date(Date.now() + provider.cacheMinutes * 60_000)
      : null;

    const data = {
      sourceApi: recipe.sourceApi,
      externalId: recipe.externalId,
      title: recipe.title,
      cuisine: recipe.cuisine,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      isPrivate: false,
      cacheExpiresAt,
    };

    stored.push(
      await prisma.recipe.upsert({
        where: { sourceApi_externalId: { sourceApi: recipe.sourceApi, externalId: recipe.externalId } },
        create: data,
        update: data,
      }),
    );
  }
  return stored;
}

/** Drops cached rows whose provider-permitted lifetime has passed. */
export async function purgeExpiredRecipes() {
  const { count } = await prisma.recipe.deleteMany({
    where: { isPrivate: false, cacheExpiresAt: { not: null, lte: new Date() } },
  });
  return count;
}

/**
 * Deletes everything obtained from one provider — what Spoonacular's terms
 * require if the app stops using their API.
 */
export async function purgeProviderRecipes(sourceApi: string) {
  const { count } = await prisma.recipe.deleteMany({ where: { isPrivate: false, sourceApi } });
  return count;
}
