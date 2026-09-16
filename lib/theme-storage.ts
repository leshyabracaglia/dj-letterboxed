import * as SecureStore from "expo-secure-store";
import { Appearance, Platform } from "react-native";

// Persists the user's chosen theme preference across restarts — nativewind's
// own setColorScheme() only holds it in memory. Mirrors the SecureStore/web
// split already used in lib/clerk-token-cache.ts.
const KEY = "theme-preference";

export type ThemePreference = "light" | "dark" | "system";

// nativewind's setColorScheme("system") on web only clears its manual
// override — it does NOT sync the "dark" class to the OS preference the way
// setColorScheme("dark"/"light") does. That leaves the Tailwind dark: class
// off while nativewind's own colorScheme value still reports the real OS
// preference, so anything branching in JS off colorScheme (vs. dark:
// classes) can disagree with the rest of the page. Always resolve "system"
// to a concrete light/dark ourselves before calling setColorScheme.
export function resolveColorScheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  }
  return pref;
}

export async function getStoredThemePreference(): Promise<ThemePreference | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(KEY) as ThemePreference | null;
    } catch {
      return null;
    }
  }
  try {
    return (await SecureStore.getItemAsync(KEY)) as ThemePreference | null;
  } catch {
    return null;
  }
}

export async function setStoredThemePreference(value: ThemePreference): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // ignore
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(KEY, value);
  } catch {
    // ignore
  }
}
