/**
 * Wallpaper presets. A wallpaper is a CSS `background` value (validated by
 * lib/security.ts), so flat colours, subtle rules and gradients all work and
 * custom values can be typed into Settings.
 */
export interface WallpaperPreset {
  id: string;
  name: string;
  css: string;
}

const RULE = (a: string, b: string) => `repeating-linear-gradient(0deg, ${a} 0 31px, ${b} 31px 32px)`;
const GRID = (bg: string, line: string) =>
  `linear-gradient(${line} 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(90deg, ${line} 1px, transparent 1px) 0 0 / 40px 40px, ${bg}`;

export const WALLPAPERS: WallpaperPreset[] = [
  { id: "ink", name: "Ink", css: "#12110e" },
  { id: "graphite", name: "Graphite", css: "#16181b" },
  { id: "slate", name: "Slate", css: "#1f2529" },
  { id: "moss", name: "Moss", css: "#1b1f18" },
  { id: "rust", name: "Rust", css: "#2a1a13" },
  { id: "ruled", name: "Ruled", css: RULE("#12110e", "#1a1915") },
  { id: "grid", name: "Grid", css: GRID("#12110e", "rgba(234, 230, 220, 0.05)") },
  { id: "bone", name: "Bone", css: "#e9e4d8" },
  { id: "paper", name: "Paper", css: "#d9d3c3" },
  { id: "ruled-paper", name: "Ruled paper", css: RULE("#e9e4d8", "#dcd6c7") },
];

export const DEFAULT_WALLPAPER = WALLPAPERS[0].css;

/** Defaults shipped before the redesign — persisted copies are migrated to the new default. */
export const LEGACY_DEFAULT_WALLPAPER_MARKER = "radial-gradient";
