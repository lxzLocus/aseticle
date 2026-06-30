"use client";

import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthProvider } from "@/features/auth/AuthContext";

interface ThemeState {
  darkMode: boolean;
  toggle: () => void;
}
const ThemeCtx = createContext<ThemeState>({ darkMode: false, toggle: () => {} });
export const useThemeMode = () => useContext(ThemeCtx);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) setDarkMode(JSON.parse(saved));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode, mounted]);

  const toggle = () => setDarkMode((d) => !d);

  return (
    <ThemeCtx.Provider value={{ darkMode, toggle }}>
      <Theme
        appearance={darkMode ? "dark" : "light"}
        accentColor="mint"
        grayColor="gray"
        panelBackground="solid"
        scaling="100%"
        radius="full"
      >
        <AuthProvider>{children}</AuthProvider>
      </Theme>
    </ThemeCtx.Provider>
  );
}
