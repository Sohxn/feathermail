import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS, useTheme } from "@/components/theme/ThemeProvider";
import { LIQUID_WALLPAPERS } from "@/components/theme/themePresets";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { theme, setTheme, wallpaper, setWallpaper } = useTheme();
  const isNeo = theme === "neo";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="glass-black w-[24rem] max-h-[80vh] overflow-hidden rounded-3xl border border-border/80 shadow-[0_32px_120px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-5 py-4 border-b",
          isNeo ? "border-border bg-card" : "border-white/10 bg-white/[0.02]"
        )}>
          <h2 className="font-semibold">Settings</h2>
          <button onClick={onClose} className={cn("p-1 rounded-md transition-colors", isNeo ? "hover:bg-secondary" : "hover:bg-white/10")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-sm font-medium mb-3">Theme</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "overflow-hidden rounded-2xl border text-left transition-all duration-200",
                    isActive
                      ? isNeo
                        ? "border-border shadow-[0_16px_40px_rgba(0,0,0,0.45)] scale-[1.01]"
                        : "border-white/40 shadow-[0_16px_40px_rgba(0,0,0,0.45)] scale-[1.01]"
                      : isNeo
                        ? "border-border hover:border-muted-foreground"
                        : "border-white/10 hover:border-white/25"
                  )}
                >
                  <div className="h-20" style={{ background: option.preview }} />
                  <div className={cn("p-3.5", isNeo ? "bg-card" : "bg-black/50 backdrop-blur-sm")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{option.name}</span>
                      {isActive && <span className={cn("text-[10px] uppercase tracking-[0.2em]", isNeo ? "text-muted-foreground" : "text-white/65")}>Active</span>}
                    </div>
                    <p className={cn("mt-1 text-xs", isNeo ? "text-muted-foreground" : "text-white/60")}>{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Liquid theme submenu */}
          {theme === 'liquid' && (
            <>
              <h4 className="text-sm font-medium mt-4 mb-2">Liquid Wallpapers</h4>
              <div className="grid grid-cols-3 gap-2.5">
                {LIQUID_WALLPAPERS.map((value, index) => (
                  <button
                    key={value}
                    onClick={() => setWallpaper(value)}
                    className={`h-16 rounded-md border-2 transition-all ${
                      wallpaper === value
                        ? isNeo
                          ? "border-border"
                          : "border-white"
                        : isNeo
                          ? "border-border hover:border-muted-foreground"
                          : "border-white/10 hover:border-white/25"
                    }`}
                    style={{ background: value }}
                    title={`liquid_wall_${index + 1}`}
                  />
                ))}
              </div>
              <p className={cn("text-xs mt-2", isNeo ? "text-muted-foreground" : "text-white/55")}>Three liquid wallpapers for the liquid theme</p>
            </>
          )}
          <p className={cn("text-xs mt-3", isNeo ? "text-muted-foreground" : "text-white/55")}>
            Click a swatch to change the background
          </p>
        </div>
      </div>
    </div>
  );
}
