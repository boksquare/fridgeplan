'use client';

import dynamic from 'next/dynamic';

/**
 * The guest fridge exists only in the browser, so there is nothing meaningful
 * to render on the server — and rendering the empty case there would mismatch
 * the hydrated view. Loading it client-side keeps the two consistent.
 */
export const GuestFridgeIsland = dynamic(
  () => import('@/components/guest-fridge').then((module) => module.GuestFridge),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-slate-500 dark:text-slate-400">Opening your fridge…</p>
    ),
  },
);
