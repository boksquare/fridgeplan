import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { RecipeSearch } from '@/components/recipe-search';
import { ProviderNote } from '@/components/provider-note';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search recipes — Fridgeplan' };

export default async function SearchPage() {
  const user = await requireUserPage();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to the fridge
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Search recipes</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Results still show what you are missing from your own fridges.
        </p>
      </header>

      <RecipeSearch />
      <ProviderNote userId={user.id} />
    </main>
  );
}
