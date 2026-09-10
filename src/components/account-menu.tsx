'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Who you are signed in as, and the way out.
 *
 * Sign out is a form posting to a server action rather than an onClick, so it
 * still works if the JavaScript has not loaded — being unable to end a session
 * is a worse failure than a menu that will not open.
 */
export function AccountMenu({
  name,
  email,
  signOut,
}: {
  name: string;
  email: string;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${email}`}
        className="grid size-8 place-items-center rounded-full border border-slate-300 bg-slate-100 text-sm font-medium transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
          </div>

          <Link
            href="/settings/household"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Household
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Settings
          </Link>

          <form action={signOut} className="border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
