export type Theme = "light" | "dark" | "system";

const KEY = "tempo-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  let v: Theme | null = null;
  try { v = localStorage.getItem(KEY) as Theme | null; } catch { return "system"; }
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* Private browsing may disable storage. */ }
  applyTheme(theme);
}

export function initTheme() {
  applyTheme(getStoredTheme());
  // Listen to system changes when in system mode
  if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener?.("change", handler);
    return ()=>mq.removeEventListener?.("change",handler);
  }
}
