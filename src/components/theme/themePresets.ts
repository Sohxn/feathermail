export type ThemeName = "liquid" | "neo";

export interface ThemePreset {
  id: ThemeName;
  name: string;
  description: string;
  preview: string;
  cssVars: Record<string, string>;
}

export const LIQUID_WALLPAPERS = [
  "url('/wallpaper/liquid_wall_1.jpg')",
  "url('/wallpaper/liquid_wall_2.jpg')",
  "url('/wallpaper/liquid_wall_3.jpg')",
];

export const DEFAULT_LIQUID_WALLPAPER = LIQUID_WALLPAPERS[0];

const sharedRadiusVars = {
  "--radius-sm": "10px",
  "--radius-md": "12px",
  "--radius-lg": "16px",
  "--radius-xl": "18px",
  "--radius-2xl": "24px",
  "--radius-3xl": "30px",
  "--radius-full": "9999px",
};

const sharedTypographyVars = {
  "--font-family-base": "'Roboto Mono', monospace",
  "--font-family-brand": "'Magnolia Script', cursive",
  "--font-weight-base": "600",
  "--font-weight-medium": "600",
  "--font-weight-semibold": "700",
  "--font-weight-bold": "800",
};

const liquidGlassVars = {
  "--lg-blur": "blur(8px)",
  "--lg-saturate": "saturate(120%)",
  "--lg-brightness": "brightness(1.05)",
  "--lg-bg": "rgba(255,255,255,0.02)",
  "--lg-bg-hover": "rgba(255,255,255,0.06)",
  "--lg-bg-active": "rgba(255,255,255,0.08)",
  "--lg-bg-dark": "rgba(10,12,16,0.92)",
  "--lg-border": "rgba(255,255,255,0.04)",
  "--lg-border-hover": "rgba(173, 255, 221, 0.10)",
  "--lg-inset": "inset 0 1px 0 rgba(255,255,255,0.06)",
  "--lg-inset-hover": "inset 0 1px 0 rgba(255,255,255,0.08)",
  "--lg-glare": "radial-gradient(ellipse 90% 48% at 50% 110%, rgba(0,0,0,0.26) 0%, transparent 68%)",
  "--lg-shadow-sm": "0 6px 18px rgba(0,0,0,0.16)",
  "--lg-shadow-md": "0 12px 30px rgba(0,0,0,0.20)",
  "--lg-shadow-lg": "0 22px 60px rgba(0,0,0,0.28)",
  "--lg-refraction": "1",
};

const neoGlassVars = {
  "--lg-blur": "blur(0px)",
  "--lg-saturate": "saturate(100%)",
  "--lg-brightness": "brightness(1)",
  "--lg-bg": "rgba(10,10,10,0.96)",
  "--lg-bg-hover": "rgba(20,20,20,0.98)",
  "--lg-bg-active": "rgba(32,32,32,1)",
  "--lg-bg-dark": "rgba(4,4,4,0.98)",
  "--lg-border": "rgba(255,255,255,0.08)",
  "--lg-border-hover": "rgba(255,255,255,0.18)",
  "--lg-inset": "none",
  "--lg-inset-hover": "none",
  "--lg-glare": "none",
  "--lg-shadow-sm": "none",
  "--lg-shadow-md": "none",
  "--lg-shadow-lg": "none",
  "--lg-refraction": "1",
};

export const THEME_PRESETS: Record<ThemeName, ThemePreset> = {
  liquid: {
    id: "liquid",
    name: "Liquid",
    description: "Keeps the current frosted glass feel.",
    preview: "linear-gradient(135deg, #091018 0%, #1a2a35 50%, #364a5b 100%)",
    cssVars: {
      "--background": "#050507",
      "--foreground": "#f4f7fb",
      "--card": "transparent",
      "--card-foreground": "#f4f7fb",
      "--popover": "#0b0d11",
      "--popover-foreground": "#f4f7fb",
      "--primary": "#d8ffe8",
      "--primary-foreground": "#060607",
      "--secondary": "rgba(255,255,255,0.06)",
      "--secondary-foreground": "#f4f7fb",
      "--muted": "rgba(255,255,255,0.05)",
      "--muted-foreground": "rgba(244,247,251,0.58)",
      "--accent": "rgba(148,255,221,0.12)",
      "--accent-foreground": "#f4f7fb",
      "--destructive": "#ff6b6b",
      "--destructive-foreground": "#ffffff",
      "--border": "rgba(255,255,255,0.10)",
      "--input": "rgba(255,255,255,0.08)",
      "--ring": "rgba(173,255,221,0.28)",
      "--radius": "0.375rem",
      "--red": "#ff6b6b",
      "--mailbody": "rgba(244,247,251,0.78)",
      "--mailbody-title": "#f4f7fb",
      "--email-hover": "rgba(255,255,255,0.05)",
      "--email-selected": "rgba(173,255,221,0.10)",
      "--sidebar-background": "transparent",
      "--sidebar-foreground": "#f4f7fb",
      "--sidebar-primary": "#d8ffe8",
      "--sidebar-primary-foreground": "#060607",
      "--sidebar-accent": "rgba(255,255,255,0.06)",
      "--sidebar-accent-foreground": "#f4f7fb",
      "--sidebar-border": "rgba(255,255,255,0.10)",
      "--sidebar-ring": "rgba(173,255,221,0.28)",
      "--app-background": "linear-gradient(180deg, #050507 0%, #090b0f 55%, #050507 100%)",
      ...sharedRadiusVars,
      ...sharedTypographyVars,
      ...liquidGlassVars,
    },
  },
  neo: {
    id: "neo",
    name: "Neo",
    description: "Black background with solid pastel surfaces and no transparency.",
    preview: [
      "linear-gradient(180deg, #050505 0%, #090909 100%)",
      "linear-gradient(90deg, #ff6b6b 0 25%, #ffb86b 25% 50%, #ffe66b 50% 75%, #8fd19e 75% 100%)",
    ].join(", "),
    cssVars: {
      "--background": "#272833",
      "--foreground": "#ffffff",
      "--card": "#272833",
      "--card-foreground": "#f5f5f5",
      "--popover": "#171717",
      "--popover-foreground": "#f5f5f5",
      "--primary": "#b4b3ff",
      "--primary-foreground": "#050505",
      "--secondary": "#202020",
      "--secondary-foreground": "#f5f5f5",
      "--muted": "#242424",
      "--muted-foreground": "#dedede",
      "--accent": "#9694ff",
      "--accent-foreground": "#050505",
      "--destructive": "#ff6464",
      "--destructive-foreground": "#ffffff",
      "--border": "#2e2e2e",
      "--input": "#232323",
      "--ring": "#f1b86b",
      "--radius": "1rem",
      "--red": "#ff6464",
      "--mailbody": "#ffffff",
      "--mailbody-title": "#ffffff",
      "--email-hover": "#1c1c1c",
      "--email-selected": "#262626",
      "--sidebar-background": "#0b0b0b",
      "--sidebar-foreground": "#f5f5f5",
      "--sidebar-primary": "#f1b86b",
      "--sidebar-primary-foreground": "#050505",
      "--sidebar-accent": "#202020",
      "--sidebar-accent-foreground": "#f5f5f5",
      "--sidebar-border": "#2e2e2e",
      "--sidebar-ring": "#f1b86b",
      "--app-background": "#1a1b22",
      ...sharedRadiusVars,
      ...sharedTypographyVars,
      ...neoGlassVars,
    },
  },
};

export const THEME_OPTIONS = Object.values(THEME_PRESETS);