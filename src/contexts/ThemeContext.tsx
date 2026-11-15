import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const ACCENTS = [
  { id: 'blue', color: '#3b82f6', hover: '#2563eb' },
  { id: 'green', color: '#22c55e', hover: '#16a34a' },
  { id: 'violet', color: '#8b5cf6', hover: '#7c3aed' },
  { id: 'amber', color: '#f59e0b', hover: '#d97706' },
  { id: 'rose', color: '#f43f5e', hover: '#e11d48' },
  { id: 'cyan', color: '#06b6d4', hover: '#0891b2' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  accent: AccentId;
  setAccent: (a: AccentId) => void;
  accentColor: string;
  accentHover: string;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('studytrack-theme') as Theme | null;
    if (saved) return saved;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });
  const [accent, setAccentState] = useState<AccentId>(() => {
    const saved = localStorage.getItem('studytrack-accent') as AccentId | null;
    return saved && ACCENTS.some((a) => a.id === saved) ? saved : 'blue';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('studytrack-theme', theme);
  }, [theme]);

  useEffect(() => {
    const found = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
    const root = document.documentElement;
    root.style.setProperty('--accent', found.color);
    root.style.setProperty('--accent-hover', found.hover);
    localStorage.setItem('studytrack-accent', accent);
  }, [accent]);

  const toggleTheme = () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  const setTheme = (t: Theme) => setThemeState(t);
  const setAccent = (a: AccentId) => setAccentState(a);
  const accentColor = ACCENTS.find((a) => a.id === accent)?.color ?? ACCENTS[0].color;
  const accentHover = ACCENTS.find((a) => a.id === accent)?.hover ?? ACCENTS[0].hover;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, accent, setAccent, accentColor, accentHover }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
