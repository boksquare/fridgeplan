import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { suggestRecipes } from '@/lib/recipes/service';
import { RecipeSummaryList } from '@/components/recipe-summary-list';
import { ProviderNote } from '@/components/provider-note';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suggested meals — Fridgeplan' };

export default async function SuggestPage() {
  const user = await requireUserPage();
  const { results, errors, inventoryCount } = await suggestRecipes({ userId: user.id });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to the fridge
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">What you can cook</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Matched against the {inventoryCount} thing{inventoryCount === 1 ? '' : 's'} in your
          fridges, best first.
        </p>
      </header>

      {errors.length > 0 ? (
        <ul className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <RecipeSummaryList
        recipes={results}
        backTo="/recipes/suggest"
        emptyMessage={
          inventoryCount === 0
            ? 'Add something to a fridge first and suggestions will appear here.'
            : 'Nothing matched what is in your fridges right now. Try searching instead.'
        }
      />

      <ProviderNote userId={user.id} />
    </main>
  );
}
