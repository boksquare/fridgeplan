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
  /** Inventory entries that are this ingredient, most stocked first. */
  matches: InventoryEntry[];
  /**
   * Entries that share a word with it but are not it — chicken nuggets against
   * a recipe wanting chicken. Offered as a hint, never counted as having it.
   */
  possible: InventoryEntry[];
  have: boolean;
};

export type RecipeMatch = {
  ingredients: MatchedIngredient[];
  missing: RecipeIngredient[];
  haveCount: number;
  totalCount: number;
};

/**
 * Words that narrow a food without making it a different food, so a recipe
 * wanting "chicken" is satisfied by "chicken thighs".
 *
 * This is an allowlist rather than a rule, because there is no rule: adding a
 * word to a food name either specifies it ("chicken breast" is chicken) or
 * transforms it into another product ("chicken nuggets", "chicken stock",
 * "coconut milk", "tomato ketchup" are not). Matching on a shared word alone
 * cannot tell those apart, and getting it wrong claims you have something you
 * do not.
 *
 * Erring towards a short list is deliberate: a specifier missing from it means
 * an ingredient is reported as missing when a close item is in the fridge —
 * which is visible, correctable, and shown anyway as a possible match — whereas
 * the opposite error hides a shopping trip until you are mid-recipe.
 *
 * Colours and varieties are left out on purpose. "Green onion" is not an onion
 * and "red pepper" is not black pepper, so treating a colour as a specifier
 * reintroduces exactly the bug this list exists to prevent.
 */
const SPECIFIERS = new Set([
  // cuts and joints
  'breast', 'thigh', 'wing', 'drumstick', 'leg', 'fillet', 'filet', 'steak',
  'chop', 'loin', 'rib', 'shoulder', 'shank', 'tenderloin', 'sirloin',
  'brisket', 'cutlet', 'escalope', 'mince', 'flank', 'rump', 'belly', 'joint',
  // form and preparation the shop or the cook applies
  'cube', 'crushed', 'grated', 'shredded', 'halved', 'peeled', 'trimmed',
  'boned', 'rinsed', 'drained', 'thawed', 'frozen', 'chilled', 'cooked',
  'raw', 'uncooked', 'leftover', 'pitted', 'cored', 'shelled', 'deveined',
  'quartered', 'crumbled', 'softened', 'melted', 'julienned', 'seedless',
  'stemmed',
  // grade and provenance
  'organic', 'freerange', 'range', 'farmed', 'wild', 'ripe', 'lean', 'prime',
  // seasoning and processing that leaves the food itself alone
  'unsalted', 'salted', 'unsweetened', 'plain', 'natural',
  // fat level, whose names arrive hyphenated ("semi-skimmed", "low-fat") and
  // reach here as separate tokens once punctuation is normalized away
  'skimmed', 'semiskimmed', 'semi', 'reduced', 'fat', 'low', 'light', 'full',
  'skim',
]);

/** Normalized, singular tokens of a name, with the noise words dropped. */
function tokens(name: string): string[] {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .map((word) => singularize(word))
    .filter(Boolean);
}

type Relation = 'same' | 'related' | 'none';

/**
 * How a recipe's ingredient name relates to something in the fridge.
 *
 * "same" means it counts as having it: either the names agree, or one is the
 * other narrowed by specifiers only. "related" means they share a food word but
 * one carries a word that changes what it is, so it is worth showing and not
 * worth counting.
 */
function relate(a: string, b: string): Relation {
  const left = tokens(a);
  const right = tokens(b);
  if (left.length === 0 || right.length === 0) return 'none';

  const leftSet = new Set(left);
  const rightSet = new Set(right);

  const shared = [...leftSet].filter((token) => rightSet.has(token));
  if (shared.length === 0) return 'none';

  const onlyLeft = [...leftSet].filter((token) => !rightSet.has(token));
  const onlyRight = [...rightSet].filter((token) => !leftSet.has(token));

  if (onlyLeft.length === 0 && onlyRight.length === 0) return 'same';

  // One name is the other plus specifiers: still the same food. Whichever side
  // the extra words are on, since a recipe may be the general or the specific
  // one ("chicken" wanting thighs, "chicken breast" satisfied by chicken).
  const extra = [...onlyLeft, ...onlyRight];
  if (extra.every((token) => SPECIFIERS.has(token))) return 'same';

  return 'related';
}

/**
 * Matches a recipe's ingredients against what is in the fridges.
 *
 * Quantities are never reconciled here; unit-aware reconciliation happens when
 * you confirm what was actually used at cook time.
 */
export function matchRecipe(
  ingredients: RecipeIngredient[],
  inventory: InventoryEntry[],
): RecipeMatch {
  const matched = ingredients.map((ingredient) => {
    const same = new Map<string, InventoryEntry>();
    const related = new Map<string, InventoryEntry>();

    for (const entry of inventory) {
      // An alias is another name for the same ingredient, so the best relation
      // across the entry's names is the entry's relation.
      let best: Relation = 'none';
      for (const name of [entry.ingredientName, ...entry.aliases]) {
        const relation = relate(ingredient.name, name);
        if (relation === 'same') {
          best = 'same';
          break;
        }
        if (relation === 'related') best = 'related';
      }

      if (best === 'same') same.set(entry.itemId, entry);
      else if (best === 'related') related.set(entry.itemId, entry);
    }

    const byStock = (a: InventoryEntry, b: InventoryEntry) => b.quantity - a.quantity;
    const matches = [...same.values()].sort(byStock);

    return {
      ingredient,
      matches,
      // A confident match makes the looser ones beside the point.
      possible: matches.length > 0 ? [] : [...related.values()].sort(byStock),
      have: matches.length > 0,
    };
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
