/**
 * Optional configuration, read safely.
 *
 * docker-compose passes optional variables as `${VAR:-}`, so a variable the
 * operator never set arrives as an empty string rather than absent. `??` does
 * not fall through for "", which silently broke things that only ever ran
 * unset in development: an empty RECIPE_PROVIDERS disabled every recipe
 * source, and an empty AI_ENCRYPTION_KEY made storing a provider key fail.
 *
 * Read optional values through here, never `process.env.X ?? fallback`.
 */
export function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function envOr(name: string, fallback: string): string {
  return env(name) ?? fallback;
}

/** A comma-separated list, or undefined when unset or empty. */
export function envList(name: string): string[] | undefined {
  const value = env(name);
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}
