"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  THEME_STORAGE_KEY,
  nextThemePreference,
  parseThemePreference,
  resolveDarkMode,
  themeToggleLabel,
  type ThemePreference,
} from "@/lib/theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// The preference lives in localStorage, which React cannot observe on its own.
// A tiny store keeps the control in sync with this tab's writes, another tab's
// writes, and the OS setting changing underneath a "system" preference.
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const onSystemChange = () => {
    if (readPreference() === "system") applyTheme(mediaQuery.matches);
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyTheme(resolveDarkMode(readPreference(), mediaQuery.matches));
    listener();
  };

  mediaQuery.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    mediaQuery.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function writePreference(preference: ThemePreference) {
  try {
    // System is stored as absence, so an explicit override can be undone.
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A browser blocking storage still gets the theme for this page view.
  }
  emit();
}

/** The server has no storage to read, and the pre-paint script owns first paint. */
function getServerSnapshot(): ThemePreference {
  return "system";
}

const icons: Record<ThemePreference, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readPreference, getServerSnapshot);

  const cycleTheme = useCallback(() => {
    const next = nextThemePreference(readPreference());
    writePreference(next);
    applyTheme(resolveDarkMode(next, systemPrefersDark()));
  }, []);

  const Icon = icons[preference];

  return (
    <Button type="button" variant="ghost" size="icon" onClick={cycleTheme} title={themeToggleLabel(preference)}>
      <Icon key={preference} className="theme-icon size-4" aria-hidden="true" />
      <span className="sr-only">{themeToggleLabel(preference)}</span>
    </Button>
  );
}
