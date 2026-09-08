'use client';

import { motion } from 'framer-motion';
import { fridgeLayout, isFreezerCompartment } from '@/lib/fridge-layout';
import type { LayoutCompartment } from '@/lib/fridge-layout';
import type { ExpiryStatus } from '@/lib/expiry';
import type { FridgeType } from '@/generated/prisma/enums';

export type IllustratedCompartment = LayoutCompartment & {
  itemCount?: number;
  worstExpiry?: ExpiryStatus;
};

type Props = {
  type: FridgeType;
  compartments: IllustratedCompartment[];
  selectedId?: string | null;
  onSelect?: (compartmentId: string) => void;
  /** Non-interactive mode for the config builder's live preview. */
  preview?: boolean;
};

const EXPIRY_DOT: Record<ExpiryStatus, string | null> = {
  none: null,
  fresh: null,
  soon: 'bg-amber-500',
  expired: 'bg-red-600',
};

/**
 * The fridge itself, as the interface. Drawers slide out and doors tilt open
 * when picked; the full visual/animation pass is Phase 3, so this keeps the
 * motion functional rather than decorative.
 */
export function FridgeIllustration({ type, compartments, selectedId, onSelect, preview }: Props) {
  const columns = fridgeLayout(type, compartments);

  return (
    <div
      className="mx-auto flex aspect-[3/4] w-full max-w-sm gap-1.5 rounded-2xl border border-fridge-line/60 bg-fridge-shell p-2 shadow-lg shadow-slate-900/10 dark:bg-slate-800"
      role={preview ? 'img' : 'group'}
      aria-label={preview ? 'Preview of your fridge layout' : undefined}
    >
      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className="flex min-w-0 flex-col gap-1.5"
          style={{ flexGrow: column.grow, flexBasis: 0 }}
        >
          {column.cells.map((cell, cellIndex) => (
            <div
              key={cellIndex}
              className="flex min-h-0 gap-1.5"
              style={{ flexGrow: cell.grow, flexBasis: 0 }}
            >
              {cell.compartments.map((compartment) => {
                const selected = selectedId === compartment.id;
                const freezer = isFreezerCompartment(compartment.type);
                const dot = EXPIRY_DOT[compartment.worstExpiry ?? 'none'];
                const label = (
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                    <span className="flex items-center gap-1.5">
                      {dot ? (
                        <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                      ) : null}
                      <span className="truncate text-xs font-medium">{compartment.label}</span>
                    </span>
                    {compartment.itemCount === undefined ? null : (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {compartment.itemCount === 0
                          ? 'Empty'
                          : `${compartment.itemCount} item${compartment.itemCount === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </span>
                );

                const surface = freezer
                  ? 'bg-sky-100/80 dark:bg-sky-950/50'
                  : 'bg-white/90 dark:bg-slate-900/70';
                const border = selected
                  ? 'border-slate-900 dark:border-white'
                  : 'border-fridge-line/50';

                if (preview || !onSelect) {
                  return (
                    <div
                      key={compartment.id}
                      className={`flex min-w-0 flex-1 items-end rounded-lg border p-2 ${surface} ${border}`}
                    >
                      {label}
                    </div>
                  );
                }

                return (
                  <motion.button
                    key={compartment.id}
                    type="button"
                    onClick={() => onSelect(compartment.id)}
                    aria-pressed={selected}
                    // Drawers pull out towards the viewer; doors swing open.
                    animate={
                      selected
                        ? compartment.type.includes('drawer')
                          ? { y: 6, scale: 1.02 }
                          : { rotateY: -12, x: -4 }
                        : { y: 0, x: 0, rotateY: 0, scale: 1 }
                    }
                    transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    style={{ transformPerspective: 900, transformOrigin: 'left center' }}
                    className={`flex min-w-0 flex-1 cursor-pointer items-end rounded-lg border p-2 text-left transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white ${surface} ${border}`}
                  >
                    {label}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
