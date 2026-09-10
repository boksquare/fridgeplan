import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, notFound, withUser } from '@/lib/api';
import { getHouseholdFor, isOwner, removeMember, setMemberRole } from '@/lib/households';

const patchSchema = z.object({ role: z.enum(['owner', 'member']) });

/** Remove someone, or leave yourself. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { user, response } = await withUser();
  if (response) return response;

  const household = await getHouseholdFor(user.id);
  if (!household) return notFound('No household.');

  const { userId } = await params;
  // Leaving is always yours to do; removing anyone else is an owner's call.
  if (userId !== user.id && !(await isOwner(household.id, user.id))) {
    return badRequest('Only an owner can remove someone.');
  }

  try {
    await removeMember(household.id, userId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return badRequest((error as Error).message);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { user, response } = await withUser();
  if (response) return response;

  const household = await getHouseholdFor(user.id);
  if (!household) return notFound('No household.');
  if (!(await isOwner(household.id, user.id))) {
    return badRequest('Only an owner can change roles.');
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Unknown role.');

  const { userId } = await params;

  // Demoting yourself while you are the only owner would leave the household
  // with nobody able to invite, remove, or promote.
  if (userId === user.id && parsed.data.role === 'member') {
    const owners = household.members.filter((member) => member.role === 'owner');
    if (owners.length === 1) return badRequest('Make someone else an owner first.');
  }

  if (!(await setMemberRole(household.id, userId, parsed.data.role))) {
    return notFound('They are not in this household.');
  }
  return NextResponse.json({ role: parsed.data.role });
}
