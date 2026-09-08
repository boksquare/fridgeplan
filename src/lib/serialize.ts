import { Unit } from '@/generated/prisma/enums';
import type { CompartmentType, FridgeType } from '@/generated/prisma/enums';
import { expiryStatus, type ExpiryStatus } from '@/lib/expiry';

/**
 * Server components hand plain JSON to the client components: Decimal becomes
 * a number and dates become YYYY-MM-DD strings, which is also what the date
 * inputs and the API expect.
 */

export const UNITS: { value: Unit; label: string }[] = [
  { value: Unit.g, label: 'g' },
  { value: Unit.kg, label: 'kg' },
  { value: Unit.ml, label: 'ml' },
  { value: Unit.l, label: 'l' },
  { value: Unit.cup, label: 'cup' },
  { value: Unit.tbsp, label: 'tbsp' },
  { value: Unit.tsp, label: 'tsp' },
  { value: Unit.oz, label: 'oz' },
  { value: Unit.lb, label: 'lb' },
  { value: Unit.count, label: 'whole / count' },
];

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
