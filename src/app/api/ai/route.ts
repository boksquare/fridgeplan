import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { badRequest, withUser } from '@/lib/api';
import { encryptSecret, maskSecret } from '@/lib/crypto';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { findProvider, resolveActiveProvider, selectableProviders } from '@/lib/ai/registry';

/** What the UI needs to show "Powered by …" and, on self-host, a picker. */
export async function GET() {
  const { user, response } = await withUser();
  if (response) return response;

  const mode = await getDeploymentMode();
  const active = await resolveActiveProvider(user.id);
  const providers = await selectableProviders();

  return NextResponse.json({
    mode,
    // Self-host users choose their own provider; hosted users see it locked.
    editable: mode === 'personal_self_host',
    active: active
      ? { id: active.provider.id, label: active.provider.label, model: active.config.model ?? active.provider.defaultModel, scope: active.scope }
      : null,
    providers: providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      needsApiKey: provider.needsApiKey,
      defaultModel: provider.defaultModel,
    })),
  });
}

const putSchema = z.object({
  provider: z.string().min(1),
  model: z.string().trim().max(120).optional(),
  apiKey: z.string().trim().max(400).optional(),
  baseUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
});

/** Self-host only: the user picks and changes their own provider. */
export async function PUT(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  if ((await getDeploymentMode()) !== 'personal_self_host') {
    return NextResponse.json(
      { error: 'This instance’s AI provider is set by its operator.' },
      { status: 403 },
    );
  }

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid settings.');

  const provider = findProvider(parsed.data.provider);
  if (!provider) return badRequest('Unknown provider.');

  const existing = await prisma.aIProviderConfig.findFirst({
    where: { scope: 'user', userId: user.id, provider: provider.id },
  });

  // An empty apiKey leaves whatever is already stored alone.
  const apiKeyEncrypted = parsed.data.apiKey
    ? encryptSecret(parsed.data.apiKey)
    : (existing?.apiKeyEncrypted ?? null);

  if (provider.needsApiKey && !apiKeyEncrypted) {
    return badRequest(`${provider.label} needs an API key.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.aIProviderConfig.updateMany({
      where: { scope: 'user', userId: user.id },
      data: { isActive: false },
    });

    const data = {
      scope: 'user' as const,
      userId: user.id,
      provider: provider.id,
      model: parsed.data.model || provider.defaultModel,
      apiKeyEncrypted,
      settings: parsed.data.baseUrl ? { baseUrl: parsed.data.baseUrl } : {},
      isActive: true,
    };

    if (existing) await tx.aIProviderConfig.update({ where: { id: existing.id }, data });
    else await tx.aIProviderConfig.create({ data });
  });

  return NextResponse.json({
    active: {
      id: provider.id,
      label: provider.label,
      model: parsed.data.model || provider.defaultModel,
      apiKey: parsed.data.apiKey ? maskSecret(parsed.data.apiKey) : undefined,
    },
  });
}
