export type AIImage = {
  /** e.g. image/jpeg — adapters need it, and they disagree about where. */
  mediaType: string;
  base64: string;
};

export type AIRequest = {
  system: string;
  prompt: string;
  /** Upper bound on the reply; adapters map this to their own parameter. */
  maxTokens?: number;
  /**
   * Images to look at. Every provider spells this differently, so each adapter
   * translates; one that cannot see declares `supportsVision: false` and is
   * refused up front rather than failing mid-request.
   */
  images?: AIImage[];
};

export type AIResponse = { text: string; model: string };

/**
 * One interface for every AI backend. Adding a provider means adding an
 * adapter — calling code (substitutions today, more later) never changes.
 */
export type AIProvider = {
  id: string;
  label: string;
  /** Self-host only: not offered on a public hosted instance. */
  selfHostOnly?: boolean;
  /** False when the adapter talks to something local rather than an API. */
  needsApiKey: boolean;
  /** Whether this adapter can be sent images. */
  supportsVision: boolean;
  defaultModel: string;
  chat(request: AIRequest, config: AIProviderRuntimeConfig): Promise<AIResponse>;
};

export type AIProviderRuntimeConfig = {
  apiKey?: string;
  model?: string;
  /** OpenAI-compatible endpoints and self-hosted gateways. */
  baseUrl?: string;
};

export class AIProviderError extends Error {
  constructor(
    public providerId: string,
    message: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
