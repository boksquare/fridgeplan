/**
 * Expiration flagging (plan §9). Colour is never the only signal: every status
 * carries an icon and a text label too.
 */
export const EXPIRY_WARNING_DAYS = 3;

export type ExpiryStatus = 'none' | 'fresh' | 'soon' | 'expired';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days from `now` until `date`, counting by calendar day in UTC. */
export function daysUntil(date: Date, now = new Date()): number {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((end - start) / MS_PER_DAY);
}

export function expiryStatus(expirationDate: Date | null, now = new Date()): ExpiryStatus {
  if (!expirationDate) return 'none';
  const days = daysUntil(expirationDate, now);
  if (days <= 0) return 'expired';
  if (days <= EXPIRY_WARNING_DAYS) return 'soon';
  return 'fresh';
}

export function expiryLabel(expirationDate: Date | null, now = new Date()): string | null {
  const status = expiryStatus(expirationDate, now);
  if (status === 'none' || status === 'fresh' || !expirationDate) return null;
  const days = daysUntil(expirationDate, now);
  if (status === 'expired') {
    if (days === 0) return 'Expires today';
    return days === -1 ? 'Expired yesterday' : `Expired ${Math.abs(days)} days ago`;
  }
  return days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`;
}
