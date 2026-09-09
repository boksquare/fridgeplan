import { runAI } from '@/lib/ai/registry';
import type { InventoryEntry } from '@/lib/recipes/matching';
import type { RecipeIngredient } from '@/lib/recipes/types';

export type Substitution = {
  missing: string;
  suggestion: string;
  /** True when the suggested substitute is already in the user's inventory. */
  fromInventory: boolean;
  note: string;
};

const SYSTEM = `You suggest cooking substitutions.

Rules, in priority order:
1. Prefer a substitute the cook already has in their inventory. This matters more than finding the theoretically perfect swap.
2. Only if nothing in the inventory works, suggest a common substitute they would have to buy.
3. If a missing ingredient genuinely cannot be substituted without changing the dish, say so instead of inventing something.

Reply with JSON only, no prose and no code fences:
{"substitutions":[{"missing":"<the missing ingredient>","suggestion":"<what to use>","fromInventory":<true|false>,"note":"<one short sentence, including amounts if they differ>"}]}`;

function buildPrompt(
  recipeTitle: string,
  missing: RecipeIngredient[],
  inventory: InventoryEntry[],
): string {
  const stock = inventory
    .map((entry) => `- ${entry.ingredientName} (${entry.quantity} ${entry.unit})`)
    .join('\n');

  return [
    `Recipe: ${recipeTitle}`,
    '',
    'Missing ingredients:',
    ...missing.map((ingredient) => `- ${ingredient.name}${ingredient.raw ? ` (${ingredient.raw})` : ''}`),
    '',
    'Already in their fridges:',
    stock || '- (nothing)',
  ].join('\n');
}

function parseSubstitutions(text: string): Substitution[] {
  // Models sometimes wrap JSON in fences or prose; take the first object.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return [];

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      substitutions?: Partial<Substitution>[];
    };
    return (parsed.substitutions ?? [])
      .filter((entry): entry is Substitution => Boolean(entry.missing && entry.suggestion))
      .map((entry) => ({
        missing: String(entry.missing),
        suggestion: String(entry.suggestion),
        fromInventory: Boolean(entry.fromInventory),
        note: String(entry.note ?? ''),
      }));
  } catch {
    return [];
  }
}

/**
 * Asks the active AI provider what to use instead of what is missing,
 * preferring substitutes already in the user's fridges (the agreed priority
 * order) and only then common ones.
 */
export async function suggestSubstitutions(input: {
  recipeTitle: string;
  missing: RecipeIngredient[];
  inventory: InventoryEntry[];
  userId?: string;
}): Promise<{ substitutions: Substitution[]; model: string }> {
  if (input.missing.length === 0) return { substitutions: [], model: 'none' };

  const response = await runAI(
    {
      system: SYSTEM,
      prompt: buildPrompt(input.recipeTitle, input.missing, input.inventory),
      maxTokens: 900,
    },
    input.userId,
  );

  return { substitutions: parseSubstitutions(response.text), model: response.model };
}

export { parseSubstitutions as __parseSubstitutionsForTest };
