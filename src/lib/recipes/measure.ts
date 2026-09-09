import { Unit } from '@/generated/prisma/enums';

/**
 * Recipe sources give measures as free text ("2 cups", "1/2 tsp", "200g",
 * "a pinch"). This turns what it can into a number plus one of our units and
 * leaves the rest as-is — the raw text is always kept, so nothing is lost when
 * parsing fails.
 */

const UNIT_WORDS: Record<string, Unit> = {
  g: Unit.g,
  gram: Unit.g,
  grams: Unit.g,
  gr: Unit.g,
  kg: Unit.kg,
  kilo: Unit.kg,
  kilos: Unit.kg,
  kilogram: Unit.kg,
  kilograms: Unit.kg,
  ml: Unit.ml,
  millilitre: Unit.ml,
  millilitres: Unit.ml,
  milliliter: Unit.ml,
  milliliters: Unit.ml,
  l: Unit.l,
  litre: Unit.l,
  litres: Unit.l,
  liter: Unit.l,
  liters: Unit.l,
  cup: Unit.cup,
  cups: Unit.cup,
  tbsp: Unit.tbsp,
  tbs: Unit.tbsp,
  tblsp: Unit.tbsp,
  tablespoon: Unit.tbsp,
  tablespoons: Unit.tbsp,
  tsp: Unit.tsp,
  teaspoon: Unit.tsp,
  teaspoons: Unit.tsp,
  oz: Unit.oz,
  ounce: Unit.oz,
  ounces: Unit.oz,
  lb: Unit.lb,
  lbs: Unit.lb,
  pound: Unit.lb,
  pounds: Unit.lb,
};

const VULGAR_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
};

export type ParsedMeasure = { quantity: number | null; unit: Unit | null; raw: string };

function parseAmount(text: string): { quantity: number; rest: string } | null {
  const trimmed = text.trimStart();

  // "1 1/2" or "1/2" — a mixed number or a bare fraction.
  const fraction = trimmed.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*(.*)$/u);
  if (fraction) {
    const [, whole, numerator, denominator, rest] = fraction;
    const denom = Number(denominator);
    if (denom !== 0) {
      const quantity = (whole ? Number(whole) : 0) + Number(numerator) / denom;
      return { quantity, rest: rest ?? '' };
    }
  }

  // "1½", "½", optionally after a whole number.
  const vulgar = trimmed.match(/^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔⅛])\s*(.*)$/u);
  if (vulgar) {
    const [, whole, glyph, rest] = vulgar;
    const quantity = (whole ? Number(whole) : 0) + (VULGAR_FRACTIONS[glyph!] ?? 0);
    return { quantity, rest: rest ?? '' };
  }

  // "2", "2.5"
  const plain = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/u);
  if (plain) return { quantity: Number(plain[1]), rest: plain[2] ?? '' };

  return null;
}

export function parseMeasure(raw: string): ParsedMeasure {
  const text = raw.trim();
  if (!text) return { quantity: null, unit: null, raw };

  const amount = parseAmount(text);
  if (!amount) {
    // Unit with no number ("pinch of salt", "to taste") stays unparsed.
    return { quantity: null, unit: null, raw };
  }

  const unitWord = amount.rest.trim().split(/[\s.,]+/)[0]?.toLowerCase() ?? '';

  // A number with no unit word we recognise is a count of the thing itself:
  // "3", "4 eggs", "2 cloves garlic".
  const unit = UNIT_WORDS[unitWord] ?? Unit.count;

  return {
    quantity: Number(amount.quantity.toFixed(3)),
    unit,
    raw,
  };
}

/** Normalized name for matching recipe ingredients to the dictionary. */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fresh|freshly|dried|chopped|minced|sliced|ground|large|small|medium|whole|boneless|skinless|extra|virgin|optional)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Crude singular form, enough to match "tomatoes" against "tomato". */
export function singularize(name: string): string {
  if (name.endsWith('ies') && name.length > 4) return `${name.slice(0, -3)}y`;
  if (name.endsWith('oes') && name.length > 4) return name.slice(0, -2);
  if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('hes')) return name.slice(0, -2);
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
  return name;
}
