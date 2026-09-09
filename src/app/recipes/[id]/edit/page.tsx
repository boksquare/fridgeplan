import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUserPage } from '@/lib/page-guards';
import { ownRecipeFilter, parseIngredientsJson } from '@/lib/recipes/access';
import { RecipeForm } from '@/components/recipe-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit recipe — Fridgeplan' };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;

  const recipe = await prisma.recipe.findFirst({
    where: { AND: [{ id }, await ownRecipeFilter(user.id)] },
  });
  if (!recipe) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/recipes/${recipe.id}`}
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to the recipe
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {recipe.title}</h1>
      </header>

      <RecipeForm
        initial={{
          id: recipe.id,
          title: recipe.title,
          cuisine: recipe.cuisine ?? '',
          instructions: recipe.instructions,
          imageUrl: recipe.imageUrl,
          ingredients: parseIngredientsJson(recipe.ingredients).map((ingredient) => ({
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          })),
        }}
      />
    </main>
  );
}
