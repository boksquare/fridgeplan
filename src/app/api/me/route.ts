import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnitSystem } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, withUser } from '@/lib/api';

const patchSchema = z.object({ unitSystem: z.nativeEnum(UnitSystem) });

/** The acting user's own preferences. */
export async function PATCH(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Unknown measurement system.');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { unitSystem: parsed.data.unitSystem },
    select: { unitSystem: true },
  });
  return NextResponse.json(updated);
}
