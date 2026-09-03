import { describe, expect, it } from "vitest";

import {
  THEME_STORAGE_KEY,
  nextThemePreference,
  parseThemePreference,
  resolveDarkMode,
  themeCycle,
  themeToggleLabel,
  type ThemePreference,
} from "../../lib/theme";

describe("theme preference", () => {
  it("cycles system, light, dark and back to system", () => {
    expect(nextThemePreference("system")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
  });

  it("returns to the starting state after one full cycle", () => {
    let preference: ThemePreference = "system";
    for (let step = 0; step < themeCycle.length; step += 1) preference = nextThemePreference(preference);

    expect(preference).toBe("system");
  });

  it("treats a missing or unrecognized stored value as system", () => {
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("")).toBe("system");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("Dark")).toBe("system");
    expect(parseThemePreference("nonsense")).toBe("system");
  });

  it("keeps explicit overrides", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it("follows the system setting only when no override is chosen", () => {
    expect(resolveDarkMode("system", true)).toBe(true);
    expect(resolveDarkMode("system", false)).toBe(false);
    expect(resolveDarkMode("light", true)).toBe(false);
    expect(resolveDarkMode("dark", false)).toBe(true);
  });

  it("names the current state and the next one for screen readers", () => {
    expect(themeToggleLabel("system")).toBe("Color theme: system. Switch to light.");
    expect(themeToggleLabel("light")).toBe("Color theme: light. Switch to dark.");
    expect(themeToggleLabel("dark")).toBe("Color theme: dark. Switch to system.");
  });

  it("uses the storage key the pre-paint bootstrap script reads", () => {
    expect(THEME_STORAGE_KEY).toBe("notrak-theme");
  });
});
