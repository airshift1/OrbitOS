import { useEffect } from "react";
import { useSystemStore, DEFAULT_ACCENT, type ThemeOverrides } from "../stores/useSystemStore";
import { ensureContrast, readableOn } from "./color";
import { useIsMobile } from "./useIsMobile";

const SURFACES: Record<string, string> = { orbit: "#191813", dark: "#181b1e", midnight: "#0a0a0a", light: "#f7f3e9" };

const OVERRIDE_VARS: Record<keyof ThemeOverrides, string> = {
  surface: "--color-surface",
  surface2: "--color-surface-2",
  radiusWin: "--radius-md",
  radiusSm: "--radius-sm",
};

/** Apply Theme Studio overrides as inline custom properties on <html>. */
export function applyThemeOverrides(o: ThemeOverrides) {
  const root = document.documentElement;
  (Object.keys(OVERRIDE_VARS) as (keyof ThemeOverrides)[]).forEach((key) => {
    const cssVar = OVERRIDE_VARS[key];
    const v = o[key];
    if (v === undefined || v === "") root.style.removeProperty(cssVar);
    else root.style.setProperty(cssVar, typeof v === "number" ? `${v}px` : v);
  });
}

/**
 * Keeps <html> in sync with the system settings: theme, accent, Theme Studio
 * overrides and the mobile flag. Mount once in <App>.
 */
export function useAppearance() {
  const theme = useSystemStore((s) => s.theme);
  const accent = useSystemStore((s) => s.accentColor);
  const overrides = useSystemStore((s) => s.themeOverrides);
  const customization = useSystemStore((s) => s.customization);
  const isMobile = useIsMobile();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#e9edf5" : "#060a10");
  }, [theme]);

  // The default accent is defined per theme in tokens.css (a lighter orange on dark, a darker one on
  // light, each checked for contrast). Only a user-picked accent is written inline, and then the
  // text colour on it and the accent-as-text colour are derived so they stay readable.
  useEffect(() => {
    const root = document.documentElement.style;
    const props = ["--color-accent", "--color-on-accent", "--color-accent-text"];
    if (accent.toLowerCase() === DEFAULT_ACCENT) {
      props.forEach((p) => root.removeProperty(p));
      return;
    }
    const surface = overrides.surface ?? SURFACES[theme];
    root.setProperty("--color-accent", accent);
    root.setProperty("--color-on-accent", readableOn(accent));
    root.setProperty("--color-accent-text", ensureContrast(accent, surface));
  }, [accent, theme, overrides.surface]);

  useEffect(() => {
    applyThemeOverrides(overrides);
  }, [overrides]);

  useEffect(() => {
    document.documentElement.dataset.mobile = isMobile ? "true" : "false";
  }, [isMobile]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.iconStyle = customization.iconStyle;
    root.dataset.density = customization.density;
    root.dataset.windowAnimations = String(customization.windowAnimations);
    root.style.setProperty("--window-radius", `${customization.windowRadius}px`);
    root.style.setProperty("--window-shadow", customization.windowShadow ? "var(--shadow-window)" : "none");
    root.style.setProperty("--window-border", customization.windowBorder ? "1px solid var(--color-border)" : "1px solid transparent");
    root.style.setProperty("--window-animation", customization.windowAnimations && !customization.reduceMotion ? "window-open var(--duration) var(--ease)" : "none");
    root.style.setProperty("--panel-opacity", `${100 - customization.transparency}%`);
    root.style.setProperty("--panel-blur", `${customization.blur}px`);
    root.style.setProperty("--desktop-scale", `${customization.desktopScale / 100}`);
  }, [customization]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      document.documentElement.dataset.reduceMotion = String(customization.reduceMotion || media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [customization.reduceMotion]);

  return { isMobile };
}
