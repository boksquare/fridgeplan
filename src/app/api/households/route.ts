import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, withUser } from '@/lib/api';
import { createHousehold, getHouseholdFor } from '@/lib/households';
import { getDeploymentMode } from '@/lib/deployment-mode';

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Give the household a name.').max(60),
});

export async function GET() {
  const { user, response } = await withUser();
  if (response) return response;
  return NextResponse.json({ household: await getHouseholdFor(user.id) });
}

export async function POST(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  // Personal self-host has one implicit user and no way to be anyone else, so a
  // household there would be a room with one chair.
  if ((await getDeploymentMode()) !== 'public_hosted') {
    return badRequest('Households need accounts, which this instance does not use.');
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid name.');

  try {
    const household = await createHousehold(user.id, parsed.data.name);
    return NextResponse.json({ household: { id: household.id, name: household.name } }, { status: 201 });
  } catch (error) {
    return badRequest((error as Error).message);
  }
}
