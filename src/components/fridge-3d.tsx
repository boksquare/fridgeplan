'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fridgePanels } from '@/lib/fridge-layout';
import { FridgeScene, type SceneCompartment } from '@/lib/fridge3d/scene';
import type { FridgeType } from '@/generated/prisma/enums';
import type { ExpiryStatus } from '@/lib/expiry';

type Props = {
  type: FridgeType;
  compartments: SceneCompartment[];
  /** The open panel: a physical door or drawer. */
  selectedId?: string | null;
  onSelect?: (panelId: string, compartmentIds: string[]) => void;
  /** A still of the appliance: no picking, no control row. */
  preview?: boolean;
};

const SEVERITY: Record<ExpiryStatus, number> = { none: 0, fresh: 1, soon: 2, expired: 3 };

/**
 * The interactive fridge. The canvas is the picture; the buttons under it are
 * the controls, so opening a door works the same by keyboard, screen reader and
 * thumb as it does by clicking the model.
 */
export function Fridge3D({ type, compartments, selectedId, onSelect, preview }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FridgeScene | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  const columns = fridgePanels(type, compartments);
  const panels = columns.flatMap((column) => column.panels);

  // Rebuilding the geometry on every render would thrash the GPU, so the
  // rebuild keys on the shape and contents rather than array identity.
  const modelSignature = useMemo(
    () =>
      JSON.stringify(
        columns.map((column) => ({
          grow: column.grow,
          panels: column.panels.map((panel) => ({
            id: panel.id,
            grow: panel.grow,
            opens: panel.opens,
            hinge: panel.hinge,
            items: panel.compartments.flatMap((compartment) =>
              (compartment.itemLabels ?? []).map((item) => `${item.id}:${item.expiry}`),
            ),
          })),
        })),
      ),
    [columns],
  );

  // The renderer starts a frame after mount, so it reads the current model from
  // here rather than from a closure captured at mount time. Written before the
  // effects that read it.
  const latest = useRef({ columns, open: selectedId ?? null });
  useEffect(() => {
    latest.current = { columns, open: selectedId ?? null };
  });

  // Build the renderer once, then keep it in step with the props below. It
  // starts on the next frame rather than during commit: WebGL init is slow, and
  // the status genuinely arrives after that external system comes up.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    let scene: FridgeScene | null = null;
    let observer: ResizeObserver | null = null;

    const start = requestAnimationFrame(() => {
      try {
        scene = new FridgeScene(canvas);
      } catch {
        // No WebGL (old browser, blocked, software rendering off): the control
        // buttons below still work, so the fridge stays usable.
        setStatus('failed');
        return;
      }

      sceneRef.current = scene;
      scene.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scene.setModel({ columns: latest.current.columns });
      scene.setOpenPanel(latest.current.open);

      observer = new ResizeObserver(() => {
        const { width } = wrapper.getBoundingClientRect();
        scene?.resize(width, width * 1.16);
      });
      observer.observe(wrapper);
      setStatus('ready');
    });

    return () => {
      cancelAnimationFrame(start);
      observer?.disconnect();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setModel({ columns: latest.current.columns });
  }, [modelSignature]);

  useEffect(() => {
    sceneRef.current?.setOpenPanel(selectedId ?? null);
  }, [selectedId]);

  function toggle(panelId: string) {
    const panel = panels.find((entry) => entry.id === panelId);
    if (!panel) return;
    onSelect?.(
      panel.id,
      panel.compartments.map((compartment) => compartment.id),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapperRef}
        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950"
      >
        <canvas
          ref={canvasRef}
          // The model is decorative: every action it offers is also a button.
          aria-hidden
          className={`block w-full ${preview ? '' : 'cursor-pointer'}`}
          onPointerMove={preview ? undefined : (event) => {
            const scene = sceneRef.current;
            if (!scene) return;
            const hit = scene.pick(event.clientX, event.clientY);
            scene.setHovered(hit);
            event.currentTarget.style.cursor = hit ? 'pointer' : 'default';
          }}
          onPointerLeave={preview ? undefined : () => sceneRef.current?.setHovered(null)}
          onClick={
            preview
              ? undefined
              : (event) => {
                  const hit = sceneRef.current?.pick(event.clientX, event.clientY);
                  if (hit) toggle(hit);
                }
          }
        />

        {status === 'ready' ? null : (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-slate-500 dark:text-slate-400">
            {status === 'failed'
              ? 'Your browser could not start 3D — use the buttons below.'
              : 'Loading…'}
          </p>
        )}
      </div>

      {preview ? null : (
      <div className="flex flex-wrap gap-2" role="group" aria-label="Doors and drawers">
        {panels.map((panel) => {
          const open = panel.id === selectedId;
          const itemCount = panel.compartments.reduce(
            (total, compartment) => total + (compartment.itemCount ?? 0),
            0,
          );
          const expiry = panel.compartments.reduce<ExpiryStatus>(
            (worst, compartment) =>
              SEVERITY[compartment.worstExpiry ?? 'none'] > SEVERITY[worst]
                ? (compartment.worstExpiry ?? 'none')
                : worst,
            'none',
          );

          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => toggle(panel.id)}
              aria-expanded={open}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                open
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              {expiry === 'soon' || expiry === 'expired' ? (
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${expiry === 'expired' ? 'bg-red-500' : 'bg-amber-500'}`}
                />
              ) : null}
              {open ? `Close ${panel.label.toLowerCase()}` : panel.label}
              <span className={open ? 'opacity-70' : 'text-slate-500 dark:text-slate-400'}>
                {itemCount}
              </span>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
