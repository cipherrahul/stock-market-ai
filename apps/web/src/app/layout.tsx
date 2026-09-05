import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import React from 'react';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sovereign AI — Enterprise Trading Platform',
  description: 'Institutional-grade algorithmic trading, AI-powered signals, and autonomous portfolio management.',
  keywords: ['trading', 'portfolio', 'AI signals', 'algorithmic trading', 'NSE', 'BSE'],
  openGraph: {
    title: 'Sovereign AI — Enterprise Trading Platform',
    description: 'Institutional-grade autonomous trading and portfolio management.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
