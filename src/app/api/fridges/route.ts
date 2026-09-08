import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FridgeType } from '@/generated/prisma/enums';
import { badRequest, withUser } from '@/lib/api';
import { createFridgeForUser, listFridges } from '@/lib/fridges';
import { defaultFridgeName, fridgeConfigSchema } from '@/lib/fridge-config';

const createSchema = z.object({
  type: z.nativeEnum(FridgeType),
  name: z.string().trim().min(1).max(60).optional(),
  config: fridgeConfigSchema.default({}),
});

export async function GET() {
  const { user, response } = await withUser();
  if (response) return response;
  return NextResponse.json({ fridges: await listFridges(user.id) });
}

export async function POST(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid fridge.');

  const fridge = await createFridgeForUser({
    userId: user.id,
    type: parsed.data.type,
    name: parsed.data.name ?? defaultFridgeName(parsed.data.type),
    config: parsed.data.config,
  });

  return NextResponse.json({ fridge }, { status: 201 });
}
