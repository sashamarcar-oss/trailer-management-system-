"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** Read the theme the inline boot script already resolved onto <html>. */
function getCurrentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Shared theme state. The actual class on <html> is set before hydration by the
 * inline script in the root layout (see themeInitScript), so this hook only
 * mirrors and mutates that single source of truth — every page stays in sync.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(getCurrentTheme());
  }, []);

  const applyTheme = (next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Persisting the preference is best-effort; theme still applies this session. */
    }
    setThemeState(next);
  };

  const toggleTheme = () => applyTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme: applyTheme, toggleTheme };
}

/**
 * Runs before first paint to apply the stored (or system) theme, preventing a
 * flash of the wrong theme. Stringified into a <script> in the root layout.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;
