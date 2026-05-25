import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS, useTheme } from "@/components/theme/ThemeProvider";

// Liquid theme specific wallpapers (three options)
const liquidWallpapers = [
  { id: 'liquid_wall_1', name: 'liquid_wall_1', value: "url('/wallpaper/liquid_wall_1.jpg')" },
  { id: 'liquid_wall_2', name: 'liquid_wall_2', value: "url('/wallpaper/liquid_wall_2.jpg')" },
  { id: 'liquid_wall_3', name: 'liquid_wall_3', value: "url('/wallpaper/liquid_wall_3.jpg')" },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaper: string;
  onWallpaperChange: (wallpaper: string) => void;
}

export function SettingsPanel({ isOpen, onClose, currentWallpaper, onWallpaperChange }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg w-96 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">Theme</h3>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "overflow-hidden rounded-lg border text-left transition-all",
                    isActive ? "border-foreground shadow-lg" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <div className="h-16" style={{ background: option.preview }} />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{option.name}</span>
                      {isActive && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Active</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Liquid theme submenu */}
          {theme === 'liquid' && (
            <>
              <h4 className="text-sm font-medium mt-4 mb-2">Liquid Wallpapers</h4>
              <div className="grid grid-cols-3 gap-2">
                {liquidWallpapers.map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => onWallpaperChange(wp.value)}
                    className={`h-16 rounded-md border-2 transition-all ${
                      currentWallpaper === wp.value
                        ? "border-foreground"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    style={{ background: wp.value }}
                    title={wp.name}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Three liquid wallpapers for the liquid theme</p>
            </>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Click a swatch to change the background
          </p>
        </div>
      </div>
    </div>
  );
}
