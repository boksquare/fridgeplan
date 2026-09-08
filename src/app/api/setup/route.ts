import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDeploymentMode, setDeploymentMode } from '@/lib/deployment-mode';

const bodySchema = z.object({
  mode: z.enum(['personal_self_host', 'public_hosted']),
});

export async function POST(request: Request) {
  // Setup runs once. Refusing when the mode already exists keeps a later
  // visitor from flipping a live instance into the other mode.
  if (await getDeploymentMode()) {
    return NextResponse.json({ error: 'This instance is already set up.' }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown deployment mode.' }, { status: 400 });
  }

  await setDeploymentMode(parsed.data.mode);
  return NextResponse.json({ mode: parsed.data.mode });
}
