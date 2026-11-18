"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";

const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);
  const { systemTheme, theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentTheme = theme === "system" ? systemTheme : theme;

  return (
    <button
      type="button"
      onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      aria-label={currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={currentTheme === "dark"}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {currentTheme === "dark" ? (
        <SunIcon className="h-5 w-5 text-yellow-300" aria-hidden="true" />
      ) : (
        <MoonIcon className="h-5 w-5 text-foreground" aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;
