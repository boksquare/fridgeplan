import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getDeploymentMode } from '@/lib/deployment-mode';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Use at least 8 characters.'),
  name: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const mode = await getDeploymentMode();
  if (mode !== 'public_hosted') {
    // Personal self-host has no accounts, and an un-set-up instance has no mode.
    return NextResponse.json({ error: 'Accounts are not enabled on this instance.' }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid details.' },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'That email is already registered.' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name ?? null,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
