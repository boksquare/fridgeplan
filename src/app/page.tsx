import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUserPage } from '@/lib/page-guards';
import { countAccessibleItems, getFridgeForUser, listFridges } from '@/lib/fridges';
import { serializeFridge } from '@/lib/serialize';
import { FridgeView } from '@/components/fridge-view';

// The landing view reads live inventory, so it is never prerendered.
export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ fridge?: string }>;
}) {
  const user = await requireUserPage();
  const { fridge: requestedId } = await searchParams;

  const fridges = await listFridges(user.id);
  // Onboarding: with no fridge yet, the fridge builder *is* the landing page.
  if (fridges.length === 0) redirect('/fridges/new');

  const targetId = requestedId ?? fridges[0]!.id;
  const fridge = await getFridgeForUser(targetId, user.id);
  if (!fridge) redirect('/');

  // Recipe matching looks at every fridge, so the entry points do too — not
  // just the one on screen.
  const totalItems = await countAccessibleItems(user.id);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <FridgeView
        fridge={serializeFridge(fridge)}
        otherFridges={fridges
          .filter((entry) => entry.id !== fridge.id)
          .map((entry) => ({ id: entry.id, name: entry.name }))}
      />

      <section className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        {/* Recipe entry points appear beneath the fridge once there is anything
            in it to cook with. */}
        {totalItems > 0 ? (
          <>
            <Link
              href="/recipes/suggest"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            >
              Suggest recipes
            </Link>
            <Link
              href="/recipes/search"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Search recipes
            </Link>
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Add something to a compartment and recipe suggestions appear here.
          </p>
        )}
        <Link
          href="/recipes"
          className="text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          Your recipes
        </Link>
        <Link
          href="/settings"
          className="text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          Settings
        </Link>
      </section>
    </main>
  );
}
