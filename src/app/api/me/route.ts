import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnitSystem } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, withUser } from '@/lib/api';

const patchSchema = z
  .object({
    unitSystem: z.nativeEnum(UnitSystem),
    /**
     * What other people see instead of your email address. An empty string
     * clears it, which is a real choice rather than a validation failure: the
     * app falls back to the email everywhere a name is shown.
     */
    name: z.string().trim().max(80, 'That name is too long.'),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change.');

/** The acting user's own preferences. */
export async function PATCH(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid change.');

  const { unitSystem, name } = parsed.data;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(unitSystem === undefined ? {} : { unitSystem }),
      ...(name === undefined ? {} : { name: name || null }),
    },
    select: { unitSystem: true, name: true },
  });
  return NextResponse.json(updated);
}
