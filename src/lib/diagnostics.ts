import { prisma } from '@/lib/prisma';
import { env, envList } from '@/lib/env';
import { availableProviders } from '@/lib/recipes/registry';
import { resolveAIConfiguration } from '@/lib/ai/registry';
import { getDeploymentMode } from '@/lib/deployment-mode';

/**
 * A live self-test of the things an instance depends on but cannot check at
 * boot: the recipe sources and the AI provider are both remote, both optional,
 * and both fail in ways that used to be invisible in the UI.
 */
export type Check = {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  ms?: number;
};

async function timed<T>(run: () => Promise<T>): Promise<{ value?: T; error?: Error; ms: number }> {
  const started = Date.now();
  try {
    return { value: await run(), ms: Date.now() - started };
  } catch (error) {
    return { error: error as Error, ms: Date.now() - started };
  }
}

export async function runDiagnostics(userId?: string): Promise<Check[]> {
  const checks: Check[] = [];

  // --- instance -----------------------------------------------------------
  const mode = await getDeploymentMode();
  checks.push({
    name: 'Deployment mode',
    status: mode ? 'ok' : 'fail',
    detail: mode ? mode.replace(/_/g, ' ') : 'not set up yet — open /setup',
  });

  const [ingredients, items] = await Promise.all([
    prisma.ingredient.count(),
    prisma.inventoryItem.count({ where: { consumedAt: null } }),
  ]);
  checks.push({
    name: 'Database',
    status: 'ok',
    detail: `${ingredients} ingredients in the dictionary, ${items} items in fridges`,
  });
  checks.push({
    name: 'Ingredient dictionary',
    status: ingredients > 100 ? 'ok' : 'warn',
    detail:
      ingredients > 100
        ? 'seeded'
        : `only ${ingredients} entries — run "docker compose exec app npx prisma db seed" for autocomplete coverage`,
  });

  // --- recipe sources -----------------------------------------------------
  const configuredList = envList('RECIPE_PROVIDERS');
  const providers = availableProviders();
  checks.push({
    name: 'Recipe sources enabled',
    status: providers.length > 0 ? 'ok' : 'fail',
    detail:
      providers.length > 0
        ? providers.map((provider) => provider.label).join(', ') +
          (configuredList ? ` (RECIPE_PROVIDERS=${configuredList.join(',')})` : '')
        : 'none — suggest and search can only return your own recipes',
  });

  for (const provider of providers) {
    // A real request, because "configured" and "reachable" are different things.
    const search = await timed(() => provider.searchByText({ query: 'chicken', limit: 1 }));
    checks.push({
      name: `${provider.label}: text search`,
      status: search.error ? 'fail' : (search.value?.length ?? 0) > 0 ? 'ok' : 'warn',
      detail: search.error
        ? search.error.message
        : `${search.value?.length ?? 0} result(s); first: ${search.value?.[0]?.title ?? '—'}`,
      ms: search.ms,
    });

    const byIngredient = await timed(() => provider.searchByIngredients(['chicken'], 1));
    checks.push({
      name: `${provider.label}: search by ingredient`,
      status: byIngredient.error ? 'fail' : (byIngredient.value?.length ?? 0) > 0 ? 'ok' : 'warn',
      detail: byIngredient.error
        ? byIngredient.error.message
        : `${byIngredient.value?.length ?? 0} result(s) for "chicken"`,
      ms: byIngredient.ms,
    });
  }

  if (!env('SPOONACULAR_API_KEY')) {
    checks.push({
      name: 'Spoonacular',
      status: 'warn',
      detail: 'no API key set, so it is off (optional — TheMealDB needs no key)',
    });
  }

  // --- AI provider --------------------------------------------------------
  const ai = await resolveAIConfiguration(userId);
  checks.push({
    name: 'AI provider configured',
    status: ai.active && !ai.problem ? 'ok' : ai.active ? 'warn' : 'fail',
    detail: ai.problem ?? `${ai.active!.provider.label} (${ai.active!.config.model ?? 'default model'})`,
  });

  if (ai.active && !ai.problem) {
    // One tiny live call: a configured provider with a bad key or model looks
    // identical to a working one until something actually asks it.
    const ping = await timed(() =>
      ai.active!.provider.chat(
        {
          system: 'Reply with the single word: ok',
          prompt: 'Reply with the single word: ok',
          maxTokens: 8,
        },
        ai.active!.config,
      ),
    );
    checks.push({
      name: `${ai.active.provider.label}: live call`,
      status: ping.error ? 'fail' : 'ok',
      detail: ping.error
        ? ping.error.message
        : `answered "${ping.value?.text.slice(0, 40)}" as ${ping.value?.model}`,
      ms: ping.ms,
    });
  }

  return checks;
}
