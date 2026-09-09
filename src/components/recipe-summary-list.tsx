import Link from 'next/link';
import type { RecipeSummary } from '@/lib/recipes/service';
import { backParam } from '@/lib/recipes/back-link';

/** Shared result list for suggest and search: what you have, what you don't. */
export function RecipeSummaryList({
  recipes,
  emptyMessage,
  /**
   * This list's own path (with query), so a recipe opened from here can offer a
   * link back to it. Without it the recipe page can only send the user to the
   * index, which throws away the results they were reading.
   */
  backTo,
}: {
  recipes: RecipeSummary[];
  emptyMessage: string;
  backTo?: string;
}) {
  if (recipes.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">{emptyMessage}</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {recipes.map((recipe) => (
        <li
          key={recipe.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <Link
            href={backTo ? `/recipes/${recipe.id}?${backParam(backTo)}` : `/recipes/${recipe.id}`}
            className="flex h-full flex-col"
          >
            {recipe.imageUrl ? (
              // Source photos come from allow-listed hosts; uploads are served
              // by our own route. A plain img keeps both paths simple.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.imageUrl}
                alt=""
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            ) : null}

            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{recipe.title}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {[recipe.cuisine, recipe.isPrivate ? 'Your recipe' : recipe.sourceApi]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>

              <p className="mt-auto text-sm">
                <span className="font-medium">
                  {recipe.haveCount} of {recipe.totalCount} ingredients
                </span>
                {recipe.missing.length > 0 ? (
                  <span className="text-slate-600 dark:text-slate-400">
                    {' '}
                    · missing {recipe.missing.slice(0, 3).join(', ')}
                    {recipe.missing.length > 3 ? ` +${recipe.missing.length - 3} more` : ''}
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400"> · you have everything</span>
                )}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
