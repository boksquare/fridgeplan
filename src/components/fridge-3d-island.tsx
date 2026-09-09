'use client';

import dynamic from 'next/dynamic';

/**
 * WebGL cannot render on the server, so the model loads client-side. The
 * placeholder holds the same space to avoid a layout jump.
 */
export const Fridge3DIsland = dynamic(
  () => import('@/components/fridge-3d').then((module) => module.Fridge3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-3">
        <div className="aspect-[1/1.16] w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Opening your fridge…</p>
      </div>
    ),
  },
);
