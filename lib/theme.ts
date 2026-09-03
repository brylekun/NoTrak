export const THEME_STORAGE_KEY = "notrak-theme";

/**
 * "system" is the default and is represented by the absence of a stored value,
 * so a visitor who never touches the toggle keeps following their OS setting.
 * Choosing System again removes the stored override rather than pinning it.
 */
export type ThemePreference = "system" | "light" | "dark";

export const themeCycle: ThemePreference[] = ["system", "light", "dark"];

export function nextThemePreference(current: ThemePreference): ThemePreference {
  return themeCycle[(themeCycle.indexOf(current) + 1) % themeCycle.length];
}

export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveDarkMode(preference: ThemePreference, systemPrefersDark: boolean) {
  return preference === "system" ? systemPrefersDark : preference === "dark";
}

export function themeToggleLabel(current: ThemePreference) {
  const next = nextThemePreference(current);
  const names: Record<ThemePreference, string> = {
    system: "system",
    light: "light",
    dark: "dark",
  };
  return `Color theme: ${names[current]}. Switch to ${names[next]}.`;
}
