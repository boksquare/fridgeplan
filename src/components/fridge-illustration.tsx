'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { compartmentOpensAs, fridgeLayout, hingeFor, isFreezerCompartment } from '@/lib/fridge-layout';
import type { LayoutCompartment } from '@/lib/fridge-layout';
import type { ExpiryStatus } from '@/lib/expiry';
import type { FridgeType } from '@/generated/prisma/enums';

export type IllustratedCompartment = LayoutCompartment & {
  itemCount?: number;
  worstExpiry?: ExpiryStatus;
  /** Shown on the shelves once the compartment is open. */
  itemLabels?: { id: string; label: string; expiry: ExpiryStatus }[];
};

type Props = {
  type: FridgeType;
  compartments: IllustratedCompartment[];
  selectedId?: string | null;
  onSelect?: (compartmentId: string) => void;
  /** Non-interactive mode for the config builder's live preview. */
  preview?: boolean;
};

/** Springs tuned to feel like weight on hinges rather than a UI transition. */
const DOOR_SPRING = { type: 'spring', stiffness: 130, damping: 16, mass: 1 } as const;
const DRAWER_SPRING = { type: 'spring', stiffness: 210, damping: 24, mass: 0.7 } as const;
const BODY_SPRING = { type: 'spring', stiffness: 90, damping: 18, mass: 1 } as const;

/** A door swings wide, the way you actually open a fridge to look inside. */
const DOOR_ANGLE = 84;
/** Three-quarter product view when everything is shut. */
const BASE_TILT = -12;
/**
 * With a door open the cabinet turns towards that door's hinge — the side you
 * would stand on to look in. Turning the other way puts the swinging door
 * edge-on to the viewer, where it reads as having vanished.
 */
const TILT_OPEN = 24;
/**
 * A door this wide open reaches past the cabinet, so the body slides the other
 * way to keep both the door and the open cavity in frame.
 */
const PAN_OPEN = 21;

/**
 * The fridge, in three dimensions: the cabinet is a real box in CSS 3D, doors
 * swing out on their hinge and drawers travel towards the viewer, and the light
 * inside comes on when something is open.
 */
