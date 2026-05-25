import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeName = "liquid" | "neo";

export const THEME_OPTIONS: Array<{
  id: ThemeName;
  name: string;
  description: string;
  preview: string;
}> = [
  {
    id: "liquid",
    name: "Liquid",
    description: "Keeps the current frosted glass feel.",
    preview: "linear-gradient(135deg, #091018 0%, #1a2a35 50%, #364a5b 100%)",
  },
  {
    id: "neo",
    name: "Neo",
    description: "Solid, non-transparent UI — no glass effects.",
    preview: "linear-gradient(135deg, #f6f7f9 0%, #e6e8eb 100%)",
  },
];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "feathermail-theme";

function getSavedTheme(): ThemeName {
  if (typeof window === "undefined") return "liquid";
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  return THEME_OPTIONS.some(theme => theme.id === savedTheme) ? (savedTheme as ThemeName) : "liquid";
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