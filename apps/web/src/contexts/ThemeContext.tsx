'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dracula';

interface ThemeContextValue {
  theme: Theme;
  isDracula: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const THEME_STORAGE_KEY = 'sovereign_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  const applyThemeToDOM = (t: Theme) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dracula') {
      document.documentElement.classList.add('dracula');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dracula');
      document.documentElement.classList.add('light');
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored === 'dracula' || stored === 'light') {
        setThemeState(stored);
        applyThemeToDOM(stored);
      } else {
        // Check if user has prefs_{userId} with darkMode flag
        const userId = localStorage.getItem('userId');
        if (userId) {
          const prefs = JSON.parse(localStorage.getItem(`prefs_${userId}`) || '{}');
          if (prefs.darkMode) {
            setThemeState('dracula');
            applyThemeToDOM('dracula');
            localStorage.setItem(THEME_STORAGE_KEY, 'dracula');
            return;
          }
        }
        // Check OS preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setThemeState('dracula');
          applyThemeToDOM('dracula');
          localStorage.setItem(THEME_STORAGE_KEY, 'dracula');
          return;
        }
        applyThemeToDOM('light');
      }
    } catch {
      applyThemeToDOM('light');
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      // Sync with prefs_{userId} if available
      const userId = localStorage.getItem('userId');
      if (userId) {
        const prefs = JSON.parse(localStorage.getItem(`prefs_${userId}`) || '{}');
        prefs.darkMode = newTheme === 'dracula';
        localStorage.setItem(`prefs_${userId}`, JSON.stringify(prefs));
      }
    } catch {
      /* ignore localStorage quota/access errors */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dracula' : 'light');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDracula: theme === 'dracula',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
