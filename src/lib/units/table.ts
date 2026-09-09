import { Unit, UnitSystem } from '@/generated/prisma/enums';
import { normalizeIngredientName, singularize } from '@/lib/recipes/measure';

/**
 * How groceries are usually bought, per measurement system, so entry can
 * prefill the unit for a typed ingredient.
 *
 * Curated rather than inferred: it is instant, costs nothing, works offline and
 * with no AI provider configured, and is the same for everyone. The AI is only
 * asked about names that are not here, and its answer is cached on the
 * ingredient row.
 *
 * Imperial liquids use the size the shop actually sells them in — milk by the
 * gallon, cream by the pint, stock by the fluid ounce — rather than the cup they
 * all used to collapse onto before those units existed.
 */
type UnitPair = { imperial: Unit; metric: Unit };

const BY_WEIGHT_LARGE: UnitPair = { imperial: Unit.lb, metric: Unit.kg };
const BY_WEIGHT_SMALL: UnitPair = { imperial: Unit.oz, metric: Unit.g };
/** Bought by the jug: milk, water, juice. */
const BY_VOLUME_JUG: UnitPair = { imperial: Unit.gal, metric: Unit.l };
/** Bought by the carton, which in the US is a pint or a half-pint. */
const BY_VOLUME_CARTON: UnitPair = { imperial: Unit.pt, metric: Unit.ml };
/** Bought by the bottle or can, whose label reads in fluid ounces. */
const BY_VOLUME_BOTTLE: UnitPair = { imperial: Unit.floz, metric: Unit.ml };
/** Measured out by the spoon rather than bought by volume. */
const BY_VOLUME_SMALL: UnitPair = { imperial: Unit.tbsp, metric: Unit.ml };
const BY_COUNT: UnitPair = { imperial: Unit.count, metric: Unit.count };

/** Exact-ish names first: matched after normalisation and singularisation. */
const NAMES: Record<string, UnitPair> = {
  // Meat and fish, bought by weight
  'ground beef': BY_WEIGHT_LARGE,
  beef: BY_WEIGHT_LARGE,
  steak: BY_WEIGHT_LARGE,
  mince: BY_WEIGHT_LARGE,
  'ground turkey': BY_WEIGHT_LARGE,
  'ground pork': BY_WEIGHT_LARGE,
  pork: BY_WEIGHT_LARGE,
  lamb: BY_WEIGHT_LARGE,
  chicken: BY_WEIGHT_LARGE,
  'chicken breast': BY_WEIGHT_LARGE,
  'chicken thigh': BY_WEIGHT_LARGE,
  'chicken wing': BY_WEIGHT_LARGE,
  turkey: BY_WEIGHT_LARGE,
  bacon: BY_WEIGHT_SMALL,
  sausage: BY_COUNT,
  salmon: BY_WEIGHT_SMALL,
  tuna: BY_WEIGHT_SMALL,
  cod: BY_WEIGHT_SMALL,
  prawn: BY_WEIGHT_SMALL,
  shrimp: BY_WEIGHT_SMALL,

  // Dairy
  milk: BY_VOLUME_JUG,
  cream: BY_VOLUME_CARTON,
  'double cream': BY_VOLUME_CARTON,
  'sour cream': BY_WEIGHT_SMALL,
  yoghurt: BY_WEIGHT_SMALL,
  yogurt: BY_WEIGHT_SMALL,
  butter: BY_WEIGHT_SMALL,
  margarine: BY_WEIGHT_SMALL,
  cheese: BY_WEIGHT_SMALL,
  'cheddar cheese': BY_WEIGHT_SMALL,
  mozzarella: BY_WEIGHT_SMALL,
  parmesan: BY_WEIGHT_SMALL,
  'cream cheese': BY_WEIGHT_SMALL,
  egg: BY_COUNT,

  // Dry staples
  flour: BY_WEIGHT_LARGE,
  sugar: BY_WEIGHT_LARGE,
  'brown sugar': BY_WEIGHT_SMALL,
  rice: BY_WEIGHT_LARGE,
  pasta: BY_WEIGHT_SMALL,
  spaghetti: BY_WEIGHT_SMALL,
  penne: BY_WEIGHT_SMALL,
  noodle: BY_WEIGHT_SMALL,
  oat: BY_WEIGHT_SMALL,
  lentil: BY_WEIGHT_SMALL,
  'red lentil': BY_WEIGHT_SMALL,
  bean: BY_WEIGHT_SMALL,
  chickpea: BY_WEIGHT_SMALL,
  couscous: BY_WEIGHT_SMALL,
  quinoa: BY_WEIGHT_SMALL,
  breadcrumb: BY_WEIGHT_SMALL,

  // Liquids and condiments
  water: BY_VOLUME_JUG,
  stock: BY_VOLUME_BOTTLE,
  broth: BY_VOLUME_BOTTLE,
  juice: BY_VOLUME_JUG,
  'orange juice': BY_VOLUME_JUG,
  wine: BY_VOLUME_BOTTLE,
  beer: BY_VOLUME_BOTTLE,
  'olive oil': BY_VOLUME_SMALL,
  oil: BY_VOLUME_SMALL,
  'vegetable oil': BY_VOLUME_SMALL,
  vinegar: BY_VOLUME_SMALL,
  'soy sauce': BY_VOLUME_SMALL,
  honey: BY_VOLUME_SMALL,
  'maple syrup': BY_VOLUME_SMALL,
  ketchup: BY_WEIGHT_SMALL,
  mayonnaise: BY_WEIGHT_SMALL,
  mustard: BY_WEIGHT_SMALL,

  // Produce sold by the piece
  onion: BY_COUNT,
  'red onion': BY_COUNT,
  garlic: BY_COUNT,
  apple: BY_COUNT,
  banana: BY_COUNT,
  orange: BY_COUNT,
  lemon: BY_COUNT,
  lime: BY_COUNT,
  avocado: BY_COUNT,
  cucumber: BY_COUNT,
  pepper: BY_COUNT,
  'bell pepper': BY_COUNT,
  aubergine: BY_COUNT,
  eggplant: BY_COUNT,
  courgette: BY_COUNT,
  zucchini: BY_COUNT,
  broccoli: BY_COUNT,
  cauliflower: BY_COUNT,
  lettuce: BY_COUNT,
  cabbage: BY_COUNT,
  celery: BY_COUNT,
  leek: BY_COUNT,
  corn: BY_COUNT,
  bread: BY_COUNT,
  tortilla: BY_COUNT,

  // Produce sold by weight
  potato: BY_WEIGHT_LARGE,
  'sweet potato': BY_WEIGHT_LARGE,
  carrot: BY_WEIGHT_SMALL,
  tomato: BY_WEIGHT_SMALL,
  mushroom: BY_WEIGHT_SMALL,
  grape: BY_WEIGHT_SMALL,
  strawberry: BY_WEIGHT_SMALL,
  blueberry: BY_WEIGHT_SMALL,
  raspberry: BY_WEIGHT_SMALL,
  spinach: BY_WEIGHT_SMALL,
  kale: BY_WEIGHT_SMALL,
  pea: BY_WEIGHT_SMALL,
  'frozen pea': BY_WEIGHT_SMALL,
  'green bean': BY_WEIGHT_SMALL,
  nut: BY_WEIGHT_SMALL,
  almond: BY_WEIGHT_SMALL,
  walnut: BY_WEIGHT_SMALL,
};

