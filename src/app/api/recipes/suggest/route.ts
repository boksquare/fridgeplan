import { NextResponse } from 'next/server';
import { withUser } from '@/lib/api';
import { suggestRecipes } from '@/lib/recipes/service';

export async function GET() {
  const { user, response } = await withUser();
  if (response) return response;
  return NextResponse.json(await suggestRecipes({ userId: user.id }));
}
