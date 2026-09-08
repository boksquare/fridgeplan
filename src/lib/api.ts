import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/current-user';
import type { User } from '@/generated/prisma/client';

/**
 * Resolves the acting user for a route handler, or the 401 to return instead.
 * In public hosted mode a guest has no user: guest-mode persistence is an open
 * product question, so for now the API simply refuses rather than inventing
 * server-side storage for them.
 */
export async function withUser(): Promise<
  { user: User; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: 'Sign in to manage your fridge.' }, { status: 401 }),
    };
  }
  return { user };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Not found.') {
  return NextResponse.json({ error: message }, { status: 404 });
}
