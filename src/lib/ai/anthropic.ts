import { AIProviderError } from '@/lib/ai/types';
import type { AIProvider } from '@/lib/ai/types';

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  label: 'Anthropic API',
  needsApiKey: true,
  supportsVision: true,
  defaultModel: 'claude-sonnet-5',

  async chat(request, config) {
    const model = config.model ?? this.defaultModel;
    const res = await fetch(
      `${(config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 800,
          system: request.system,
          messages: [
            {
              role: 'user',
              content:
                request.images && request.images.length > 0
                  ? [
                      ...request.images.map((image) => ({
                        type: 'image',
                        source: {
                          type: 'base64',
                          media_type: image.mediaType,
                          data: image.base64,
                        },
                      })),
                      { type: 'text', text: request.prompt },
                    ]
                  : request.prompt,
            },
          ],
        }),
      },
    );

    if (!res.ok) throw new AIProviderError('anthropic', `Anthropic API returned ${res.status}`);

    const body = (await res.json()) as { content?: { text?: string }[]; model?: string };
    const text = body.content?.map((block) => block.text ?? '').join('').trim();
    if (!text) throw new AIProviderError('anthropic', 'Anthropic API returned no content.');
    return { text, model: body.model ?? model };
  },
};
