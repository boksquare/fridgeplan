import { parseMeasure } from '@/lib/recipes/measure';
import { RecipeProviderError } from '@/lib/recipes/types';
import type { ProviderRecipe, RecipeProvider, SearchOptions } from '@/lib/recipes/types';

const BASE = process.env.THEMEALDB_BASE_URL ?? 'https://www.themealdb.com/api/json/v1/1';

type MealRow = Record<string, string | null> & { idMeal: string; strMeal: string };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { cache: 'no-store' });
  if (!res.ok) throw new RecipeProviderError('themealdb', `TheMealDB returned ${res.status}`);
  return (await res.json()) as T;
}

/** TheMealDB spreads ingredients across strIngredient1..20 / strMeasure1..20. */
function toRecipe(meal: MealRow): ProviderRecipe {
  const ingredients = [];
  for (let index = 1; index <= 20; index += 1) {
    const name = meal[`strIngredient${index}`]?.trim();
    if (!name) continue;
    const measure = meal[`strMeasure${index}`]?.trim() ?? '';
    const parsed = parseMeasure(measure);
    ingredients.push({ name, quantity: parsed.quantity, unit: parsed.unit, raw: measure });
  }

  return {
    sourceApi: 'themealdb',
    externalId: meal.idMeal,
    title: meal.strMeal,
    cuisine: meal.strArea?.trim() || null,
    imageUrl: meal.strMealThumb?.trim() || null,
    ingredients,
    instructions: meal.strInstructions?.trim() ?? '',
  };
}

/**
 * TheMealDB: free, no key, and its terms put no limit on caching, so results
 * are stored indefinitely with attribution.
 */
export const theMealDbProvider: RecipeProvider = {
  id: 'themealdb',
  label: 'TheMealDB',
  attribution: 'Recipe data from TheMealDB',
  cacheMinutes: null,

  async searchByText({ query, cuisine, limit = 12 }: SearchOptions) {
    if (cuisine) {
      // filter.php returns stubs only, so each hit needs a lookup for details.
      const body = await get<{ meals: MealRow[] | null }>(
        `filter.php?a=${encodeURIComponent(cuisine)}`,
      );
      const stubs = (body.meals ?? []).slice(0, limit);
      const full = await Promise.all(stubs.map((stub) => this.getByExternalId(stub.idMeal)));
      return full.filter((recipe): recipe is ProviderRecipe => Boolean(recipe));
    }

    const body = await get<{ meals: MealRow[] | null }>(
      `search.php?s=${encodeURIComponent(query ?? '')}`,
    );
    return (body.meals ?? []).slice(0, limit).map(toRecipe);
  },

  async searchByIngredients(names, limit = 12) {
    // No multi-ingredient endpoint exists, so filter by each ingredient and
    // rank by how many of them a recipe turns up under.
    const hits = new Map<string, { stub: MealRow; matches: number }>();

    for (const name of names.slice(0, 6)) {
      let body: { meals: MealRow[] | null };
      try {
        body = await get<{ meals: MealRow[] | null }>(`filter.php?i=${encodeURIComponent(name)}`);
      } catch {
        continue; // An unknown ingredient just contributes nothing.
      }
      for (const stub of body.meals ?? []) {
        const existing = hits.get(stub.idMeal);
        if (existing) existing.matches += 1;
        else hits.set(stub.idMeal, { stub, matches: 1 });
      }
    }

    const ranked = [...hits.values()]
      .sort((a, b) => b.matches - a.matches)
      .slice(0, limit)
      .map((hit) => hit.stub.idMeal);

    const full = await Promise.all(ranked.map((id) => this.getByExternalId(id)));
    return full.filter((recipe): recipe is ProviderRecipe => Boolean(recipe));
  },

  async getByExternalId(externalId) {
    const body = await get<{ meals: MealRow[] | null }>(
      `lookup.php?i=${encodeURIComponent(externalId)}`,
    );
    const meal = body.meals?.[0];
    return meal ? toRecipe(meal) : null;
  },
};
