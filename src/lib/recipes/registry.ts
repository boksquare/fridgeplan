import { env, envList } from '@/lib/env';
import { theMealDbProvider } from '@/lib/recipes/themealdb';
import { spoonacularProvider } from '@/lib/recipes/spoonacular';
import type { RecipeProvider } from '@/lib/recipes/types';

/**
 * Which recipe sources this instance uses. TheMealDB is always on (no key
 * needed); Spoonacular joins in as soon as an operator supplies a key, and
 * RECIPE_PROVIDERS can narrow or reorder the list. A self-hoster pointing at a
 * different provider adds it here and nothing else changes.
 */
const ALL: RecipeProvider[] = [theMealDbProvider, spoonacularProvider];

export function availableProviders(): RecipeProvider[] {
  // envList treats an empty RECIPE_PROVIDERS as unset. Reading it with `??`
  // yielded an empty-but-truthy list under docker-compose, which filtered every
  // source out and made suggest and search return nothing at all.
  const configured = envList('RECIPE_PROVIDERS');

  const enabled = ALL.filter((provider) => {
    if (provider.id === 'spoonacular' && !env('SPOONACULAR_API_KEY')) return false;
    return configured ? configured.includes(provider.id) : true;
  });

  if (!configured) return enabled;
  // Honour the order the operator asked for.
  return configured
    .map((id) => enabled.find((provider) => provider.id === id))
    .filter((provider): provider is RecipeProvider => Boolean(provider));
}

export function getProvider(id: string): RecipeProvider | null {
  return availableProviders().find((provider) => provider.id === id) ?? null;
}

export function providerAttributions(): string[] {
  return availableProviders().map((provider) => provider.attribution);
}
