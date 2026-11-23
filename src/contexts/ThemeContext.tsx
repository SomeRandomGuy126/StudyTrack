import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const ACCENTS = [
  { id: 'ink', label: 'Pen ink', hint: 'Blue exercise-book ink', color: '#2740d6', hover: '#1d31b0', secondary: '#14213d' },
  { id: 'green', label: 'Fresh green', hint: 'Calm and focused', color: '#22c55e', hover: '#16a34a', secondary: '#166534' },
  { id: 'violet', label: 'Violet', hint: 'Soft and creative', color: '#8b5cf6', hover: '#7c3aed', secondary: '#5b21b6' },
  { id: 'amber', label: 'Amber', hint: 'Warm and bright', color: '#f59e0b', hover: '#d97706', secondary: '#92400e' },
  { id: 'rose', label: 'Rose', hint: 'Bold pink-red', color: '#f43f5e', hover: '#e11d48', secondary: '#9f1239' },
  { id: 'cyan', label: 'Ocean cyan', hint: 'Cool and clear', color: '#06b6d4', hover: '#0891b2', secondary: '#155e75' },
  { id: 'web-hero', label: 'Web hero', hint: 'Comic red and deep navy palette', color: '#e11d48', hover: '#be123c', secondary: '#1e3a8a' },
  { id: 'grand-voyage', label: 'Grand voyage', hint: 'Sea blue and treasure gold palette', color: '#d6a441', hover: '#b88722', secondary: '#0c4a6e' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
export type ThemeMode = 'light' | 'dark' | 'system';
type Theme = 'light' | 'dark';
export type InterfaceSize = 'compact' | 'comfortable' | 'large';

type ThemeContextValue = {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  accent: AccentId;
  setAccent: (a: AccentId) => void;
  accentColor: string;
  accentHover: string;
  interfaceSize: InterfaceSize;
  setInterfaceSize: (size: InterfaceSize) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredValue<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value && allowed.includes(value as T) ? value as T : fallback;
  } catch {
    return fallback;
  }
}

function getSystemTheme(): Theme {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  return media?.matches ? 'dark' : 'light';
}

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function mixColor(base: [number, number, number], target: [number, number, number], amount: number): string {
  return base.map((channel, i) => Math.round(channel + (target[i] - channel) * amount)).join(' ');
}

function applyAccent(accent: (typeof ACCENTS)[number]) {
  const root = document.documentElement;
  const rgb = toRgb(accent.color);
  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [255, 255, 255];
  const shades: Record<string, string> = {
    50: mixColor(rgb, white, 0.94),
    100: mixColor(rgb, white, 0.88),
    200: mixColor(rgb, white, 0.74),
    300: mixColor(rgb, white, 0.56),
    400: mixColor(rgb, white, 0.26),
    500: rgb.join(' '),
    600: mixColor(rgb, black, 0.14),
    700: mixColor(rgb, black, 0.26),
    800: mixColor(rgb, black, 0.38),
    900: mixColor(rgb, black, 0.50),
    950: mixColor(rgb, black, 0.60),
  };

  root.style.setProperty('--accent', accent.color);
  root.style.setProperty('--accent-hover', accent.hover);
  root.style.setProperty('--accent-rgb', rgb.join(' '));
  root.style.setProperty('--accent-secondary', accent.secondary);
  root.style.setProperty('--accent-secondary-rgb', toRgb(accent.secondary).join(' '));
  Object.entries(shades).forEach(([shade, value]) => {
    root.style.setProperty(`--brand-${shade}-rgb`, value);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    readStoredValue('studytrack-theme', ['light', 'dark', 'system'] as const, 'system')
  );
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme());
  const [accent, setAccentState] = useState<AccentId>(() =>
    readStoredValue('studytrack-accent', ACCENTS.map((item) => item.id), 'ink')
  );
  const [interfaceSize, setInterfaceSizeState] = useState<InterfaceSize>(() =>
    readStoredValue('studytrack-interface-size', ['compact', 'comfortable', 'large'] as const, 'comfortable')
  );

  const theme: Theme = themeMode === 'system' ? systemTheme : themeMode;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const updateSystemTheme = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', updateSystemTheme);
    return () => media.removeEventListener?.('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.dataset.themeMode = themeMode;
    root.style.colorScheme = theme;
    try {
      localStorage.setItem('studytrack-theme', themeMode);
    } catch {
      // The selected theme still works for this session when storage is unavailable.
    }
  }, [theme, themeMode]);

  useEffect(() => {
    const selected = ACCENTS.find((item) => item.id === accent) ?? ACCENTS[0];
    applyAccent(selected);
    try {
      localStorage.setItem('studytrack-accent', accent);
    } catch {
      // The selected accent still works for this session when storage is unavailable.
    }
  }, [accent]);

  useEffect(() => {
    const root = document.documentElement;
    const sizes: Record<InterfaceSize, string> = {
      compact: '14px',
      comfortable: '16px',
      large: '18px',
    };
    root.style.fontSize = sizes[interfaceSize];
    root.dataset.interfaceSize = interfaceSize;
    try {
      localStorage.setItem('studytrack-interface-size', interfaceSize);
    } catch {
      // The selected size still works for this session when storage is unavailable.
    }
  }, [interfaceSize]);

  const toggleTheme = () => setThemeMode((prev) => {
    const effective = prev === 'system' ? systemTheme : prev;
    return effective === 'light' ? 'dark' : 'light';
  });
  const setTheme = (mode: ThemeMode) => setThemeMode(mode);
  const setAccent = (value: AccentId) => setAccentState(value);
  const setInterfaceSize = (size: InterfaceSize) => setInterfaceSizeState(size);
  const accentColor = ACCENTS.find((item) => item.id === accent)?.color ?? ACCENTS[0].color;
  const accentHover = ACCENTS.find((item) => item.id === accent)?.hover ?? ACCENTS[0].hover;

  return (
    <ThemeContext.Provider value={{
      theme, themeMode, toggleTheme, setTheme, accent, setAccent,
      accentColor, accentHover, interfaceSize, setInterfaceSize,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
