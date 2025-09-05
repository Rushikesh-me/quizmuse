'use client';
import './globals.css';
import React, { useEffect, useState } from 'react';
import Topbar from '../components/Topbar';
import { Toaster } from '@/components/ui/toaster';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <html lang="en" className={theme}>
      <head>
        <title>QuizMuse</title>
        <meta name="description" content="AI-powered PDF quiz generation and document chat" />
      </head>
      <body className="antialiased bg-background text-foreground">
        <div className="min-h-screen flex flex-col">
          <Topbar theme={theme} setTheme={setTheme} />
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
