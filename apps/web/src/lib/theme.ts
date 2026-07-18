import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return systemDark.matches ? "dark" : "light";
}

systemDark.addEventListener("change", () => {
  if (localStorage.getItem(STORAGE_KEY)) return;
  document.documentElement.classList.toggle("dark", systemDark.matches);
  for (const listener of listeners) listener();
});

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
