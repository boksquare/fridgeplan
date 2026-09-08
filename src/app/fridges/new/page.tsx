import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { listFridges } from '@/lib/fridges';
import { FridgeBuilder } from '@/components/fridge-builder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up your fridge — Fridgeplan' };

export default async function NewFridgePage() {
  const user = await requireUserPage();
  const fridges = await listFridges(user.id);
  const firstFridge = fridges.length === 0;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {firstFridge ? 'Set up your fridge' : 'Add another fridge'}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Pick the fridge you actually have. Its compartments are built from what you choose here.
        </p>
        {firstFridge ? null : (
          <Link
            href="/fridges"
            className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            ← Back to your fridges
          </Link>
        )}
      </header>

      <FridgeBuilder firstFridge={firstFridge} />
    </main>
  );
}
