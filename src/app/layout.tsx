import type { Metadata } from 'next';
import './globals.css';
import { AppHeader } from '@/components/app-header';
import { AmbientBackground } from '@/components/ambient-background';

/**
 * The header reads the deployment mode and the session, so every route under
 * this layout depends on live data and none of it may be prerendered. Without
 * this, `next build` tries to statically render the generated /_not-found page,
 * runs the header, and asks a database that does not exist at build time.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fridgeplan',
  description: 'Your fridge is the interface: track what is inside, cook what you have.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AmbientBackground />
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