export function FridgeIllustration({ type, compartments, selectedId, onSelect, preview }: Props) {
  const columns = fridgeLayout(type, compartments);
  const reduceMotion = useReducedMotion();
  const interactive = Boolean(onSelect) && !preview;

  // Which way the open compartment faces, so the cabinet can turn towards it
  // and the swing stays in front of the body rather than behind it.
  const openHinge = (() => {
    if (!selectedId) return null;
    for (const [columnIndex, column] of columns.entries()) {
      for (const cell of column.cells) {
        const indexInCell = cell.compartments.findIndex((entry) => entry.id === selectedId);
        if (indexInCell === -1) continue;
        if (compartmentOpensAs(type, cell.compartments[indexInCell]!.type) !== 'door') return null;
        return hingeFor(indexInCell, cell.compartments.length, columnIndex, columns.length);
      }
    }
    return null;
  })();

  const bodyTilt =
    openHinge === 'left' ? TILT_OPEN : openHinge === 'right' ? -TILT_OPEN : BASE_TILT;

  return (
    <div
      className="fridge-scene"
      data-preview={preview ? 'true' : 'false'}
      style={
        preview
          ? ({ '--fridge-depth': '20px', '--bezel': '5px', '--gap': '3px' } as React.CSSProperties)
          : undefined
      }
    >
      {/* Kept outside the 3D subtree: a blurred layer inside preserve-3d
          composites unreliably. */}
      {preview ? null : <div className="fridge-shadow" aria-hidden />}

      <motion.div
        className="fridge-body"
        // A preview is read as a picture, so it faces the reader squarely.
        data-tilt={preview ? 'flat' : 'three-quarter'}
        role={preview ? 'img' : 'group'}
        aria-label={preview ? 'Preview of your fridge layout' : 'Your fridge'}
        animate={
          preview
            ? { rotateX: 0, rotateY: 0, x: 0 }
            : {
                rotateX: 3,
                rotateY: bodyTilt,
                x: openHinge === 'left' ? `${PAN_OPEN}%` : openHinge === 'right' ? `-${PAN_OPEN}%` : 0,
              }
        }
        transition={reduceMotion ? { duration: 0 } : BODY_SPRING}
      >
        <div className="fridge-face fridge-face--right" aria-hidden />
        <div className="fridge-face fridge-face--top" aria-hidden />

        <div className="fridge-cabinet">
          {columns.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className="fridge-column"
              style={{ flexGrow: column.grow }}
            >
              {column.cells.map((cell, cellIndex) => (
                <div key={cellIndex} className="fridge-band" style={{ flexGrow: cell.grow }}>
                  {cell.compartments.map((compartment, indexInCell) => {
                    const open = selectedId === compartment.id;
                    const opens = compartmentOpensAs(type, compartment.type);
                    const hinge = hingeFor(
                      indexInCell,
                      cell.compartments.length,
                      columnIndex,
                      columns.length,
                    );
                    const expiry = compartment.worstExpiry ?? 'none';
                    const flagged = expiry === 'soon' || expiry === 'expired';

                    // rotateY(+θ) sends an element's right edge away from the
                    // viewer, so a left-hinged door opens on a negative angle
                    // and a right-hinged one on a positive angle.
                    const panelMotion =
                      opens === 'door'
                        ? {
                            rotateY: open ? (hinge === 'left' ? -DOOR_ANGLE : DOOR_ANGLE) : 0,
                          }
                        : {
                            // A drawer comes out and dips very slightly.
                            z: open ? 62 : 0,
                            y: open ? 6 : 0,
                          };

                    return (
                      <div
                        key={compartment.id}
                        className="fridge-cell"
                        data-open={open}
                        data-freezer={isFreezerCompartment(compartment.type)}
                      >
                        <div className="fridge-interior" aria-hidden={!open}>
                          {open && opens === 'door' && compartment.itemLabels ? (
                            <div className="fridge-chips">
                              {compartment.itemLabels.slice(0, 12).map((item) => (
                                <span
                                  key={item.id}
                                  className="fridge-chip"
                                  data-expiry={item.expiry}
                                >
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {/* An open door has swung away from the viewer, so the
                            cavity itself is what you push to shut it. It stays
                            mounted while shut — merely inert — so that closing
                            never hands the same click to the door behind it. */}
                        {interactive ? (
                          <button
                            type="button"
                            className="fridge-close"
                            data-open={open}
                            disabled={!open}
                            aria-hidden={!open}
                            tabIndex={open ? 0 : -1}
                            onClick={() => onSelect?.(compartment.id)}
                            aria-label={`Close ${compartment.label}`}
                          >
                            <span className="fridge-close-pill">Close</span>
                          </button>
                        ) : null}

                        <motion.button
                          type="button"
                          className={`fridge-panel${interactive ? '' : ' fridge-panel--static'}`}
                          data-opens={opens}
                          style={{
                            transformOrigin:
                              opens === 'door'
                                ? hinge === 'left'
                                  ? 'left center'
                                  : 'right center'
                                : 'center bottom',
                            transformStyle: 'preserve-3d',
                          }}
                          disabled={!interactive}
                          aria-expanded={interactive ? open : undefined}
                          aria-label={
                            interactive
                              ? `${compartment.label}${
                                  compartment.itemCount === undefined
                                    ? ''
                                    : `, ${compartment.itemCount} item${compartment.itemCount === 1 ? '' : 's'}`
                                }${flagged ? `, ${expiry === 'expired' ? 'has expired items' : 'has items expiring soon'}` : ''}`
                              : undefined
                          }
                          onClick={interactive ? () => onSelect?.(compartment.id) : undefined}
                          animate={panelMotion}
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : opens === 'door'
                                ? DOOR_SPRING
                                : DRAWER_SPRING
                          }
                          whileHover={
                            interactive && !open && !reduceMotion
                              ? opens === 'door'
                                ? { rotateY: hinge === 'left' ? -7 : 7 }
                                : { z: 10 }
                              : undefined
                          }
                        >
                          <span className="fridge-panel-back" aria-hidden />
                          {flagged && !open ? (
                            <span className="fridge-flag" data-expiry={expiry}>
                              <svg viewBox="0 0 20 20" aria-hidden className="size-3 fill-current">
                                {expiry === 'expired' ? (
                                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.9 4l-.15 5.5h-1.5L9.1 6h1.8zM10 15.2a1.05 1.05 0 110-2.1 1.05 1.05 0 010 2.1z" />
                                ) : (
                                  <path d="M10 2.5l7.5 13H2.5L10 2.5zm.85 5h-1.7l.15 4.4h1.4l.15-4.4zM10 14.9a1 1 0 110-2 1 1 0 010 2z" />
                                )}
                              </svg>
                              {expiry === 'expired' ? 'Expired' : 'Use soon'}
                            </span>
                          ) : null}

                          {/* The handle is part of the door's shape, so it
                              travels with it. */}
                          <span
                            className={`fridge-handle fridge-handle--${opens}`}
                            data-hinge={hinge}
                            aria-hidden
                          />

                          {open && opens === 'drawer' && compartment.itemLabels?.length ? (
                            <span className="fridge-tray">
                              {compartment.itemLabels.slice(0, 8).map((item) => (
                                <span key={item.id} className="fridge-chip" data-expiry={item.expiry}>
                                  {item.label}
                                </span>
                              ))}
                            </span>
                          ) : null}

                          {open && opens === 'drawer' ? null : (
                            <span className="fridge-label">{compartment.label}</span>
                          )}
                          {compartment.itemCount === undefined || (open && opens === 'drawer') ? null : (
                            <span className="fridge-sublabel">
                              {compartment.itemCount === 0
                                ? 'Empty'
                                : `${compartment.itemCount} item${compartment.itemCount === 1 ? '' : 's'}`}
                            </span>
                          )}
                        </motion.button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
