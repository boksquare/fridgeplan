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
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <FridgeView
        fridge={serializeFridge(fridge)}
        otherFridges={fridges
          .filter((entry) => entry.id !== fridge.id)
          .map((entry) => ({ id: entry.id, name: entry.name }))}
        totalItems={totalItems}
      />
    </main>
  );
}
