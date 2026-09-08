import { expiryLabel, expiryStatus } from '@/lib/expiry';

/**
 * Expiry flag (plan §9): tint, icon and words together — never colour alone.
 */
export function ExpiryBadge({ expirationDate }: { expirationDate: Date | null }) {
  const status = expiryStatus(expirationDate);
  const label = expiryLabel(expirationDate);
  if (!label || status === 'none' || status === 'fresh') return null;

  const expired = status === 'expired';
  const className = expired
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200'
    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <svg viewBox="0 0 20 20" aria-hidden className="size-3.5 fill-current">
        {expired ? (
          // Exclamation in a circle.
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.9 4l-.15 5.5h-1.5L9.1 6h1.8zM10 15.2a1.05 1.05 0 110-2.1 1.05 1.05 0 010 2.1z" />
        ) : (
          // Warning triangle.
          <path d="M10 2.5l7.5 13H2.5L10 2.5zm.85 5h-1.7l.15 4.4h1.4l.15-4.4zM10 14.9a1 1 0 110-2 1 1 0 010 2z" />
        )}
      </svg>
      {label}
    </span>
  );
}
