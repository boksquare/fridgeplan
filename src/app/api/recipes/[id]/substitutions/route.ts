import { NextResponse } from 'next/server';
import { notFound, withUser } from '@/lib/api';
import { suggestSubstitutions } from '@/lib/ai/substitutions';
import { getRecipeWithMatch } from '@/lib/recipes/service';
import { AIProviderError } from '@/lib/ai/types';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const found = await getRecipeWithMatch(user.id, id);
  if (!found) return notFound('No such recipe.');

  try {
    const result = await suggestSubstitutions({
      recipeTitle: found.recipe.title,
      missing: found.match.missing,
      inventory: found.inventory,
      userId: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIProviderError) {
      // A missing or misconfigured provider is a normal state, not a crash.
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
