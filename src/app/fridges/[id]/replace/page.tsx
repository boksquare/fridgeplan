import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserPage } from '@/lib/page-guards';
import { countItemsInFridge, getFridgeForUser } from '@/lib/fridges';
import { ReplaceFridgeFlow } from '@/components/replace-fridge-flow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Replace a fridge — Fridgeplan' };

export default async function ReplaceFridgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUserPage();
  const { id } = await params;

  const fridge = await getFridgeForUser(id, user.id);
  if (!fridge) notFound();

  const itemCount = await countItemsInFridge(fridge.id);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Replace {fridge.name}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Describe the fridge you have now. {itemCount === 0
            ? `${fridge.name} is empty, so nothing needs moving.`
            : `You will be asked what to do with the ${itemCount} item${itemCount === 1 ? '' : 's'} inside before anything changes.`}
        </p>
        <Link
          href="/fridges"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to your fridges
        </Link>
      </header>

      <ReplaceFridgeFlow
        fridge={{ id: fridge.id, name: fridge.name }}
        itemCount={itemCount}
      />
    </main>
  );
}
