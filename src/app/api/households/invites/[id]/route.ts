import { NextResponse } from 'next/server';
import { badRequest, notFound, withUser } from '@/lib/api';
import { getHouseholdFor, isOwner, revokeInvite } from '@/lib/households';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await withUser();
  if (response) return response;

  const household = await getHouseholdFor(user.id);
  if (!household) return notFound('No household.');
  if (!(await isOwner(household.id, user.id))) {
    return badRequest('Only an owner can cancel an invitation.');
  }

  const { id } = await params;
  if (!(await revokeInvite(id, household.id))) {
    return notFound('That invitation is already used or cancelled.');
  }
  return NextResponse.json({ revoked: true });
}
