import { CompartmentType, FridgeType } from '@/generated/prisma/enums';

/**
 * Turns a fridge's compartments into a visual layout so the illustration reads
 * as that real fridge type at a glance: a column is a full-height section, a
 * cell is a horizontal band, and a cell holding two compartments is a
 * side-by-side pair (French doors, or a compartment and its door shelves).
 *
 * Pure and client-safe — the config builder previews layouts before anything
 * is saved.
 */

export type LayoutCompartment = {
  id: string;
  type: CompartmentType;
  label: string;
  position: number;
};

export type LayoutCell<T extends LayoutCompartment> = { grow: number; compartments: T[] };
export type LayoutColumn<T extends LayoutCompartment> = { grow: number; cells: LayoutCell<T>[] };

function pick<T extends LayoutCompartment>(pool: T[], type: CompartmentType): T[] {
  const taken = pool.filter((compartment) => compartment.type === type);
  for (const compartment of taken) pool.splice(pool.indexOf(compartment), 1);
  return taken;
}

function cell<T extends LayoutCompartment>(grow: number, compartments: (T | undefined)[]) {
  const present = compartments.filter((compartment): compartment is T => Boolean(compartment));
  return present.length > 0 ? [{ grow, compartments: present }] : [];
}

export function fridgeLayout<T extends LayoutCompartment>(
  type: FridgeType,
  compartments: T[],
): LayoutColumn<T>[] {
  // Copy: pick() consumes the pool as it assigns compartments to cells.
  const pool = [...compartments].sort((a, b) => a.position - b.position);

  const main = pick(pool, CompartmentType.fridge_main);
  const fridgeDoor = pick(pool, CompartmentType.fridge_door);
  const freezers = pick(pool, CompartmentType.freezer);
  const freezerDoor = pick(pool, CompartmentType.freezer_door);
  const middles = pick(pool, CompartmentType.middle_drawer);
  const crispers = pick(pool, CompartmentType.crisper_drawer);
  const rest = pool;

  const single = (cells: LayoutCell<T>[]): LayoutColumn<T>[] => [{ grow: 1, cells }];
  const leftovers = rest.flatMap((compartment) => cell(1, [compartment]));

  switch (type) {
    case FridgeType.french_door:
      return single([
        ...cell(3, [main[0], fridgeDoor[0]]),
        ...middles.flatMap((drawer) => cell(1, [drawer])),
        ...crispers.flatMap((drawer) => cell(1, [drawer])),
        ...freezers.flatMap((drawer) => cell(1.2, [drawer])),
        ...leftovers,
      ]);

    case FridgeType.top_freezer:
      return single([
        ...cell(1.3, [freezers[0], freezerDoor[0]]),
        ...cell(3, [main[0], fridgeDoor[0]]),
        ...crispers.flatMap((drawer) => cell(1, [drawer])),
        ...freezers.slice(1).flatMap((drawer) => cell(1.2, [drawer])),
        ...leftovers,
      ]);

    case FridgeType.bottom_freezer:
      return single([
        ...cell(3, [main[0], fridgeDoor[0]]),
        ...crispers.flatMap((drawer) => cell(1, [drawer])),
        ...middles.flatMap((drawer) => cell(1, [drawer])),
        ...freezers.flatMap((drawer) => cell(1.4, [drawer])),
        ...leftovers,
      ]);

    case FridgeType.side_by_side:
      return [
        {
          grow: 2,
          cells: [...cell(3, [freezers[0]]), ...cell(1, [freezerDoor[0]])],
        },
        {
          grow: 3,
          cells: [
            ...cell(3, [main[0]]),
            ...cell(1, [fridgeDoor[0]]),
            ...crispers.flatMap((drawer) => cell(1, [drawer])),
            ...middles.flatMap((drawer) => cell(1, [drawer])),
            ...leftovers,
          ],
        },
      ];

    default:
      return single(compartments.flatMap((compartment) => cell(1, [compartment])));
  }
}

export function isFreezerCompartment(type: CompartmentType): boolean {
  return type === CompartmentType.freezer || type === CompartmentType.freezer_door;
}

export type OpenStyle = 'door' | 'drawer';
export type Hinge = 'left' | 'right';

/**
 * How a compartment opens, which is a property of the fridge as a whole rather
 * than of the compartment type alone: a French door's freezer pulls out as a
 * drawer, while a side-by-side's swings open on a hinge.
 */
export function compartmentOpensAs(
  fridgeType: FridgeType,
  compartmentType: CompartmentType,
): OpenStyle {
  switch (compartmentType) {
    case CompartmentType.middle_drawer:
    case CompartmentType.crisper_drawer:
    case CompartmentType.deli_drawer:
      return 'drawer';
    case CompartmentType.freezer:
      return fridgeType === FridgeType.french_door || fridgeType === FridgeType.bottom_freezer
        ? 'drawer'
        : 'door';
    default:
      return 'door';
  }
}

/**
 * Which edge a door is hinged on, so handles meet in the middle the way they do
 * on a real appliance: two doors sharing a band are a French pair and open away
 * from each other, and in a two-column cabinet each column's doors hinge on
 * that column's outer edge.
 */
export function hingeFor(
  indexInCell: number,
  cellSize: number,
  columnIndex = 0,
  columnCount = 1,
): Hinge {
  if (cellSize >= 2) return indexInCell === 0 ? 'left' : 'right';
  if (columnCount >= 2) return columnIndex === 0 ? 'left' : 'right';
  return 'left';
}
