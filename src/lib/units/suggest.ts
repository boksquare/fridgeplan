import { Unit, UnitSystem } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { fridgeAccessFilter } from '@/lib/fridges';
import { runAI } from '@/lib/ai/registry';
import { unitFromTable } from '@/lib/units/table';
import { normalizeIngredientName } from '@/lib/recipes/measure';

/**
 * Which unit to prefill for a typed ingredient.
 *
 * Cheapest and most personal source first:
 *   1. what this user last used for this ingredient
 *   2. what was cached on the ingredient row (from the table, or once from AI)
 *   3. the curated table
 *   4. the AI provider, if one is configured — then cached on the row, so an
 *      unknown ingredient costs one call ever rather than one call per entry
 *   5. count, which is what the form used to default to
 *
 * Steps 1 and 4 need a signed-in user; guests get the rest, which is why guest
 * mode still prefills sensibly with no provider and no account.
 */
export type UnitSuggestion = {
  unit: Unit;
  source: 'history' | 'ingredient' | 'table' | 'ai' | 'fallback';
};

const UNIT_VALUES = Object.values(Unit);

function cachedUnit(
  ingredient: { defaultUnitImperial: Unit | null; defaultUnitMetric: Unit | null } | null,
  system: UnitSystem,
): Unit | null {
  if (!ingredient) return null;
  return (system === UnitSystem.metric
    ? ingredient.defaultUnitMetric
    : ingredient.defaultUnitImperial) ?? null;
}

const SYSTEM = `You map a grocery item to the unit a shopper would buy it in.

Answer with JSON only, no prose:
{"imperial":"<unit>","metric":"<unit>"}

Each unit must be exactly one of: g, kg, ml, l, tsp, tbsp, floz, cup, pt, gal, oz, lb, count.
Use "count" for anything bought as whole pieces (eggs, onions, a loaf).
Volumes are US customary: milk by the "gal", cream by the "pt", a bottle or can
by "floz". Use "oz" only for a weight, never for a liquid.`;

async function askAI(name: string, userId: string): Promise<{ imperial: Unit; metric: Unit } | null> {
  try {
    const response = await runAI(
      { system: SYSTEM, prompt: `Item: ${name}`, maxTokens: 120 },
      userId,
    );
    const start = response.text.indexOf('{');
    const end = response.text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    const parsed = JSON.parse(response.text.slice(start, end + 1)) as Record<string, string>;
    const imperial = UNIT_VALUES.find((unit) => unit === parsed.imperial);
    const metric = UNIT_VALUES.find((unit) => unit === parsed.metric);
    if (!imperial || !metric) return null;
    return { imperial, metric };
  } catch {
    // No provider, no key, a refusal, a timeout: fall through to the table.
    return null;
  }
}

export async function suggestUnit(input: {
  ingredientName: string;
  userId?: string;
  system: UnitSystem;
  /**
   * Set false to skip step 4. A caller resolving many names at once (a scanned
   * receipt) would otherwise spend one call per line before showing anything,
   * and its user is reviewing every unit on screen regardless.
   */
  allowAI?: boolean;
}): Promise<UnitSuggestion> {
  const name = input.ingredientName.trim();
  if (!name) return { unit: Unit.count, source: 'fallback' };

  const ingredient = await prisma.ingredient.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });

  // 1. This user's own habit for this ingredient beats any general rule.
  if (input.userId && ingredient) {
    const lastUsed = await prisma.inventoryItem.findFirst({
      where: {
        ingredientId: ingredient.id,
        compartment: { fridge: fridgeAccessFilter(input.userId) },
      },
      orderBy: { createdAt: 'desc' },
      select: { unit: true },
    });
    if (lastUsed) return { unit: lastUsed.unit, source: 'history' };
  }

  // 2. Already resolved for this ingredient before.
  const cached = cachedUnit(ingredient, input.system);
  if (cached) return { unit: cached, source: 'ingredient' };

  // 3. The curated table.
  const fromTable = unitFromTable(name, input.system);
  if (fromTable) {
    const both = {
      imperial: unitFromTable(name, UnitSystem.imperial),
      metric: unitFromTable(name, UnitSystem.metric),
    };
    if (ingredient && both.imperial && both.metric) {
      await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: {
          defaultUnitImperial: both.imperial,
          defaultUnitMetric: both.metric,
          defaultUnitSource: 'table',
        },
      });
    }
    return { unit: fromTable, source: 'table' };
  }

  // 4. Ask once, then remember.
  //
  //    Only for a signed-in user, so a hosted instance never spends its
  //    operator's quota on anonymous traffic — and only for an ingredient that
  //    already exists in the dictionary, because the answer is cached on that
  //    row. A name being typed for the first time has no row to cache against,
  //    and asking anyway would mean a call per keystroke and a dictionary full
  //    of typos. Such a name gets the table or the fallback now, and can be
  //    resolved properly once saving it creates the row.
  if (
    ingredient &&
    input.userId &&
    input.allowAI !== false &&
    normalizeIngredientName(name).length > 2
  ) {
    const answered = await askAI(name, input.userId);
    if (answered) {
      await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: {
          defaultUnitImperial: answered.imperial,
          defaultUnitMetric: answered.metric,
          defaultUnitSource: 'ai',
        },
      });
      return {
        unit: input.system === UnitSystem.metric ? answered.metric : answered.imperial,
        source: 'ai',
      };
    }
  }

  return { unit: Unit.count, source: 'fallback' };
}
