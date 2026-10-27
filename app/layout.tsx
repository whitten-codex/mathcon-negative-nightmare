import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'MathCon: Negative Nightmare', description: 'Create. Solve. Survive. A multiplayer math showdown for 2–6 players.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
