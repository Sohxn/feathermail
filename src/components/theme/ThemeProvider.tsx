import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeName = "midnight" | "aurora" | "liquid" | "graphite";

export const THEME_OPTIONS: Array<{
  id: ThemeName;
  name: string;
  description: string;
  preview: string;
}> = [
  {
    id: "midnight",
    name: "Midnight",
    description: "Black background with muted pastel accents.",
    preview: "linear-gradient(135deg, #050507 0%, #0d1117 55%, #1c2430 100%)",
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "A slightly brighter glow with soft teal and rose tones.",
    preview: "linear-gradient(135deg, #06111a 0%, #0f2230 45%, #2f284a 100%)",
  },
  {
    id: "liquid",
    name: "Liquid",
    description: "Keeps the current frosted glass feel.",
    preview: "linear-gradient(135deg, #091018 0%, #1a2a35 50%, #364a5b 100%)",
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Low-gloss, minimal, and more solid.",
    preview: "linear-gradient(135deg, #050505 0%, #131313 52%, #2a2a2a 100%)",
  },
];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "feathermail-theme";

function getSavedTheme(): ThemeName {
  if (typeof window === "undefined") return "midnight";
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  return THEME_OPTIONS.some(theme => theme.id === savedTheme) ? (savedTheme as ThemeName) : "midnight";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(getSavedTheme);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    setThemeState(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}