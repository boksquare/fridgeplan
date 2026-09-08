import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, withUser } from '@/lib/api';
import { fridgeAccessFilter } from '@/lib/fridges';

const patchSchema = z.object({ name: z.string().trim().min(1).max(60) });

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Give the fridge a name.');

  const fridge = await prisma.fridge.findFirst({ where: { id, ...fridgeAccessFilter(user.id) } });
  if (!fridge) return notFound('No such fridge.');

  return NextResponse.json({
    fridge: await prisma.fridge.update({ where: { id }, data: { name: parsed.data.name } }),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const fridge = await prisma.fridge.findFirst({ where: { id, ...fridgeAccessFilter(user.id) } });
  if (!fridge) return notFound('No such fridge.');

  // Compartments and their inventory cascade with the fridge — the UI confirms
  // the item count before calling this.
  await prisma.fridge.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
