import { NextResponse } from 'next/server';
import { badRequest, withUser } from '@/lib/api';
import { createInvite, getHouseholdFor, isOwner } from '@/lib/households';

export async function POST() {
  const { user, response } = await withUser();
  if (response) return response;

  const household = await getHouseholdFor(user.id);
  if (!household) return badRequest('Create a household before inviting anyone.');
  // An invite hands over full access to the household's fridges, so only an
  // owner may mint one.
  if (!(await isOwner(household.id, user.id))) {
    return badRequest('Only an owner can invite someone.');
  }

  const invite = await createInvite(household.id, user.id);
  return NextResponse.json(
    { invite: { id: invite.id, code: invite.code, expiresAt: invite.expiresAt } },
    { status: 201 },
  );
}
