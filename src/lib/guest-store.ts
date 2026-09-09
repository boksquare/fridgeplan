'use client';

import { generateCompartments } from '@/lib/fridge-config';
import type { FridgeConfig } from '@/lib/fridge-config';
import type { CompartmentType, FridgeType, Unit } from '@/generated/prisma/enums';

/**
 * Guest mode keeps everything in this browser and nothing on the server: no
 * account, no rows, gone when the browser data is cleared. The shape mirrors
 * the server model so a guest's fridge could later be imported into an account
 * without redesigning anything.
 */

export const GUEST_STORAGE_KEY = 'fridgeplan.guest.v1';

export type GuestItem = {
  id: string;
  ingredientName: string;
  quantity: number;
  unit: Unit;
  dateAdded: string;
  expirationDate: string | null;
};

export type GuestCompartment = {
  id: string;
  type: CompartmentType;
  label: string;
  position: number;
  items: GuestItem[];
};

export type GuestFridgeState = {
  id: string;
  name: string;
  type: FridgeType;
  config: FridgeConfig;
  compartments: GuestCompartment[];
};

function newId(): string {
  // randomUUID needs a secure context; fall back for plain http self-hosting.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `g${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function parse(raw: string | null): GuestFridgeState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GuestFridgeState;
    return parsed?.compartments ? parsed : null;
  } catch {
    // Corrupt storage: start over rather than crash.
    return null;
  }
}

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state. The snapshot is memoised
 * because that hook requires a stable reference between renders, and the
 * subscription picks up changes made in another tab for free.
 */
let cachedRaw: string | null = null;
let cachedValue: GuestFridgeState | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(GUEST_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function subscribeToGuestFridge(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === GUEST_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function getGuestFridgeSnapshot(): GuestFridgeState | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

/** There is no guest fridge on the server: it only exists in the browser. */
export function getGuestFridgeServerSnapshot(): GuestFridgeState | null {
  return null;
}

export function saveGuestFridge(state: GuestFridgeState | null) {
  if (typeof window === 'undefined') return;
  try {
    if (state) window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // Private mode or a full quota: the session simply is not persisted.
  }
  cachedRaw = readRaw();
  cachedValue = state;
  for (const listener of listeners) listener();
}

export function createGuestFridge(input: {
  name: string;
  type: FridgeType;
  config: FridgeConfig;
}): GuestFridgeState {
  return {
    id: newId(),
    name: input.name,
    type: input.type,
    config: input.config,
    // The same generator the server uses, so a guest fridge has the same shape.
    compartments: generateCompartments(input.type, input.config).map((compartment) => ({
      ...compartment,
      id: newId(),
      items: [],
    })),
  };
}

export function addGuestItem(
  state: GuestFridgeState,
  compartmentId: string,
  item: Omit<GuestItem, 'id'>,
): GuestFridgeState {
  return {
    ...state,
    compartments: state.compartments.map((compartment) =>
      compartment.id === compartmentId
        ? { ...compartment, items: [...compartment.items, { ...item, id: newId() }] }
        : compartment,
    ),
  };
}

export function updateGuestItem(
  state: GuestFridgeState,
  itemId: string,
  patch: Partial<Omit<GuestItem, 'id'>>,
): GuestFridgeState {
  return {
    ...state,
    compartments: state.compartments.map((compartment) => ({
      ...compartment,
      items: compartment.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    })),
  };
}

export function removeGuestItem(state: GuestFridgeState, itemId: string): GuestFridgeState {
  return {
    ...state,
    compartments: state.compartments.map((compartment) => ({
      ...compartment,
      items: compartment.items.filter((item) => item.id !== itemId),
    })),
  };
}

export function guestInventory(state: GuestFridgeState) {
  return state.compartments.flatMap((compartment) =>
    compartment.items.map((item) => ({
      itemId: item.id,
      ingredientName: item.ingredientName,
      quantity: item.quantity,
      unit: item.unit,
      compartmentLabel: compartment.label,
    })),
  );
}
