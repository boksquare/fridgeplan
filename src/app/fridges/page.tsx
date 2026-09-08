import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { listFridges } from '@/lib/fridges';
import { FridgeList } from '@/components/fridge-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your fridges — Fridgeplan' };

export default async function FridgesPage() {
  const user = await requireUserPage();
  const fridges = await listFridges(user.id);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your fridges</h1>
        <Link
          href="/"
          className="text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to the fridge
        </Link>
      </header>

      <FridgeList
        fridges={fridges.map((fridge) => ({
          id: fridge.id,
          name: fridge.name,
          type: fridge.type,
          compartmentCount: fridge.compartments.length,
          itemCount: fridge.compartments.reduce(
            (count, compartment) => count + compartment._count.items,
            0,
          ),
        }))}
      />

      <Link
        href="/fridges/new"
        className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
      >
        Add another fridge
      </Link>
    </main>
  );
}
