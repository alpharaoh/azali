import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

function getTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  for (const listener of listeners) listener();
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme);
  return { theme, setTheme, toggleTheme };
}
