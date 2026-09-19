import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ThemeContext = createContext();

function applyTheme(isDark) {
  const root = document.documentElement;
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.classList.toggle('dark', isDark);
  localStorage.setItem('theme-preference', isDark ? 'dark' : 'light');
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme-preference');
    if (saved) return saved === 'dark';
    return true;
  });

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ isDark, toggle }), [isDark, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export function useOptionalTheme() {
  return useContext(ThemeContext);
}
