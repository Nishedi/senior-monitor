import { useEffect, useState } from "react";

const STORAGE_KEY = "senior-monitor-theme";

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "dark" || s === "light") {
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = s;
        }
        return s;
      }
    } catch {
      /* ignore */
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggleTheme };
}
