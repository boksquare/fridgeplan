import { Unit } from '@/generated/prisma/enums';
import type { CompartmentType, FridgeType } from '@/generated/prisma/enums';
import { expiryStatus, type ExpiryStatus } from '@/lib/expiry';

/**
 * Server components hand plain JSON to the client components: Decimal becomes
 * a number and dates become YYYY-MM-DD strings, which is also what the date
 * inputs and the API expect.
 */

/**
 * Every unit, grouped by what it measures.
 *
 * Two labels, because the two jobs differ. `label` is for a picker, where the
 * US-customary volumes are marked as such deliberately: a pint is 473 ml here
 * and 568 ml in the UK, and a cup is 236.6 ml against a metric 250 ml, so an
 * unqualified "pint" leaves the user to guess which one they chose. `short` is
 * for reading an amount back, where the choice has already been made and
 * "2 gallon (US)" is just noise.
 */
export const UNITS: { value: Unit; label: string; short: string }[] = [
  { value: Unit.g, label: 'g', short: 'g' },
  { value: Unit.kg, label: 'kg', short: 'kg' },
  { value: Unit.oz, label: 'oz', short: 'oz' },
  { value: Unit.lb, label: 'lb', short: 'lb' },
  { value: Unit.ml, label: 'ml', short: 'ml' },
  { value: Unit.l, label: 'l', short: 'l' },
  { value: Unit.tsp, label: 'tsp', short: 'tsp' },
  { value: Unit.tbsp, label: 'tbsp', short: 'tbsp' },
  { value: Unit.floz, label: 'fl oz (US)', short: 'fl oz' },
  { value: Unit.cup, label: 'cup (US)', short: 'cup' },
  { value: Unit.pt, label: 'pint (US)', short: 'pt' },
  { value: Unit.gal, label: 'gallon (US)', short: 'gal' },
  { value: Unit.count, label: 'whole / count', short: '' },
];

/** How to read an amount back to the user, e.g. "2 gal" or "3" for a count. */
export function formatAmount(quantity: number, unit: Unit): string {
  const found = UNITS.find((entry) => entry.value === unit);
  const short = found ? found.short : unit;
  return short ? `${quantity} ${short}` : `${quantity}`;
}

export type ClientItem = {
  id: string;
  ingredientName: string;
  quantity: number;
  unit: Unit;
  dateAdded: string;
  expirationDate: string | null;
};

export type ClientCompartment = {
  id: string;
  type: CompartmentType;
  label: string;
  position: number;
  items: ClientItem[];
};

export type ClientFridge = {
  id: string;
  name: string;
  type: FridgeType;
  compartments: ClientCompartment[];
};

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type ItemRow = {
  id: string;
  quantity: { toString(): string };
  unit: Unit;
  dateAdded: Date;
  expirationDate: Date | null;
  ingredient: { name: string };
};

export function serializeItem(item: ItemRow): ClientItem {
  return {
    id: item.id,
    ingredientName: item.ingredient.name,
    quantity: Number(item.quantity.toString()),
    unit: item.unit,
    dateAdded: toDateInputValue(item.dateAdded),
    expirationDate: item.expirationDate ? toDateInputValue(item.expirationDate) : null,
  };
}

export function serializeFridge(fridge: {
  id: string;
  name: string;
  type: FridgeType;
  compartments: {
    id: string;
    type: CompartmentType;
    label: string;
    position: number;
    items: ItemRow[];
  }[];
}): ClientFridge {
  return {
    id: fridge.id,
    name: fridge.name,
    type: fridge.type,
    compartments: fridge.compartments.map((compartment) => ({
      id: compartment.id,
      type: compartment.type,
      label: compartment.label,
      position: compartment.position,
      items: compartment.items.map(serializeItem),
    })),
  };
}

const SEVERITY: Record<ExpiryStatus, number> = { none: 0, fresh: 1, soon: 2, expired: 3 };

/** The most urgent expiry flag in a compartment, for the fridge illustration. */
export function worstExpiry(items: ClientItem[]): ExpiryStatus {
  return items.reduce<ExpiryStatus>((worst, item) => {
    const status = expiryStatus(item.expirationDate ? new Date(item.expirationDate) : null);
    return SEVERITY[status] > SEVERITY[worst] ? status : worst;
  }, 'none');
}
