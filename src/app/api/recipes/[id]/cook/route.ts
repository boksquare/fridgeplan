import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Unit } from '@/generated/prisma/enums';
import { badRequest, notFound, withUser } from '@/lib/api';
import { applyCook } from '@/lib/recipes/cook';
import { getRecipeWithMatch } from '@/lib/recipes/service';

const bodySchema = z.object({
  // Exactly what the user confirmed was used — the client sends only the lines
  // they kept, with amounts they may have edited.
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().positive().max(100000),
        unit: z.nativeEnum(Unit),
      }),
    )
    .min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const found = await getRecipeWithMatch(user.id, id);
  if (!found) return notFound('No such recipe.');

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Confirm what you used first.');
  }

  try {
    return NextResponse.json(await applyCook(user.id, parsed.data.lines));
  } catch (error) {
    return badRequest((error as Error).message);
  }
}
