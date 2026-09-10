import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, withUser } from '@/lib/api';
import { acceptInvite } from '@/lib/households';

const bodySchema = z.object({ code: z.string().trim().min(1) });

export async function POST(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('That invitation link is not valid.');

  try {
    const invite = await acceptInvite(parsed.data.code, user.id);
    return NextResponse.json({ householdId: invite.householdId });
  } catch (error) {
    return badRequest((error as Error).message);
  }
}
