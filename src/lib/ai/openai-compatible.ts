import { AIProviderError } from '@/lib/ai/types';
import type { AIProvider, AIProviderRuntimeConfig, AIRequest, AIResponse } from '@/lib/ai/types';

/**
 * Chat-completions call shared by every OpenAI-shaped API. NVIDIA NIM and most
 * local gateways speak this too, so they are the same adapter with a different
 * default base URL.
 */
export async function chatCompletions(
  providerId: string,
  defaultBaseUrl: string,
  defaultModel: string,
  request: AIRequest,
  config: AIProviderRuntimeConfig,
): Promise<AIResponse> {
  const baseUrl = (config.baseUrl ?? defaultBaseUrl).replace(/\/$/, '');
  const model = config.model ?? defaultModel;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: request.system },
        {
          role: 'user',
          content:
            request.images && request.images.length > 0
              ? [
                  { type: 'text', text: request.prompt },
                  ...request.images.map((image) => ({
                    type: 'image_url',
                    image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
                  })),
                ]
              : request.prompt,
        },
      ],
      max_tokens: request.maxTokens ?? 800,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new AIProviderError(providerId, `${providerId} returned ${res.status}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AIProviderError(providerId, `${providerId} returned no content.`);
  return { text, model: body.model ?? model };
}

export const openAICompatibleProvider: AIProvider = {
  id: 'openai_compatible',
  label: 'OpenAI-compatible API',
  needsApiKey: true,
  supportsVision: true,
  defaultModel: 'gpt-4o-mini',
  chat: (request, config) =>
    chatCompletions(
      'openai_compatible',
      config.baseUrl ?? 'https://api.openai.com/v1',
      'gpt-4o-mini',
      request,
      config,
    ),
};

export const nvidiaNimProvider: AIProvider = {
  id: 'nvidia_nim',
  label: 'NVIDIA NIM',
  needsApiKey: true,
  // Only true of a vision model, e.g. meta/llama-3.2-11b-vision-instruct.
  supportsVision: true,
  defaultModel: 'meta/llama-3.1-70b-instruct',
  chat: (request, config) =>
    chatCompletions(
      'nvidia_nim',
      'https://integrate.api.nvidia.com/v1',
      'meta/llama-3.1-70b-instruct',
      request,
      config,
    ),
};
