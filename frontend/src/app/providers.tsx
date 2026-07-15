"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthProvider } from "@/features/auth/AuthContext";

type Mode = "dark" | "light";

interface ThemeState {
  darkMode: boolean;
  mode: Mode;
  toggle: () => void;
  setMode: (m: Mode) => void;
}
const ThemeCtx = createContext<ThemeState>({
  darkMode: true,
  mode: "dark",
  toggle: () => {},
  setMode: () => {},
});
export const useThemeMode = () => useContext(ThemeCtx);

export default function Providers({ children }: { children: React.ReactNode }) {
  // Design is dark-first (Open WebUI style); persisted per user.
  const [mode, setModeState] = useState<Mode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("themeMode");
    if (saved === "light" || saved === "dark") setModeState(saved);
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    if (mounted) localStorage.setItem("themeMode", mode);
  }, [mode, mounted]);

  const setMode = (m: Mode) => setModeState(m);
  const toggle = () => setModeState((m) => (m === "dark" ? "light" : "dark"));

  return (
    <ThemeCtx.Provider value={{ darkMode: mode === "dark", mode, toggle, setMode }}>
      <AuthProvider>{children}</AuthProvider>
    </ThemeCtx.Provider>
  );
}
