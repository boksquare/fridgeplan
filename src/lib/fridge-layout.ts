import { CompartmentType, FridgeType } from '@/generated/prisma/enums';

/**
 * Turns a fridge's storage locations into the panels a real appliance actually
 * has, because the two are not the same thing: door bins and crisper drawers
 * live *behind* a door, they are not doors of their own. A top-freezer has one
 * full-width fridge door, a side-by-side has two full-height doors, and a
 * French door has a pair of equal doors above its drawers.
 *
 * Proportions come from the capacity split of a common model of each type,
 * which maps to panel size because the compartments share the cabinet's width
 * and depth:
 *
 * - French door — Samsung RF28R7201SR, 15.9 cu ft fresh / 8.3 freezer → 66/34
 * - Top freezer — GE GTS18GTHWW, 13.51 / 4.02 → 77/23
 * - Bottom freezer — Whirlpool WRB322DMBM, 15.65 / 6.45 → 71/29
 * - Side by side — Whirlpool WRS325SDHZ, 15.44 / 9.11 → 63/37 (by width)
 *
 * Pure and client-safe: the config builder previews layouts before anything is
 * saved.
 */

export type LayoutCompartment = {
  id: string;
  type: CompartmentType;
  label: string;
  position: number;
};

export type OpenStyle = 'door' | 'drawer';
export type Hinge = 'left' | 'right';

/** One physical door or drawer front, and the storage behind it. */
export type FridgePanel<T extends LayoutCompartment> = {
  id: string;
  label: string;
  opens: OpenStyle;
  hinge: Hinge;
  /** Share of its column's height. */
  grow: number;
  compartments: T[];
};

export type FridgeColumn<T extends LayoutCompartment> = {
  /** Share of the cabinet's width. */
  grow: number;
  panels: FridgePanel<T>[];
};

function take<T extends LayoutCompartment>(pool: T[], ...types: CompartmentType[]): T[] {
  const taken = pool.filter((compartment) => types.includes(compartment.type));
  for (const compartment of taken) pool.splice(pool.indexOf(compartment), 1);
  return taken;
}

function panel<T extends LayoutCompartment>(
  input: Omit<FridgePanel<T>, 'id'> & { id?: string },
): FridgePanel<T>[] {
  if (input.compartments.length === 0) return [];
  return [{ ...input, id: input.id ?? input.compartments[0]!.id }];
}

export function fridgePanels<T extends LayoutCompartment>(
  type: FridgeType,
  compartments: T[],
): FridgeColumn<T>[] {
  const pool = [...compartments].sort((a, b) => a.position - b.position);

  // Storage that sits behind the fridge door rather than being a door itself.
  const fridgeInside = take(
    pool,
    CompartmentType.fridge_main,
    CompartmentType.fridge_door,
    CompartmentType.crisper_drawer,
    CompartmentType.deli_drawer,
  );
  const freezerInside = take(pool, CompartmentType.freezer_door);
  const freezers = take(pool, CompartmentType.freezer);
  const middles = take(pool, CompartmentType.middle_drawer);
  const leftovers = pool;

  switch (type) {
    case FridgeType.french_door: {
      // A pair of equal doors over the drawers. Both open the same fresh-food
      // cabinet, which is how the appliance works.
      const middleShare = middles.length * 12;
      const topShare = Math.max(30, 66 - middles.length * 4);
      const freezerShare = Math.max(10, 100 - topShare - middleShare);

      return [
        {
          grow: 1,
          panels: [
            ...(fridgeInside.length > 0
              ? [
                  {
                    id: `${fridgeInside[0]!.id}-left`,
                    label: 'Left door',
                    opens: 'door' as const,
                    hinge: 'left' as const,
                    grow: topShare,
                    compartments: fridgeInside,
                  },
                  {
                    id: `${fridgeInside[0]!.id}-right`,
                    label: 'Right door',
                    opens: 'door' as const,
                    hinge: 'right' as const,
                    grow: topShare,
                    compartments: fridgeInside,
                  },
                ]
              : []),
            ...middles.flatMap((drawer) =>
              panel({
                label: drawer.label,
                opens: 'drawer',
                hinge: 'left',
                grow: 12,
                compartments: [drawer],
              }),
            ),
            ...freezers.flatMap((drawer) =>
              panel({
                label: drawer.label,
                opens: 'drawer',
                hinge: 'left',
                grow: freezerShare / freezers.length,
                compartments: [drawer],
              }),
            ),
            ...leftovers.flatMap((compartment) =>
              panel({
                label: compartment.label,
                opens: 'drawer',
                hinge: 'left',
                grow: 12,
                compartments: [compartment],
              }),
            ),
          ],
        },
      ];
    }

    case FridgeType.top_freezer:
      return [
        {
          grow: 1,
          panels: [
            ...panel({
              label: 'Freezer',
              opens: 'door',
              hinge: 'right',
              grow: 23,
              compartments: [...freezers, ...freezerInside],
            }),
            ...panel({
              label: 'Fridge',
              opens: 'door',
              hinge: 'right',
              grow: 77,
              compartments: [...fridgeInside, ...middles, ...leftovers],
            }),
          ],
        },
      ];

    case FridgeType.bottom_freezer:
      return [
        {
          grow: 1,
          panels: [
            ...panel({
              label: 'Fridge',
              opens: 'door',
              hinge: 'right',
              grow: 71,
              compartments: [...fridgeInside, ...middles, ...leftovers],
            }),
            ...freezers.flatMap((drawer, index) =>
              panel({
                label: drawer.label,
                opens: 'drawer',
                hinge: 'left',
                grow: 29 / freezers.length,
                // The freezer door bins belong with the first freezer drawer.
                compartments: index === 0 ? [drawer, ...freezerInside] : [drawer],
              }),
            ),
          ],
        },
      ];

    case FridgeType.side_by_side:
      return [
        {
          grow: 37,
          panels: panel({
            label: 'Freezer',
            opens: 'door',
            hinge: 'left',
            grow: 100,
            compartments: [...freezers, ...freezerInside],
          }),
        },
        {
          grow: 63,
          panels: panel({
            label: 'Fridge',
            opens: 'door',
            hinge: 'right',
            grow: 100,
            compartments: [...fridgeInside, ...middles, ...leftovers],
          }),
        },
      ];

    default:
      return [
        {
          grow: 1,
          panels: compartments.flatMap((compartment) =>
            panel({
              label: compartment.label,
              opens: 'door',
              hinge: 'right',
              grow: 1,
              compartments: [compartment],
            }),
          ),
        },
      ];
  }
}

export function isFreezerCompartment(type: CompartmentType): boolean {
  return type === CompartmentType.freezer || type === CompartmentType.freezer_door;
}

/** True when everything behind this panel is frozen storage. */
export function isFreezerPanel<T extends LayoutCompartment>(panelToCheck: FridgePanel<T>): boolean {
  return (
    panelToCheck.compartments.length > 0 &&
    panelToCheck.compartments.every((compartment) => isFreezerCompartment(compartment.type))
  );
}
