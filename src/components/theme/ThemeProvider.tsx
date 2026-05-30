import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LIQUID_WALLPAPER,
  LIQUID_WALLPAPERS,
  THEME_OPTIONS,
  THEME_PRESETS,
  type ThemeName,
} from "@/components/theme/themePresets";

export { THEME_OPTIONS };
export type { ThemeName };

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  wallpaper: string;
  setWallpaper: (wallpaper: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "feathermail-theme";
const WALLPAPER_KEY = 'wallpaper';

function getSavedTheme(): ThemeName {
  if (typeof window === "undefined") return "liquid";
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  return THEME_OPTIONS.some(theme => theme.id === savedTheme) ? (savedTheme as ThemeName) : "liquid";
}

function getSavedWallpaper(): string {
  if (typeof window === "undefined") return DEFAULT_LIQUID_WALLPAPER;
  const savedWallpaper = localStorage.getItem(WALLPAPER_KEY) || "";
  return LIQUID_WALLPAPERS.includes(savedWallpaper) ? savedWallpaper : DEFAULT_LIQUID_WALLPAPER;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(getSavedTheme);
  const [wallpaper, setWallpaperState] = useState(getSavedWallpaper);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    setThemeState(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }, []);

  const setWallpaper = useCallback((nextWallpaper: string) => {
    const validWallpaper = LIQUID_WALLPAPERS.includes(nextWallpaper) ? nextWallpaper : DEFAULT_LIQUID_WALLPAPER;
    setWallpaperState(validWallpaper);
    localStorage.setItem(WALLPAPER_KEY, validWallpaper);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const preset = THEME_PRESETS[theme];

    root.dataset.theme = theme;

    Object.entries(preset.cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    if (typeof window !== 'undefined') {
      try {
        if (theme === 'liquid') {
          const nextWallpaper = LIQUID_WALLPAPERS.includes(wallpaper) ? wallpaper : DEFAULT_LIQUID_WALLPAPER;
          if (nextWallpaper !== wallpaper) {
            setWallpaperState(nextWallpaper);
          }
          root.style.setProperty('--app-background', nextWallpaper);
          localStorage.setItem(WALLPAPER_KEY, nextWallpaper);
        } else {
          root.style.setProperty('--app-background', preset.cssVars['--app-background']);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [theme, wallpaper]);

  const value = useMemo(() => ({ theme, setTheme, wallpaper, setWallpaper }), [theme, setTheme, wallpaper, setWallpaper]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}