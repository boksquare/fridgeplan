import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { RecipeForm } from '@/components/recipe-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add a recipe — Fridgeplan' };

export default async function NewRecipePage() {
  await requireUserPage();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/recipes"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← All recipes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add your own recipe</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Visible to everyone in your household, and matched against your fridges like any other
          recipe.
        </p>
      </header>

      <RecipeForm />
    </main>
  );
}
