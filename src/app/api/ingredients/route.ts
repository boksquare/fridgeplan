import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withUser } from '@/lib/api';

const LIMIT = 10;

/**
 * Typeahead over the canonical ingredient dictionary. Matches the name or any
 * alias, so "aubergine" finds "Eggplant" once aliases are populated.
 */
export async function GET(request: Request) {
  const { response } = await withUser();
  if (response) return response;

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 1) return NextResponse.json({ ingredients: [] });

  const ingredients = await prisma.ingredient.findMany({
    where: {
      OR: [{ name: { contains: query, mode: 'insensitive' } }, { aliases: { has: query } }],
    },
    orderBy: { name: 'asc' },
    take: LIMIT,
    select: { id: true, name: true },
  });

  return NextResponse.json({ ingredients });
}
