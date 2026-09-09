import { env } from '@/lib/env';
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
/**
 * The active provider, or a plain-language reason there is not one.
 *
 * Every "no provider" case used to look identical in the UI, which makes a
 * misconfigured instance indistinguishable from an unconfigured one — a
 * commented-out AI_PROVIDER, a typo in its value, a self-host-only provider on
 * a hosted instance and a missing key all read as "nothing configured". So the
 * reason travels with the answer.
 */
export async function resolveAIConfiguration(
  userId?: string,
): Promise<{ active: ActiveProvider | null; problem: string | null }> {
  const mode = await getDeploymentMode();
  const known = PROVIDERS.map((provider) => provider.id).join(', ');

  const withKeyCheck = (active: ActiveProvider) => ({
    active,
    problem:
      active.provider.needsApiKey && !active.config.apiKey
        ? `${active.provider.label} is selected but no API key is set, so requests would be rejected.`
        : null,
  });

  if (mode === 'personal_self_host' && userId) {
    const row = await prisma.aIProviderConfig.findFirst({
      where: { scope: 'user', userId, isActive: true },
    });
    if (row) {
      const provider = findProvider(row.provider);
      if (!provider) {
        return {
          active: null,
          problem: `Your saved provider "${row.provider}" is not one this build knows (${known}). Pick another below.`,
        };
      }
      const settings = (row.settings ?? {}) as { baseUrl?: string };
      return withKeyCheck({
        provider,
        scope: 'user',
        config: {
          apiKey: row.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted) : undefined,
          model: row.model ?? undefined,
          baseUrl: settings.baseUrl,
        },
      });
    }
  }

  const instanceRow = await prisma.aIProviderConfig.findFirst({
    where: { scope: 'instance', isActive: true },
  });
  if (instanceRow) {
    const provider = findProvider(instanceRow.provider);
    if (provider && (!provider.selfHostOnly || mode === 'personal_self_host')) {
      const settings = (instanceRow.settings ?? {}) as { baseUrl?: string };
      return withKeyCheck({
        provider,
        scope: 'instance',
        config: {
          apiKey: instanceRow.apiKeyEncrypted
            ? decryptSecret(instanceRow.apiKeyEncrypted)
            : undefined,
          model: instanceRow.model ?? undefined,
          baseUrl: settings.baseUrl,
        },
      });
    }
  }

  // Config-file (env) fallback: the only way to configure a hosted instance for
  // now — an admin panel is deliberately deferred.
  const envProviderId = env('AI_PROVIDER');
  if (!envProviderId) {
    return {
      active: null,
      problem:
        mode === 'personal_self_host'
          ? null
          : `No AI provider is set. Set AI_PROVIDER (one of: ${known}) and its API key in this instance's configuration, then restart it. If you edited .env, check the lines are not still commented out with "#".`,
    };
  }

  const provider = findProvider(envProviderId);
  if (!provider) {
    return {
      active: null,
      problem: `AI_PROVIDER is set to "${envProviderId}", which is not a provider this build knows. Expected one of: ${known}.`,
    };
  }
  if (provider.selfHostOnly && mode !== 'personal_self_host') {
    return {
      active: null,
      problem: `${provider.label} only runs on a personal self-host instance, so it is ignored on a hosted one.`,
    };
  }

  return withKeyCheck({
    provider,
    scope: 'instance',
    config: {
      apiKey: env('AI_API_KEY'),
      model: env('AI_MODEL'),
      baseUrl: env('AI_BASE_URL'),
    },
  });
}

export async function resolveActiveProvider(userId?: string): Promise<ActiveProvider | null> {
  return (await resolveAIConfiguration(userId)).active;
}

export async function runAI(request: AIRequest, userId?: string): Promise<AIResponse> {
  const { active, problem } = await resolveAIConfiguration(userId);
  if (!active) {
    throw new AIProviderError('none', problem ?? 'No AI provider is configured on this instance.');
  }
  if (problem) throw new AIProviderError(active.provider.id, problem);
  return active.provider.chat(request, active.config);
}
