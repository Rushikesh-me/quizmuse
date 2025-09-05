import React from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Bot } from 'lucide-react';

interface TopbarProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export default function Topbar({ theme, setTheme }: TopbarProps) {
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <header className="h-[73px] border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-1  ml-10 lg:ml-0">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">QuizMuse</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="h-9 w-9 p-0 hover:bg-secondary"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
