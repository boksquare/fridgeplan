import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserPage } from '@/lib/page-guards';
import { getRecipeWithMatch } from '@/lib/recipes/service';
import { ownRecipeFilter } from '@/lib/recipes/access';
import { prisma } from '@/lib/prisma';
import { CookPanel, type CookCandidate } from '@/components/cook-panel';
import { SubstitutionPanel } from '@/components/substitution-panel';
import { ProviderNote } from '@/components/provider-note';
import { recipeBackLink } from '@/lib/recipes/back-link';

export const dynamic = 'force-dynamic';

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireUserPage();
  const { id } = await params;
  const back = recipeBackLink((await searchParams).from);

  const found = await getRecipeWithMatch(user.id, id);
  if (!found) notFound();

  const { recipe, match } = found;
  const editable = await prisma.recipe.findFirst({
    where: { AND: [{ id }, await ownRecipeFilter(user.id)] },
    select: { id: true },
  });

  const candidates: CookCandidate[] = match.ingredients.map((entry) => ({
    ingredientName: entry.ingredient.name,
    recipeAmount: entry.ingredient.raw,
    recipeQuantity: entry.ingredient.quantity,
    recipeUnit: entry.ingredient.unit,
    match: entry.matches[0]
      ? {
          itemId: entry.matches[0].itemId,
          label: `${entry.matches[0].ingredientName} (${entry.matches[0].compartmentLabel})`,
          stocked: entry.matches[0].quantity,
          unit: entry.matches[0].unit,
        }
      : null,
  }));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link
          href={back.href}
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← {back.label}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{recipe.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {[recipe.cuisine, recipe.isPrivate ? 'Your household’s recipe' : recipe.sourceApi]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {editable ? (
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Edit recipe
          </Link>
        ) : null}
      </header>

      {recipe.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.imageUrl}
          alt=""
          className="max-h-80 w-full rounded-2xl object-cover"
        />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Ingredients{' '}
          <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
            ({match.haveCount} of {match.totalCount} in your fridges)
          </span>
        </h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {match.ingredients.map((entry, index) => (
            <li key={`${entry.ingredient.name}-${index}`} className="flex flex-wrap items-baseline gap-2">
              <span className={entry.have ? '' : 'text-slate-500 dark:text-slate-400'}>
                {entry.ingredient.raw ? `${entry.ingredient.raw} ` : ''}
                <span className="font-medium">{entry.ingredient.name}</span>
              </span>
              {entry.have ? (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  in {entry.matches[0]!.compartmentLabel}
                </span>
              ) : (
                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">
                  missing
                </span>
              )}
              {/* Something close is in the fridge but is not the same thing, so
                  it is named rather than counted — you decide whether chicken
                  nuggets stand in for chicken. */}
              {!entry.have && entry.possible.length > 0 ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  you do have{' '}
                  {entry.possible
                    .slice(0, 2)
                    .map((option) => option.ingredientName)
                    .join(' and ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <SubstitutionPanel
        recipeId={recipe.id}
        missing={match.missing.map((ingredient) => ingredient.name)}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Method</h2>
        <div className="flex flex-col gap-3 text-sm leading-relaxed">
          {recipe.instructions
            .split(/\n{2,}|\r\n\r\n/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <CookPanel recipeId={recipe.id} candidates={candidates} />
        <ProviderNote userId={user.id} />
      </section>
    </main>
  );
}
