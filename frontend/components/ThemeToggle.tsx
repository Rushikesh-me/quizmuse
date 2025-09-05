// frontend/components/ThemeToggle.tsx
'use client';
import React from 'react';

export default function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}) {
  return (
    <button
      aria-label="Toggle theme"
      className="theme-toggle"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
