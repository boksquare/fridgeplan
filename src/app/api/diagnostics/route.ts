import { NextResponse } from 'next/server';
import { withUser } from '@/lib/api';
import { runDiagnostics } from '@/lib/diagnostics';

/** The same self-test as the page, for reading from a terminal. */
export async function GET() {
  const { user, response } = await withUser();
  if (response) return response;
  return NextResponse.json({ checks: await runDiagnostics(user.id) });
}
