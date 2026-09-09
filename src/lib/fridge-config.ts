import { z } from 'zod';
import { FridgeType, CompartmentType } from '@/generated/prisma/enums';

/**
 * A fridge's compartments are generated from its type plus a small config
 * object, never picked from a fixed set of layout presets — so "French door
 * with 2 middle drawers and 1 freezer drawer" is a shape we compute rather
 * than a preset we hard-code.
 */

export const FRIDGE_TYPES = [
  {
    type: FridgeType.french_door,
    label: 'French door',
    description: 'Two doors over a full-width freezer drawer.',
    configurable: true,
  },
  {
    type: FridgeType.top_freezer,
    label: 'Top freezer',
    description: 'Small freezer above one tall fridge door.',
    configurable: false,
  },
  {
    type: FridgeType.bottom_freezer,
    label: 'Bottom freezer',
    description: 'One tall fridge door over a freezer drawer.',
    configurable: false,
  },
  {
    type: FridgeType.side_by_side,
    label: 'Side by side',
    description: 'Two full-height doors, narrower freezer.',
    configurable: false,
  },
] as const;

export const DRAWER_LIMITS = {
  middleDrawers: { min: 0, max: 3, default: 1 },
  freezerDrawers: { min: 1, max: 3, default: 1 },
} as const;

export const fridgeConfigSchema = z.object({
  middleDrawers: z
    .number()
    .int()
    .min(DRAWER_LIMITS.middleDrawers.min)
    .max(DRAWER_LIMITS.middleDrawers.max)
    .optional(),
  freezerDrawers: z
    .number()
    .int()
    .min(DRAWER_LIMITS.freezerDrawers.min)
    .max(DRAWER_LIMITS.freezerDrawers.max)
    .optional(),
});

export type FridgeConfig = z.infer<typeof fridgeConfigSchema>;

export type GeneratedCompartment = {
  type: CompartmentType;
  label: string;
  position: number;
};

/**
 * Only French door takes drawer counts today. Other types ignore the config
 * rather than rejecting it, so a stray value never blocks fridge creation.
 */
export function normalizeConfig(type: FridgeType, config: FridgeConfig): FridgeConfig {
  if (type !== FridgeType.french_door) return {};
  return {
    middleDrawers: config.middleDrawers ?? DRAWER_LIMITS.middleDrawers.default,
    freezerDrawers: config.freezerDrawers ?? DRAWER_LIMITS.freezerDrawers.default,
  };
}

export function generateCompartments(
  type: FridgeType,
  rawConfig: FridgeConfig,
): GeneratedCompartment[] {
  const config = normalizeConfig(type, rawConfig);
  const compartments: Omit<GeneratedCompartment, 'position'>[] = [];

  switch (type) {
    case FridgeType.french_door: {
      compartments.push({ type: CompartmentType.fridge_main, label: 'Fridge' });
      compartments.push({ type: CompartmentType.fridge_door, label: 'Door shelves' });
      // Behind the doors, like the humidity crispers on a real French door.
      compartments.push({ type: CompartmentType.crisper_drawer, label: 'Crisper drawer' });
      const middle = config.middleDrawers ?? 0;
      for (let i = 1; i <= middle; i += 1) {
        compartments.push({
          type: CompartmentType.middle_drawer,
          label: middle === 1 ? 'Middle drawer' : `Middle drawer ${i}`,
        });
      }
      const freezer = config.freezerDrawers ?? 1;
      for (let i = 1; i <= freezer; i += 1) {
        compartments.push({
          type: CompartmentType.freezer,
          label: freezer === 1 ? 'Freezer drawer' : `Freezer drawer ${i}`,
        });
      }
      break;
    }
    case FridgeType.top_freezer: {
      compartments.push({ type: CompartmentType.freezer, label: 'Freezer' });
      compartments.push({ type: CompartmentType.fridge_main, label: 'Fridge' });
      compartments.push({ type: CompartmentType.fridge_door, label: 'Door shelves' });
      compartments.push({ type: CompartmentType.crisper_drawer, label: 'Crisper drawer' });
      break;
    }
    case FridgeType.bottom_freezer: {
      compartments.push({ type: CompartmentType.fridge_main, label: 'Fridge' });
      compartments.push({ type: CompartmentType.fridge_door, label: 'Door shelves' });
      compartments.push({ type: CompartmentType.crisper_drawer, label: 'Crisper drawer' });
      compartments.push({ type: CompartmentType.freezer, label: 'Freezer drawer' });
      break;
    }
    case FridgeType.side_by_side: {
      compartments.push({ type: CompartmentType.freezer, label: 'Freezer' });
      compartments.push({ type: CompartmentType.freezer_door, label: 'Freezer door' });
      compartments.push({ type: CompartmentType.fridge_main, label: 'Fridge' });
      compartments.push({ type: CompartmentType.fridge_door, label: 'Door shelves' });
      compartments.push({ type: CompartmentType.crisper_drawer, label: 'Crisper drawer' });
      break;
    }
  }

  return compartments.map((compartment, index) => ({ ...compartment, position: index }));
}

export function defaultFridgeName(type: FridgeType): string {
  return FRIDGE_TYPES.find((entry) => entry.type === type)?.label ?? 'Fridge';
}
