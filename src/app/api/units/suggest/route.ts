import { NextResponse } from 'next/server';
import { UnitSystem } from '@/generated/prisma/enums';
import { getCurrentUser } from '@/lib/current-user';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { suggestUnit } from '@/lib/units/suggest';

/**
 * Unit suggestion for the entry form. Open to guests deliberately — the table
 * needs no account — but only a signed-in user's request can reach their own
 * history or the AI provider.
 */
export async function GET(request: Request) {
  if (!(await getDeploymentMode())) {
    return NextResponse.json({ error: 'This instance is not set up.' }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const ingredientName = params.get('ingredient')?.trim() ?? '';
  if (!ingredientName) return NextResponse.json({ unit: null, source: null });

  const user = await getCurrentUser();
  const requested = params.get('system');
  const system =
    requested === UnitSystem.metric || requested === UnitSystem.imperial
      ? requested
      : (user?.unitSystem ?? UnitSystem.imperial);

  return NextResponse.json(
    await suggestUnit({ ingredientName, userId: user?.id, system }),
  );
}
