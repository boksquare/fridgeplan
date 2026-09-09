import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { UnitSystemForm } from '@/components/unit-system-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings — Fridgeplan' };

export default async function SettingsPage() {
  const user = await requireUserPage();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to the fridge
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Measurements</h2>
        <UnitSystemForm current={user.unitSystem} />
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">AI provider</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Used for ingredient substitutions, and for working out the unit of an ingredient the
          built-in list does not know.
        </p>
        <Link
          href="/settings/ai"
          className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Open AI provider settings
        </Link>
      </section>
    </main>
  );
}
