import { spawn } from 'node:child_process';
import { AIProviderError } from '@/lib/ai/types';
import type { AIProvider } from '@/lib/ai/types';

const TIMEOUT_MS = 120_000;

/**
 * Headless Claude Code, using the `claude` CLI already installed and signed in
 * on the host — so it runs on the operator's own subscription rather than an
 * API key.
 *
 * Restricted to personal self-host instances (the registry enforces
 * `selfHostOnly`) and never offered in public hosted mode, where it would mean
 * running one person's subscription for other people's requests. Patrick
 * confirmed this use is acceptable for an individual's own self-hosted tool;
 * that is a platform-terms judgement, not something this code can check.
 */
export const claudeCodeProvider: AIProvider = {
  id: 'claude_code',
  label: 'Claude Code (local CLI)',
  selfHostOnly: true,
  needsApiKey: false,
  defaultModel: 'default',

  async chat(request, config) {
    const binary = config.baseUrl?.trim() || process.env.CLAUDE_CODE_BIN || 'claude';
    const args = [
      '-p',
      request.prompt,
      '--output-format',
      'json',
      '--append-system-prompt',
      request.system,
    ];
    if (config.model && config.model !== 'default') args.push('--model', config.model);

    const output = await new Promise<string>((resolve, reject) => {
      // turbopackIgnore: the binary is configuration, not a project file, and
      // tracing it would pull the whole project into the server bundle.
      const child = spawn(/* turbopackIgnore: true */ binary, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new AIProviderError('claude_code', 'The Claude Code CLI timed out.'));
      }, TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(
          new AIProviderError(
            'claude_code',
            `Could not run "${binary}" — is the Claude Code CLI installed on this host? (${error.message})`,
          ),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new AIProviderError('claude_code', stderr.trim() || `CLI exited with ${code}.`));
      });
    });

    // `--output-format json` wraps the reply; fall back to raw text if the
    // shape ever changes.
    try {
      const parsed = JSON.parse(output) as { result?: string; model?: string };
      const text = parsed.result?.trim();
      if (text) return { text, model: parsed.model ?? 'claude-code' };
    } catch {
      // Not JSON after all.
    }

    const text = output.trim();
    if (!text) throw new AIProviderError('claude_code', 'The Claude Code CLI returned nothing.');
    return { text, model: 'claude-code' };
  },
};
