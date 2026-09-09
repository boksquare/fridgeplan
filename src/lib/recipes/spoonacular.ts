import { parseMeasure } from '@/lib/recipes/measure';
import { RecipeProviderError } from '@/lib/recipes/types';
import type { ProviderRecipe, RecipeProvider, SearchOptions } from '@/lib/recipes/types';

const BASE = process.env.SPOONACULAR_BASE_URL ?? 'https://api.spoonacular.com';

/**
 * Spoonacular's terms allow caching results for at most one hour and require
 * deleting everything obtained from them if the app stops using the API. So
 * this provider is a pass-through: rows it produces carry a one-hour expiry and
 * are never treated as a permanent mirror (see `purgeExpiredRecipes` and the
 * `purge:spoonacular` script).
 */
export const SPOONACULAR_CACHE_MINUTES = 60;

type SpoonacularInfo = {
  id: number;
  title: string;
  image?: string | null;
  cuisines?: string[];
  instructions?: string | null;
  extendedIngredients?: {
    name?: string;
    original?: string;
    amount?: number;
    unit?: string;
  }[];
};

function apiKey(): string {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) throw new RecipeProviderError('spoonacular', 'No Spoonacular API key is configured.');
  return key;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('apiKey', apiKey());

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new RecipeProviderError(
      'spoonacular',
      res.status === 402
        ? 'The Spoonacular daily quota is used up.'
        : `Spoonacular returned ${res.status}`,
    );
  }
  return (await res.json()) as T;
}

function toRecipe(info: SpoonacularInfo): ProviderRecipe {
  return {
    sourceApi: 'spoonacular',
    externalId: String(info.id),
    title: info.title,
    cuisine: info.cuisines?.[0] ?? null,
    imageUrl: info.image ?? null,
    ingredients: (info.extendedIngredients ?? []).map((ingredient) => {
      const raw = ingredient.original ?? `${ingredient.amount ?? ''} ${ingredient.unit ?? ''}`.trim();
      // Spoonacular gives a structured amount and unit; fall back to parsing
      // its own wording when the unit is one we do not carry.
      const parsed = parseMeasure(
        ingredient.amount !== undefined && ingredient.unit
          ? `${ingredient.amount} ${ingredient.unit}`
          : raw,
      );
      return {
        name: ingredient.name?.trim() || raw,
        quantity: parsed.quantity ?? ingredient.amount ?? null,
        unit: parsed.unit,
        raw,
      };
    }),
    instructions: (info.instructions ?? '').replace(/<[^>]+>/g, '').trim(),
  };
}

/** Full details for a batch of ids — one request instead of one per recipe. */
async function hydrate(ids: number[]): Promise<ProviderRecipe[]> {
  if (ids.length === 0) return [];
  const body = await get<SpoonacularInfo[]>('recipes/informationBulk', {
    ids: ids.join(','),
    includeNutrition: 'false',
  });
  return body.map(toRecipe);
}

export const spoonacularProvider: RecipeProvider = {
  id: 'spoonacular',
  label: 'Spoonacular',
  attribution: 'Recipe data from Spoonacular',
  cacheMinutes: SPOONACULAR_CACHE_MINUTES,

  async searchByText({ query, cuisine, limit = 12 }: SearchOptions) {
    const body = await get<{ results: { id: number }[] }>('recipes/complexSearch', {
      ...(query ? { query } : {}),
      ...(cuisine ? { cuisine } : {}),
      number: String(limit),
      addRecipeInformation: 'false',
    });
    return hydrate(body.results.map((result) => result.id));
  },

  async searchByIngredients(names, limit = 12) {
    // The endpoint that makes Spoonacular worth configuring: recipes ranked by
    // what is already on hand.
    const body = await get<{ id: number }[]>('recipes/findByIngredients', {
      ingredients: names.join(','),
      number: String(limit),
      ranking: '1',
      ignorePantry: 'true',
    });
    return hydrate(body.map((result) => result.id));
  },

  async getByExternalId(externalId) {
    const info = await get<SpoonacularInfo>(`recipes/${encodeURIComponent(externalId)}/information`, {
      includeNutrition: 'false',
    });
    return toRecipe(info);
  },
};
