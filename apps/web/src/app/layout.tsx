import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import React from 'react';
import './globals.css';
import { AlertContainer } from '@/components/AlertContainer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SOVEREIGN // Institutional Financial Agent',
  description: 'Pro-grade autonomous liquidity and asset management terminal.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <body className="bg-[#020617] text-slate-50 selection:bg-indigo-500/30">
        <AlertContainer />
        {children}
      </body>
    </html>
  );
}
