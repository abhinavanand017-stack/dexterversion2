import { useEffect } from "react";
import { Moon } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type ThemeVariant = "cyber" | "midnight";

export function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage<ThemeVariant>("dx_theme", "cyber");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <button
      onClick={() => setTheme(theme === "cyber" ? "midnight" : "cyber")}
      title={`Theme: ${theme === "cyber" ? "Cyber Dark" : "Midnight Blue"} (click to switch)`}
      className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-card/40 hover:bg-card text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
    >
      <Moon className="h-3 w-3" />
      {theme === "cyber" ? "Cyber" : "Midnight"}
    </button>
  );
}
