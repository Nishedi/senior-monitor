import { useEffect, useState } from "react";

const STORAGE_KEY = "senior-monitor-mode";

export function useMode() {
  const [mode, setMode] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "admin" || s === "user") {
        return s;
      }
    } catch {
      /* ignore */
    }
    return "user";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === "admin" ? "user" : "admin"));

  return { mode, setMode, toggleMode };
}
