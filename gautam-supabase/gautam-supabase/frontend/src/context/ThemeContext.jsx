import React, { createContext, useContext, useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ThemeContext = createContext(null);

// The setting is stored in the user's profile, so it follows their account on every device.
export function ThemeProvider({ children }) {
  const { user, refresh } = useAuth();
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    const saved = user?.settings?.theme;
    setThemeState(saved === "dark" ? "dark" : "light");
  }, [user?.settings?.theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = async (nextTheme) => {
    const next = nextTheme === "dark" ? "dark" : "light";
    setThemeState(next);
    try {
      await settingsApi.update({ theme: next });
      await refresh();
    } catch {
      // Keep the chosen look for this session if the network is temporarily unavailable.
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
