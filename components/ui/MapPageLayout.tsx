'use client';

import Link from 'next/link';
import React, { ReactNode } from 'react';
import { ThemeSwitcher } from '@/components/themes';
import { PlaybackProvider } from '@/components/ui/PlaybackContext';
import { PlaybackControls } from '@/components/ui/PlaybackControls';

interface MapPageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function MapPageLayout({
  title,
  description,
  children
}: MapPageLayoutProps): React.ReactElement {
  return (
    <div className="min-h-screen" style={{
      background: `linear-gradient(135deg, var(--bg-primary), var(--bg-secondary))`
    }}>
      <header className="p-6 border-b border-opacity-30" style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-header)'
      }}>
        <div className="container mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <Link href="/" className="text-sm mb-2 inline-block" style={{ color: 'var(--text-secondary)' }}>
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-accent)' }}>
              {title}
            </h1>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      <main className="container mx-auto p-6">
        <PlaybackProvider>
          <div className="mb-4">
            <PlaybackControls />
          </div>
          {children}
        </PlaybackProvider>
      </main>
    </div>
  );
}