/** Fallbacks by word, for names the exact list does not carry. */
const KEYWORDS: [string, UnitPair][] = [
  ['mince', BY_WEIGHT_LARGE],
  ['steak', BY_WEIGHT_LARGE],
  ['fillet', BY_WEIGHT_SMALL],
  ['breast', BY_WEIGHT_LARGE],
  ['thigh', BY_WEIGHT_LARGE],
  ['cheese', BY_WEIGHT_SMALL],
  ['yoghurt', BY_WEIGHT_SMALL],
  ['yogurt', BY_WEIGHT_SMALL],
  ['milk', BY_VOLUME_JUG],
  ['cream', BY_VOLUME_CARTON],
  ['juice', BY_VOLUME_JUG],
  ['oil', BY_VOLUME_SMALL],
  ['sauce', BY_VOLUME_SMALL],
  ['syrup', BY_VOLUME_SMALL],
  ['vinegar', BY_VOLUME_SMALL],
  ['flour', BY_WEIGHT_LARGE],
  ['sugar', BY_WEIGHT_LARGE],
  ['rice', BY_WEIGHT_LARGE],
  ['pasta', BY_WEIGHT_SMALL],
  ['bean', BY_WEIGHT_SMALL],
  ['berry', BY_WEIGHT_SMALL],
  ['frozen', BY_WEIGHT_SMALL],
];

export function unitFromTable(rawName: string, system: UnitSystem): Unit | null {
  const normalized = normalizeIngredientName(rawName);
  if (!normalized) return null;

  const candidates = [normalized, singularize(normalized)];
  const words = normalized.split(' ');
  if (words.length > 1) {
    // "organic ground beef" should still find "ground beef".
    candidates.push(words.slice(-2).join(' '), singularize(words.slice(-2).join(' ')));
    candidates.push(words[words.length - 1]!, singularize(words[words.length - 1]!));
  }

  for (const candidate of candidates) {
    const pair = NAMES[candidate];
    if (pair) return system === UnitSystem.metric ? pair.metric : pair.imperial;
  }

  for (const [keyword, pair] of KEYWORDS) {
    if (normalized.includes(keyword)) {
      return system === UnitSystem.metric ? pair.metric : pair.imperial;
    }
  }

  return null;
}

export function tableSize(): number {
  return Object.keys(NAMES).length;
}
