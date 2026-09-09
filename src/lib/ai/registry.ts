import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { anthropicProvider } from '@/lib/ai/anthropic';
import { claudeCodeProvider } from '@/lib/ai/claude-code';
import { geminiProvider } from '@/lib/ai/gemini';
import { nvidiaNimProvider, openAICompatibleProvider } from '@/lib/ai/openai-compatible';
import { AIProviderError } from '@/lib/ai/types';
import type { AIProvider, AIProviderRuntimeConfig, AIRequest, AIResponse } from '@/lib/ai/types';

const PROVIDERS: AIProvider[] = [
  nvidiaNimProvider,
  geminiProvider,
  openAICompatibleProvider,
  anthropicProvider,
  claudeCodeProvider,
];

export function allProviders(): AIProvider[] {
  return PROVIDERS;
}

/** Providers an instance in this mode is allowed to offer. */
export async function selectableProviders(): Promise<AIProvider[]> {
  const mode = await getDeploymentMode();
  return PROVIDERS.filter((provider) => !provider.selfHostOnly || mode === 'personal_self_host');
}

export function findProvider(id: string): AIProvider | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

export type ActiveProvider = {
  provider: AIProvider;
  config: AIProviderRuntimeConfig;
  /** Where the choice came from, which is also what the UI may let you change. */
  scope: 'instance' | 'user';
};

/**
 * Resolves who decides which model answers:
 *
 * - public hosted: the instance operator, config-file driven, locked for users.
 * - personal self-host: the user's own choice in settings, falling back to the
 *   instance config so a fresh install still works.
 */
export async function resolveActiveProvider(userId?: string): Promise<ActiveProvider | null> {
  const mode = await getDeploymentMode();

  if (mode === 'personal_self_host' && userId) {
    const row = await prisma.aIProviderConfig.findFirst({
      where: { scope: 'user', userId, isActive: true },
    });
    if (row) {
      const provider = findProvider(row.provider);
      if (!provider) return null;
      const settings = (row.settings ?? {}) as { baseUrl?: string };
      return {
        provider,
        scope: 'user',
        config: {
          apiKey: row.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted) : undefined,
          model: row.model ?? undefined,
          baseUrl: settings.baseUrl,
        },
      };
    }
  }

  const instanceRow = await prisma.aIProviderConfig.findFirst({
    where: { scope: 'instance', isActive: true },
  });
  if (instanceRow) {
    const provider = findProvider(instanceRow.provider);
    if (provider && (!provider.selfHostOnly || mode === 'personal_self_host')) {
      const settings = (instanceRow.settings ?? {}) as { baseUrl?: string };
      return {
        provider,
        scope: 'instance',
        config: {
          apiKey: instanceRow.apiKeyEncrypted ? decryptSecret(instanceRow.apiKeyEncrypted) : undefined,
          model: instanceRow.model ?? undefined,
          baseUrl: settings.baseUrl,
        },
      };
    }
  }

  // Config-file (env) fallback: the only way to configure a hosted instance for
  // now — an admin panel is deliberately deferred.
  const envProviderId = process.env.AI_PROVIDER;
  if (!envProviderId) return null;
  const provider = findProvider(envProviderId);
  if (!provider) return null;
  if (provider.selfHostOnly && mode !== 'personal_self_host') return null;

  return {
    provider,
    scope: 'instance',
    config: {
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL,
      baseUrl: process.env.AI_BASE_URL,
    },
  };
}

export async function runAI(request: AIRequest, userId?: string): Promise<AIResponse> {
  const active = await resolveActiveProvider(userId);
  if (!active) {
    throw new AIProviderError('none', 'No AI provider is configured on this instance.');
  }
  if (active.provider.needsApiKey && !active.config.apiKey) {
    throw new AIProviderError(
      active.provider.id,
      `${active.provider.label} needs an API key before it can be used.`,
    );
  }
  return active.provider.chat(request, active.config);
}
