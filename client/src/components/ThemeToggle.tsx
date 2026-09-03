import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getStoredTheme, setTheme } from "../lib/theme";

/** Light/dark toggle. Persists to localStorage; defaults to the OS preference until the user picks explicitly. */
export function ThemeToggle() {
  const [theme, setThemeState] = useState(getStoredTheme());
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  function toggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-secondary hover:text-white"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
