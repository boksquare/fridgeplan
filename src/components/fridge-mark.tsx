/**
 * The Fridgeplan mark: the fridge from the browser tab.
 *
 * Inline rather than an `<img>` pointing at the icon, because Next serves the
 * `app/icon.svg` convention file from a content-hashed URL that is not ours to
 * hardcode. It is the same artwork as `src/app/icon.svg` — change one and change
 * the other; there is no build step tying them together.
 *
 * Decorative here: the link it sits in carries the name.
 */
export function FridgeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="presentation"
      aria-hidden
      focusable="false"
      className={className}
    >
      <rect width="32" height="32" rx="7" fill="#0f172a" />
      <rect x="9" y="6" width="14" height="20" rx="2.5" fill="#e2e8f0" />
      <rect x="9" y="15.5" width="14" height="1.4" fill="#0f172a" />
      <rect x="19.6" y="9" width="1.4" height="4.5" rx="0.7" fill="#0f172a" />
      <rect x="19.6" y="18.6" width="1.4" height="4.5" rx="0.7" fill="#0f172a" />
    </svg>
  );
}
