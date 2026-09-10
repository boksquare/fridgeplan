import Link from 'next/link';
import { getCurrentUser } from '@/lib/current-user';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { signOutAction } from '@/app/actions/auth';
import { AccountMenu } from '@/components/account-menu';

/**
 * The bar every signed-in page sits under.
 *
 * It exists mostly so there is somewhere for the things a session needs and had
 * nowhere to live: who you are signed in as, the way out, and the household.
 * What it shows depends on the mode — a personal self-host instance has no
 * account to sign out of, so it gets the navigation and nothing else.
 */
export async function AppHeader() {
  const [mode, user] = await Promise.all([getDeploymentMode(), getCurrentUser()]);
  const hosted = mode === 'public_hosted';

  // No chrome before setup, and none for a visitor with no account: the setup
  // wizard, the sign-in pages and guest mode are all self-contained, and a nav
  // bar pointing at pages they cannot open would only mislead.
  if (!mode || !user) return null;

  // The bar is translucent so the drifting colour behind carries through
  // instead of being cut off by an opaque band; the blur keeps text legible.
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/65 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-cyan-300 text-[13px] text-slate-900 shadow-sm"
          >
            F
          </span>
          {/* The wordmark is the first thing to go on a narrow screen: the mark
              still links home, and the nav and account button both have to fit
              at 390px without the row scrolling sideways. */}
          <span className="hidden sm:inline">Fridgeplan</span>
        </Link>

        <nav className="ml-auto flex items-center gap-0.5 text-sm sm:gap-1">
          <HeaderLink href="/">Fridge</HeaderLink>
          <HeaderLink href="/recipes">Recipes</HeaderLink>
          <HeaderLink href="/settings">Settings</HeaderLink>
        </nav>

        {hosted && user ? (
          <AccountMenu
            name={user.name ?? user.email}
            email={user.email}
            signOut={signOutAction}
          />
        ) : null}
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:px-2.5 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}
