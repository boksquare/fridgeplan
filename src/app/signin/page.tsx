import { redirect } from 'next/navigation';
import { getDeploymentMode } from '@/lib/deployment-mode';
import { SignInForm } from '@/components/signin-form';

// Every page here branches on the DeploymentMode row, so nothing may be
// prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sign in — Fridgeplan' };

export default async function SignInPage() {
  const mode = await getDeploymentMode();
  if (!mode) redirect('/setup');
  // Personal self-host has no login at all.
  if (mode === 'personal_self_host') redirect('/');

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <SignInForm />
    </main>
  );
}
