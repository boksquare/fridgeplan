import { AIProviderError } from '@/lib/ai/types';
import type { AIProvider } from '@/lib/ai/types';

export const geminiProvider: AIProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  needsApiKey: true,
  supportsVision: true,
  defaultModel: 'gemini-2.0-flash',

  async chat(request, config) {
    const model = config.model ?? this.defaultModel;
    const base = (config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/$/,
      '',
    );

    const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey ?? '' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: request.prompt },
              ...(request.images ?? []).map((image) => ({
                inline_data: { mime_type: image.mediaType, data: image.base64 },
              })),
            ],
          },
        ],
        generationConfig: { maxOutputTokens: request.maxTokens ?? 800, temperature: 0.2 },
      }),
    });

    if (!res.ok) throw new AIProviderError('gemini', `Gemini returned ${res.status}`);

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!text) throw new AIProviderError('gemini', 'Gemini returned no content.');
    return { text, model };
  },
};
