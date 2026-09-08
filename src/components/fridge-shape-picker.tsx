'use client';

import { useMemo } from 'react';
import { FridgeType } from '@/generated/prisma/enums';
import { DRAWER_LIMITS, FRIDGE_TYPES, defaultFridgeName, generateCompartments } from '@/lib/fridge-config';
import { FridgeIllustration } from '@/components/fridge-illustration';

export type FridgeShape = {
  type: FridgeType | null;
  name: string;
  middleDrawers: number;
  freezerDrawers: number;
};

export const EMPTY_SHAPE: FridgeShape = {
  type: null,
  name: '',
  middleDrawers: DRAWER_LIMITS.middleDrawers.default,
  freezerDrawers: DRAWER_LIMITS.freezerDrawers.default,
};

export function shapeToRequest(shape: FridgeShape) {
  if (!shape.type) throw new Error('Pick a fridge type first.');
  const configurable = FRIDGE_TYPES.find((entry) => entry.type === shape.type)?.configurable;
  return {
    type: shape.type,
    name: shape.name.trim() || defaultFridgeName(shape.type),
    config: configurable
      ? { middleDrawers: shape.middleDrawers, freezerDrawers: shape.freezerDrawers }
      : {},
  };
}

export function compartmentsForShape(shape: FridgeShape) {
  if (!shape.type) return [];
  return generateCompartments(shape.type, {
    middleDrawers: shape.middleDrawers,
    freezerDrawers: shape.freezerDrawers,
  }).map((compartment) => ({ ...compartment, id: `preview-${compartment.position}` }));
}

/**
 * Step 1 (type) and step 2 (drawer counts + name) of describing a fridge,
 * with a live preview. Shared by first-run creation, "add another fridge" and
 * the replace flow; the caller owns the submit button.
 */
export function FridgeShapePicker({
  value,
  onChange,
}: {
  value: FridgeShape;
  onChange: (shape: FridgeShape) => void;
}) {
  const configurable =
    FRIDGE_TYPES.find((entry) => entry.type === value.type)?.configurable ?? false;
  const previewCompartments = useMemo(() => compartmentsForShape(value), [value]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Step 1 — which fridge is it?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FRIDGE_TYPES.map((entry) => {
            const active = value.type === entry.type;
            return (
              <button
                key={entry.type}
                type="button"
                onClick={() => onChange({ ...value, type: entry.type })}
                aria-pressed={active}
                className={`flex flex-col gap-3 rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-slate-900 bg-white shadow-sm dark:border-white dark:bg-slate-900'
                    : 'border-slate-200 bg-white/60 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900/60'
                }`}
              >
                <div className="pointer-events-none w-full">
                  <FridgeIllustration
                    type={entry.type}
                    compartments={generateCompartments(entry.type, {}).map((compartment) => ({
                      ...compartment,
                      id: `${entry.type}-${compartment.position}`,
                    }))}
                    preview
                  />
                </div>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{entry.label}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {entry.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {value.type ? (
        <section className="flex flex-col gap-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {configurable ? 'Step 2 — how is it laid out?' : 'Step 2 — name it'}
          </h2>

          <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
            <div className="flex flex-col gap-5">
              {configurable ? (
                <>
                  <Stepper
                    label="Middle drawers"
                    hint="Deli or snack drawers between the fridge and the freezer."
                    value={value.middleDrawers}
                    min={DRAWER_LIMITS.middleDrawers.min}
                    max={DRAWER_LIMITS.middleDrawers.max}
                    onChange={(middleDrawers) => onChange({ ...value, middleDrawers })}
                  />
                  <Stepper
                    label="Freezer drawers"
                    hint="How many pull-out freezer drawers at the bottom."
                    value={value.freezerDrawers}
                    min={DRAWER_LIMITS.freezerDrawers.min}
                    max={DRAWER_LIMITS.freezerDrawers.max}
                    onChange={(freezerDrawers) => onChange({ ...value, freezerDrawers })}
                  />
                </>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {defaultFridgeName(value.type)} fridges have a fixed layout, so there is nothing
                  to configure here.
                </p>
              )}

              <label className="flex max-w-xs flex-col gap-1 text-sm">
                <span className="font-medium">Name (optional)</span>
                <input
                  type="text"
                  value={value.name}
                  maxLength={60}
                  placeholder={defaultFridgeName(value.type)}
                  onChange={(event) => onChange({ ...value, name: event.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Preview</p>
              <FridgeIllustration type={value.type} compartments={previewCompartments} preview />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {previewCompartments.length} compartments will be created.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`One fewer ${label.toLowerCase()}`}
            disabled={value <= min}
            onClick={() => onChange(Math.max(min, value - 1))}
            className="size-8 rounded-lg border border-slate-300 text-lg leading-none disabled:opacity-40 dark:border-slate-700"
          >
            −
          </button>
          <span aria-live="polite" className="w-6 text-center text-sm font-semibold">
            {value}
          </span>
          <button
            type="button"
            aria-label={`One more ${label.toLowerCase()}`}
            disabled={value >= max}
            onClick={() => onChange(Math.min(max, value + 1))}
            className="size-8 rounded-lg border border-slate-300 text-lg leading-none disabled:opacity-40 dark:border-slate-700"
          >
            +
          </button>
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
