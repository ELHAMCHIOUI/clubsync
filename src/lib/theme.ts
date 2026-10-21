import { useEffect, useSyncExternalStore } from "react";

export interface GymTheme { color: string; logo: string | null }
export const DEFAULT_THEME: GymTheme = { color: "#047857", logo: null };
export const THEME_PRESETS = ["#047857", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#0f172a"];

const KEY = "nabd.theme.v1";
const listeners = new Set<() => void>();
let cache: Record<string, GymTheme> | null = null;

function all(): Record<string, GymTheme> {
  if (cache) return cache;
  if (typeof window === "undefined") return {};
  try { cache = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { cache = {}; }
  return cache!;
}

export const isHexColor = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

export function getTheme(orgId: string | undefined): GymTheme {
  return (orgId && all()[orgId]) || DEFAULT_THEME;
}

export function saveTheme(orgId: string, theme: GymTheme) {
  if (!isHexColor(theme.color)) throw new Error("Couleur invalide (format #RRGGBB).");
  cache = { ...all(), [orgId]: theme };
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export function useTheme(orgId: string | undefined): GymTheme {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => getTheme(orgId),
    () => DEFAULT_THEME,
  );
}

/** Applies the gym brand color to the CSS tokens. */
export function useApplyTheme(orgId: string | undefined) {
  const { color } = useTheme(orgId);
  useEffect(() => {
    const r = document.documentElement.style;
    const vars: Record<string, string> = {
      "--primary": color,
      "--primary-glow": `color-mix(in oklch, ${color} 80%, white)`,
      "--ring": color,
      "--sidebar-primary": color,
      "--sidebar-ring": color,
      "--accent-foreground": `color-mix(in oklch, ${color} 85%, black)`,
      "--sidebar-accent-foreground": `color-mix(in oklch, ${color} 85%, black)`,
      "--primary-soft": `color-mix(in oklch, ${color} 12%, white)`,
      "--accent": `color-mix(in oklch, ${color} 12%, white)`,
      "--sidebar-accent": `color-mix(in oklch, ${color} 12%, white)`,
    };
    Object.entries(vars).forEach(([k, v]) => r.setProperty(k, v));
    return () => Object.keys(vars).forEach((k) => r.removeProperty(k));
  }, [color]);
}
