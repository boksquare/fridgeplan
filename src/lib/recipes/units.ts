import { Unit } from '@/generated/prisma/enums';

/**
 * Unit conversion, client-safe.
 *
 * Every unit belongs to a family and carries its size in that family's base
 * unit (grams for mass, millilitres for volume). Conversion is then a ratio
 * within one family, and anything across families — grams to millilitres, or
 * either to a count — has no answer without knowing the ingredient's density,
 * so it returns null and the user is asked instead of guessed at.
 *
 * The volume units are **US customary**, which matters: a US pint is 473 ml but
 * a UK pint is 568 ml, and a US gallon is 3.79 l against the UK's 4.55 l. The
 * app's "imperial" setting means US customary throughout, and the unit labels
 * say so, because silently picking one of the two would quietly misstate a
 * gallon of milk by three quarters of a litre.
 */
type Family = 'mass' | 'volume' | 'count';

const FAMILY: Record<Unit, Family> = {
  [Unit.g]: 'mass',
  [Unit.kg]: 'mass',
  [Unit.oz]: 'mass',
  [Unit.lb]: 'mass',
  [Unit.ml]: 'volume',
  [Unit.l]: 'volume',
  [Unit.tsp]: 'volume',
  [Unit.tbsp]: 'volume',
  [Unit.floz]: 'volume',
  [Unit.cup]: 'volume',
  [Unit.pt]: 'volume',
  [Unit.gal]: 'volume',
  [Unit.count]: 'count',
};

/** Size of one of each unit, in grams or millilitres. */
const IN_BASE: Record<Unit, number> = {
  [Unit.g]: 1,
  [Unit.kg]: 1000,
  [Unit.oz]: 28.349523125,
  [Unit.lb]: 453.59237,

  [Unit.ml]: 1,
  [Unit.l]: 1000,
  // US customary, defined off the gallon: 231 cubic inches exactly.
  [Unit.tsp]: 4.92892159375,
  [Unit.tbsp]: 14.78676478125,
  [Unit.floz]: 29.5735295625,
  [Unit.cup]: 236.5882365,
  [Unit.pt]: 473.176473,
  [Unit.gal]: 3785.411784,

  // A count has no size: it never converts to or from anything else.
  [Unit.count]: 1,
};

export function unitFamily(unit: Unit): Family {
  return FAMILY[unit];
}

/** Do these two units measure the same kind of thing? */
export function unitsReconcile(a: Unit, b: Unit): boolean {
  if (a === b) return true;
  if (FAMILY[a] !== FAMILY[b]) return false;
  // Two counts are the same unit; different counts do not exist.
  return FAMILY[a] !== 'count';
}

/**
 * Converts an amount between units, or null when the two do not reconcile —
 * in which case the user is asked rather than a guess being made.
 */
export function convertAmount(quantity: number, from: Unit, to: Unit): number | null {
  if (from === to) return quantity;
  if (!unitsReconcile(from, to)) return null;
  return Number(((quantity * IN_BASE[from]) / IN_BASE[to]).toFixed(3));
}
