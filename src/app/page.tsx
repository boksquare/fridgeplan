import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUserPage } from '@/lib/page-guards';
import { getFridgeForUser, listFridges } from '@/lib/fridges';
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

  const totalItems = fridge.compartments.reduce(
    (count, compartment) => count + compartment.items.length,
    0,
  );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <FridgeView
        fridge={serializeFridge(fridge)}
        otherFridges={fridges
          .filter((entry) => entry.id !== fridge.id)
          .map((entry) => ({ id: entry.id, name: entry.name }))}
      />

      {totalItems > 0 ? (
        <section className="flex flex-wrap gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
          {/* Recipes arrive in Phase 2; the entry points live here. */}
          <Link
            href="/recipes/suggest"
            aria-disabled
            className="pointer-events-none rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium opacity-50 dark:border-slate-700"
          >
            Suggest recipes (Phase 2)
          </Link>
          <Link
            href="/recipes/search"
            aria-disabled
            className="pointer-events-none rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium opacity-50 dark:border-slate-700"
          >
            Search recipes (Phase 2)
          </Link>
        </section>
      ) : null}
    </main>
  );
}
