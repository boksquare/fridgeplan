import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fridgeplan',
  description: 'Your fridge is the interface: track what is inside, cook what you have.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
