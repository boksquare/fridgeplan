import Link from 'next/link';
import { requireUserPage } from '@/lib/page-guards';
import { runDiagnostics } from '@/lib/diagnostics';

// Every check makes live calls, so this must never be cached.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Diagnostics — Fridgeplan' };

const STYLES = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  warn: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  fail: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
} as const;

const LABELS = { ok: 'OK', warn: 'Check', fail: 'Failing' } as const;

export default async function DiagnosticsPage() {
  const user = await requireUserPage();
  const checks = await runDiagnostics(user.id);
  const failing = checks.filter((check) => check.status === 'fail').length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/settings"
          className="w-fit text-sm text-slate-600 underline decoration-dotted hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Diagnostics</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Live checks against the recipe sources and the AI provider, run just now.
          {failing > 0 ? ` ${failing} check${failing === 1 ? '' : 's'} failing.` : ' Everything answering.'}
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {checks.map((check) => (
          <li
            key={check.name}
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border p-4 text-sm ${STYLES[check.status]}`}
          >
            <span className="font-medium">{check.name}</span>
            <span className="flex items-baseline gap-2">
              <span className="opacity-80">{check.detail}</span>
              <span className="rounded-full border border-current/30 px-2 py-0.5 text-xs font-semibold">
                {LABELS[check.status]}
                {check.ms === undefined ? '' : ` · ${check.ms}ms`}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Reload to run them again. The same output is available as JSON at{' '}
        <code>/api/diagnostics</code>.
      </p>
    </main>
  );
}
