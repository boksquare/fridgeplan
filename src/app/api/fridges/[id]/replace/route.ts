import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FridgeType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, withUser } from '@/lib/api';
import { fridgeAccessFilter } from '@/lib/fridges';
import { fridgeConfigSchema, defaultFridgeName } from '@/lib/fridge-config';
import { replaceFridge } from '@/lib/fridge-replace';

const replaceSchema = z.object({
  type: z.nativeEnum(FridgeType),
  name: z.string().trim().min(1).max(60).optional(),
  config: fridgeConfigSchema.default({}),
  // The user is asked this explicitly, and told what "delete" costs, before we
  // ever get here — there is no default.
  inventory: z.enum(['migrate', 'delete']),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const parsed = replaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid replacement.');

  const existing = await prisma.fridge.findFirst({ where: { id, ...fridgeAccessFilter(user.id) } });
  if (!existing) return notFound('No such fridge.');

  const result = await replaceFridge({
    userId: user.id,
    oldFridgeId: id,
    type: parsed.data.type,
    name: parsed.data.name ?? defaultFridgeName(parsed.data.type),
    config: parsed.data.config,
    inventory: parsed.data.inventory,
  });

  return NextResponse.json({
    fridge: { id: result.fridge.id, name: result.fridge.name },
    migratedItems: result.migratedItems,
  });
}
