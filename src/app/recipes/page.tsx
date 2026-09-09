import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUserPage } from '@/lib/page-guards';
import { ownRecipeFilter } from '@/lib/recipes/access';
import { ProviderNote } from '@/components/provider-note';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recipes — Fridgeplan' };

export default async function RecipesPage() {
  const user = await requireUserPage();
  const own = await prisma.recipe.findMany({
    where: await ownRecipeFilter(user.id),
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, cuisine: true },
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to the fridge
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/recipes/suggest"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Suggest meals
        </Link>
        <Link
          href="/recipes/search"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Search recipes
        </Link>
        <Link
          href="/recipes/new"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Add your own
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your household’s recipes</h2>
        {own.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nothing yet. Anything you add here is visible to everyone in your household.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {own.map((recipe) => (
              <li
                key={recipe.id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <Link href={`/recipes/${recipe.id}`} className="font-medium hover:underline">
                  {recipe.title}
                </Link>
                {recipe.cuisine ? (
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    {recipe.cuisine}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProviderNote userId={user.id} />
    </main>
  );
}
