import { normalizeIngredientName, singularize } from '@/lib/recipes/measure';
import type { RecipeIngredient } from '@/lib/recipes/types';
import type { Unit } from '@/generated/prisma/enums';

export type InventoryEntry = {
  itemId: string;
  ingredientId: string;
  ingredientName: string;
  aliases: string[];
  quantity: number;
  unit: Unit;
  compartmentLabel: string;
  fridgeName: string;
};

export type MatchedIngredient = {
  ingredient: RecipeIngredient;
  /** Inventory entries that appear to be this ingredient, most stocked first. */
  matches: InventoryEntry[];
  have: boolean;
};

export type RecipeMatch = {
  ingredients: MatchedIngredient[];
  missing: RecipeIngredient[];
  haveCount: number;
  totalCount: number;
};

function keysFor(name: string): string[] {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return [];
  const words = normalized.split(' ');
  const keys = new Set<string>([normalized, singularize(normalized)]);
  // "chicken breast" should also match stock of "chicken".
  if (words.length > 1) {
    const last = words[words.length - 1]!;
    keys.add(singularize(last));
    keys.add(singularize(words[0]!));
  }
  return [...keys].filter((key) => key.length > 2);
}

/**
 * Matches a recipe's ingredients against what is in the fridges. Deliberately
 * generous — a near match is offered to the user to confirm rather than
 * silently treated as missing — and quantities are never reconciled here:
 * unit-aware reconciliation is explicitly out of scope for now.
 */
export function matchRecipe(
  ingredients: RecipeIngredient[],
  inventory: InventoryEntry[],
): RecipeMatch {
  const index = new Map<string, InventoryEntry[]>();
  for (const entry of inventory) {
    for (const name of [entry.ingredientName, ...entry.aliases]) {
      for (const key of keysFor(name)) {
        const bucket = index.get(key) ?? [];
        bucket.push(entry);
        index.set(key, bucket);
      }
    }
  }

  const matched = ingredients.map((ingredient) => {
    const found = new Map<string, InventoryEntry>();
    for (const key of keysFor(ingredient.name)) {
      for (const entry of index.get(key) ?? []) found.set(entry.itemId, entry);
    }
    const matches = [...found.values()].sort((a, b) => b.quantity - a.quantity);
    return { ingredient, matches, have: matches.length > 0 };
  });

  return {
    ingredients: matched,
    missing: matched.filter((entry) => !entry.have).map((entry) => entry.ingredient),
    haveCount: matched.filter((entry) => entry.have).length,
    totalCount: matched.length,
  };
}

/** Ranks recipes by how much of them the user already has. */
export function scoreRecipe(match: RecipeMatch): number {
  if (match.totalCount === 0) return 0;
  return match.haveCount / match.totalCount;
}
