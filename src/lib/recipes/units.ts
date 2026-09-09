import { Unit } from '@/generated/prisma/enums';

/** Units that convert cleanly within the same family. Client-safe. */
const CONVERSIONS: Partial<Record<Unit, Partial<Record<Unit, number>>>> = {
  [Unit.kg]: { [Unit.g]: 1000 },
  [Unit.g]: { [Unit.kg]: 0.001 },
  [Unit.l]: { [Unit.ml]: 1000 },
  [Unit.ml]: { [Unit.l]: 0.001 },
  [Unit.lb]: { [Unit.oz]: 16 },
  [Unit.oz]: { [Unit.lb]: 0.0625 },
  [Unit.tbsp]: { [Unit.tsp]: 3 },
  [Unit.tsp]: { [Unit.tbsp]: 1 / 3 },
};

/**
 * Converts an amount between units, or null when the two do not reconcile
 * cleanly — in which case the user is asked rather than a guess being made.
 */
export function convertAmount(quantity: number, from: Unit, to: Unit): number | null {
  if (from === to) return quantity;
  const factor = CONVERSIONS[from]?.[to];
  return factor === undefined ? null : Number((quantity * factor).toFixed(3));
}
