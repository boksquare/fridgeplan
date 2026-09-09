import { providerAttributions } from '@/lib/recipes/registry';
import { resolveActiveProvider } from '@/lib/ai/registry';

/**
 * Attribution for the recipe sources, plus which model answers the AI features
 * — visible on a hosted instance where the operator, not the user, chose it.
 */
export async function ProviderNote({ userId }: { userId?: string }) {
  const active = await resolveActiveProvider(userId);
  const notes = [...providerAttributions()];
  if (active) notes.push(`AI by ${active.provider.label}`);

  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">{notes.join(' · ')}</p>
  );
}
