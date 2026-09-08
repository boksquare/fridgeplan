'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Suggestion = { id: string; name: string };

/**
 * Typeahead over the ingredient dictionary. A name that is not in the
 * dictionary is still accepted — the API creates it — so the list never blocks
 * entry of something new.
 */
export function IngredientAutocomplete({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 1) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ingredients?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { ingredients: Suggestion[] };
        setSuggestions(body.ingredients);
      } catch {
        // Aborted or offline: leave the previous suggestions in place.
      }
    }, 150);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Derived rather than cleared in the effect: an empty box shows no list, and
  // an exact match needs no suggestion.
  const query = value.trim();
  const matches = query.length > 0 ? suggestions : [];
  const visible = open && matches.length > 0 && matches[0]?.name !== query;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Ingredient</span>
        <input
          type="text"
          required={required}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          placeholder="Start typing…"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      {visible ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {matches.map((suggestion) => (
            <li key={suggestion.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onChange(suggestion.name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {suggestion.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
