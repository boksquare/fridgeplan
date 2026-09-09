/**
 * Where a recipe page's "back" link should go.
 *
 * A recipe reached from the suggestions or from a search must return to that
 * list, not to the recipe index: both lists are computed per request, so being
 * dropped on the index means the results are gone and the user has to ask for
 * them again. The origin therefore travels with the link as a `from` parameter.
 *
 * That parameter is in the URL, so it is attacker-controlled: it is only ever
 * used after passing through here, which accepts a same-site recipe path and
 * nothing else. Anything odd — an absolute URL, a protocol-relative "//host",
 * a path elsewhere in the app — falls back to the index.
 */
const LABELS: { prefix: string; label: string }[] = [
  { prefix: '/recipes/suggest', label: 'Back to suggestions' },
  { prefix: '/recipes/search', label: 'Back to search results' },
];

export type BackLink = { href: string; label: string };

const INDEX: BackLink = { href: '/recipes', label: 'All recipes' };

export function recipeBackLink(from: string | undefined): BackLink {
  if (!from) return INDEX;

  // Must be a site-relative path, and "//" would make it another origin.
  if (!from.startsWith('/') || from.startsWith('//')) return INDEX;

  let path: string;
  try {
    // Parsed against a throwaway base so a query string is kept but anything
    // trying to change origin cannot.
    const url = new URL(from, 'http://recipes.invalid');
    path = `${url.pathname}${url.search}`;
  } catch {
    return INDEX;
  }

  const known = LABELS.find(
    (entry) => path === entry.prefix || path.startsWith(`${entry.prefix}?`),
  );
  return known ? { href: path, label: known.label } : INDEX;
}

/** The value to hand to a link out of a list, so it can be returned to. */
export function backParam(pathAndQuery: string): string {
  return `from=${encodeURIComponent(pathAndQuery)}`;
}
