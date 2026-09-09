import { NextResponse } from 'next/server';
import { withUser } from '@/lib/api';
import { searchRecipes } from '@/lib/recipes/service';

export async function GET(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const params = new URL(request.url).searchParams;
  const result = await searchRecipes({
    userId: user.id,
    query: params.get('q')?.trim() || undefined,
    cuisine: params.get('cuisine')?.trim() || undefined,
    sourceApi: params.get('source')?.trim() || undefined,
  });

  return NextResponse.json(result);
}
