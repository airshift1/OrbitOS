import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppId, DesktopCustomization, SystemSettings, ThemeName, WindowStyle } from "../types";
import { DEFAULT_WALLPAPER, LEGACY_DEFAULT_WALLPAPER_MARKER } from "../lib/wallpapers";
import { isHexColor, sanitizeWallpaper } from "../lib/security";
import { scopedStorageKey } from "../platform/storageScope";

export interface IconPos {
  x: number;
  y: number;
}

/** Theme Studio overrides layered on top of the active theme (all optional). */
export interface ThemeOverrides {
  surface?: string;
  surface2?: string;
  radiusWin?: number;
  radiusSm?: number;
}

export const DEFAULT_THEME_OVERRIDES: Pick<ThemeOverrides, "radiusWin" | "radiusSm"> = {
  radiusWin: 24,
  radiusSm: 2,
};

export type SnakeVisualMode = "classic" | "unicorn";

const MAX_RECENTS = 6;
export const REQUIRED_APP_IDS: readonly AppId[] = ["settings", "file-explorer", "orbit-store", "launcher"];

interface SystemStoreState extends SystemSettings {
  booted: boolean;
  locked: boolean;
  pinnedApps: AppId[];
  /** Most-recently launched apps, newest first. */
  recentApps: AppId[];
  /** Apps removed from the user's OrbitOS library; code remains bundled. */
  uninstalledApps: AppId[];
  /** Saved desktop icon positions, keyed by icon key ("app-<id>" or fs node id). */
  desktopIconPos: Record<string, IconPos>;
  themeOverrides: ThemeOverrides;
  customization: DesktopCustomization;
  snakeVisualMode: SnakeVisualMode;
  welcomed: boolean;

  setDesktopIconPos: (key: string, pos: IconPos) => void;
  setTheme: (t: ThemeName) => void;
  setWallpaper: (w: string) => void;
  setUsername: (n: string) => void;
  setAccentColor: (c: string) => void;
  setWindowStyle: (s: WindowStyle) => void;
  setVolume: (v: number) => void;
  setBrightness: (v: number) => void;
  setNightMode: (v: boolean) => void;
  setDoNotDisturb: (v: boolean) => void;
  setStartupSound: (v: boolean) => void;
  setRestoreSession: (v: boolean) => void;
  setWifi: (v: boolean) => void;
  toggleSound: () => void;
  setBooted: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  setWelcomed: (v: boolean) => void;
  setThemeOverrides: (o: ThemeOverrides) => void;
  setCustomization: (customization: Partial<DesktopCustomization>) => void;
  setSnakeVisualMode: (mode: SnakeVisualMode) => void;
  pinApp: (id: AppId) => void;
  unpinApp: (id: AppId) => void;
  pushRecent: (id: AppId) => void;
  setAppInstalled: (id: AppId, installed: boolean) => void;
  resetSettings: () => void;
}

export const DEFAULT_ACCENT = "#091c1a";
const PREVIOUS_DEFAULT_ACCENT = "#e0653a";
const LEGACY_ACCENT = "#00c8f0";

const defaults: SystemSettings = {
  theme: "orbit",
  wallpaper: DEFAULT_WALLPAPER,
  username: "User",
  accentColor: DEFAULT_ACCENT,
  soundEnabled: true,
  windowStyle: "classic",
  volume: 65,
  brightness: 100,
  nightMode: false,
  doNotDisturb: false,
  startupSound: false,
  restoreSession: false,
  wifi: true,
};

export const DEFAULT_CUSTOMIZATION: DesktopCustomization = {
  wallpaperFit: "cover",
  wallpaperImageId: "",
  desktopIconSize: 44,
  desktopIconSpacing: 100,
  desktopIconLabels: true,
  desktopShortcutsVisible: true,
  dockPosition: "bottom",
  dockSize: 48,
  dockSpacing: 2,
  showClock: true,
  showClockDate: true,
  use24HourClock: false,
  windowRadius: 24,
  windowBorder: true,
  windowShadow: true,
  windowAnimations: true,
  transparency: 0,
  blur: 0,
  desktopScale: 100,
  density: "comfortable",
  iconStyle: "default",
  iconOverrides: {},
  reduceMotion: false,
};

const DEFAULT_PINNED: AppId[] = ["notes", "file-explorer", "settings"];

const THEMES: ThemeName[] = ["orbit", "dark", "light", "midnight"];
const STYLES: WindowStyle[] = ["orbit", "classic", "traffic", "linux", "yk2000", "aero"];
const APP_ID = /^(?:[a-z][a-z-]{0,30}|2048)$/;

const clampNum = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

function cleanUsername(n: unknown): string {
  // eslint-disable-next-line no-control-regex
  const s = typeof n === "string" ? n.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 32) : "";
  return s;
}

function cleanOverrides(o: unknown): ThemeOverrides {
  const r = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
  const out: ThemeOverrides = {};
  if (isHexColor(r.surface)) out.surface = r.surface;
  if (isHexColor(r.surface2)) out.surface2 = r.surface2;
  if (typeof r.radiusWin === "number") out.radiusWin = clampNum(r.radiusWin, 0, 24, 4);
  if (typeof r.radiusSm === "number") out.radiusSm = clampNum(r.radiusSm, 0, 14, 2);
  return out;
}

const CUSTOMIZATION_ENUMS = {
  wallpaperFit: ["cover", "contain", "fill", "center"],
  dockPosition: ["bottom", "left", "right"],
  density: ["comfortable", "compact"],
  iconStyle: ["default", "monochrome", "soft"],
} as const;

export function sanitizeCustomization(value: unknown): DesktopCustomization {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const enums = (key: keyof typeof CUSTOMIZATION_ENUMS, fallback: string) =>
    CUSTOMIZATION_ENUMS[key].includes(raw[key] as never) ? raw[key] as string : fallback;
  const iconOverrides: Record<string, string> = {};
  if (raw.iconOverrides && typeof raw.iconOverrides === "object") {
    for (const [id, icon] of Object.entries(raw.iconOverrides as Record<string, unknown>).slice(0, 100)) {
      if (/^[a-z][a-z0-9-]{0,40}$/.test(id) && typeof icon === "string" && /^[A-Z][A-Za-z0-9]{0,40}$/.test(icon)) iconOverrides[id] = icon;
    }
  }
  return {
    wallpaperFit: enums("wallpaperFit", DEFAULT_CUSTOMIZATION.wallpaperFit) as DesktopCustomization["wallpaperFit"],
    wallpaperImageId: typeof raw.wallpaperImageId === "string" && /^[a-z0-9-]{0,80}$/i.test(raw.wallpaperImageId) ? raw.wallpaperImageId : "",
    desktopIconSize: clampNum(raw.desktopIconSize, 28, 72, DEFAULT_CUSTOMIZATION.desktopIconSize),
    desktopIconSpacing: clampNum(raw.desktopIconSpacing, 72, 150, DEFAULT_CUSTOMIZATION.desktopIconSpacing),
    desktopIconLabels: bool(raw.desktopIconLabels, DEFAULT_CUSTOMIZATION.desktopIconLabels),
    desktopShortcutsVisible: bool(raw.desktopShortcutsVisible, DEFAULT_CUSTOMIZATION.desktopShortcutsVisible),
    dockPosition: enums("dockPosition", DEFAULT_CUSTOMIZATION.dockPosition) as DesktopCustomization["dockPosition"],
    dockSize: clampNum(raw.dockSize, 36, 64, DEFAULT_CUSTOMIZATION.dockSize),
    dockSpacing: clampNum(raw.dockSpacing, 0, 14, DEFAULT_CUSTOMIZATION.dockSpacing),
    showClock: bool(raw.showClock, DEFAULT_CUSTOMIZATION.showClock),
    showClockDate: bool(raw.showClockDate, DEFAULT_CUSTOMIZATION.showClockDate),
    use24HourClock: bool(raw.use24HourClock, DEFAULT_CUSTOMIZATION.use24HourClock),
    windowRadius: clampNum(raw.windowRadius, 0, 24, DEFAULT_CUSTOMIZATION.windowRadius),
    windowBorder: bool(raw.windowBorder, DEFAULT_CUSTOMIZATION.windowBorder),
    windowShadow: bool(raw.windowShadow, DEFAULT_CUSTOMIZATION.windowShadow),
    windowAnimations: bool(raw.windowAnimations, DEFAULT_CUSTOMIZATION.windowAnimations),
    transparency: clampNum(raw.transparency, 0, 40, DEFAULT_CUSTOMIZATION.transparency),
    blur: clampNum(raw.blur, 0, 24, DEFAULT_CUSTOMIZATION.blur),
    desktopScale: clampNum(raw.desktopScale, 80, 125, DEFAULT_CUSTOMIZATION.desktopScale),
    density: enums("density", DEFAULT_CUSTOMIZATION.density) as DesktopCustomization["density"],
    iconStyle: enums("iconStyle", DEFAULT_CUSTOMIZATION.iconStyle) as DesktopCustomization["iconStyle"],
    iconOverrides,
    reduceMotion: bool(raw.reduceMotion, DEFAULT_CUSTOMIZATION.reduceMotion),
  };
}

function cleanIconPositions(v: unknown): Record<string, IconPos> {
  const out: Record<string, IconPos> = {};
  if (!v || typeof v !== "object") return out;
  for (const [key, pos] of Object.entries(v as Record<string, unknown>).slice(0, 500)) {
    const p = pos as Partial<IconPos> | null;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[key.slice(0, 80)] = { x: p.x as number, y: p.y as number };
  }
  return out;
}

const idList = (v: unknown, fallback: AppId[], max: number): AppId[] =>
  Array.isArray(v)
    ? ([...new Set(v.filter((x): x is string => typeof x === "string" && APP_ID.test(x)))].slice(0, max) as AppId[])
    : fallback;

/** Validate a persisted settings blob. Unknown / invalid fields are dropped so defaults apply. */
export function sanitizePersisted(raw: unknown): Partial<SystemStoreState> {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const out: Partial<SystemStoreState> = {};

  if (THEMES.includes(p.theme as ThemeName)) out.theme = p.theme as ThemeName;
  if (p.snakeVisualMode === "classic" || p.snakeVisualMode === "unicorn") {
    out.snakeVisualMode = p.snakeVisualMode;
  }
  if (STYLES.includes(p.windowStyle as WindowStyle)) {
    out.windowStyle = p.windowStyle as WindowStyle;
  }
  const wall = sanitizeWallpaper(p.wallpaper, "");
  // the pre-redesign default was a radial-gradient "nebula" — move those users to the new default
  if (wall && !wall.includes(LEGACY_DEFAULT_WALLPAPER_MARKER)) out.wallpaper = wall;
  const accent = isHexColor(p.accentColor) ? p.accentColor.toLowerCase() : "";
  if (accent && accent !== LEGACY_ACCENT) out.accentColor = accent;
  const name = cleanUsername(p.username);
  if (name.trim() && name !== "Astronaut") out.username = name;

  out.soundEnabled = bool(p.soundEnabled, defaults.soundEnabled);
  out.nightMode = bool(p.nightMode, defaults.nightMode);
  out.doNotDisturb = bool(p.doNotDisturb, defaults.doNotDisturb);
  out.startupSound = bool(p.startupSound, defaults.startupSound);
  out.restoreSession = bool(p.restoreSession, defaults.restoreSession);
  out.wifi = bool(p.wifi, defaults.wifi);
  out.locked = bool(p.locked, false);
  out.welcomed = bool(p.welcomed, false);
  out.volume = clampNum(p.volume, 0, 100, defaults.volume);
  out.brightness = clampNum(p.brightness, 20, 100, defaults.brightness);
  out.uninstalledApps = idList(p.uninstalledApps, [], 25).filter((id) => !REQUIRED_APP_IDS.includes(id));
  out.pinnedApps = idList(p.pinnedApps, DEFAULT_PINNED, 24).filter((id) => !out.uninstalledApps?.includes(id));
  out.recentApps = idList(p.recentApps, [], MAX_RECENTS).filter((id) => !out.uninstalledApps?.includes(id));
  out.desktopIconPos = cleanIconPositions(p.desktopIconPos);
  const overrides = cleanOverrides(p.themeOverrides);
  const customization = sanitizeCustomization(p.customization);
  if (overrides.radiusWin !== undefined) customization.windowRadius = overrides.radiusWin;
  out.themeOverrides = overrides;
  out.customization = customization;
  return out;
}

export function migrateAppearanceDefaults(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const persisted = raw as Record<string, unknown>;
  const migrated = { ...persisted };
  if (persisted.accentColor === PREVIOUS_DEFAULT_ACCENT) {
    migrated.accentColor = DEFAULT_ACCENT;
  }

  const overrides = cleanOverrides(persisted.themeOverrides);
  if (overrides.radiusWin === 4) overrides.radiusWin = DEFAULT_THEME_OVERRIDES.radiusWin;
  migrated.themeOverrides = { ...DEFAULT_THEME_OVERRIDES, ...overrides };

  const customization = persisted.customization && typeof persisted.customization === "object"
    ? persisted.customization as Record<string, unknown>
    : {};
  if (customization.windowRadius === undefined || customization.windowRadius === 4) {
    migrated.customization = { ...customization, windowRadius: DEFAULT_CUSTOMIZATION.windowRadius };
  }
  return migrated;
}

export const useSystemStore = create<SystemStoreState>()(
  persist(
    (set) => ({
      ...defaults,
      booted: false,
      locked: false,
      welcomed: false,
      pinnedApps: DEFAULT_PINNED,
      recentApps: [],
      uninstalledApps: [],
      desktopIconPos: {},
      themeOverrides: { ...DEFAULT_THEME_OVERRIDES },
      customization: DEFAULT_CUSTOMIZATION,
      snakeVisualMode: "classic" as const,

      setDesktopIconPos: (key, pos) =>
        set((s) => ({ desktopIconPos: { ...s.desktopIconPos, [key]: pos } })),

      setTheme: (t) => set({ theme: t }),
      setWallpaper: (w) => set((s) => ({ wallpaper: sanitizeWallpaper(w, s.wallpaper) })),
      setUsername: (n) => set({ username: cleanUsername(n) }),
      setAccentColor: (c) => set((s) => ({ accentColor: isHexColor(c) ? c.toLowerCase() : s.accentColor })),
      setWindowStyle: (s) => set({ windowStyle: s }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(100, Math.round(v))) }),
      setBrightness: (v) => set({ brightness: Math.max(20, Math.min(100, Math.round(v))) }),
      setNightMode: (v) => set({ nightMode: v }),
      setDoNotDisturb: (v) => set({ doNotDisturb: v }),
      setStartupSound: (v) => set({ startupSound: v }),
      setRestoreSession: (v) => set({ restoreSession: v }),
      setWifi: (v) => set({ wifi: v }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setBooted: (v) => set({ booted: v }),
      setLocked: (v) => set({ locked: v }),
      setWelcomed: (v) => set({ welcomed: v }),
      setThemeOverrides: (o) => set({ themeOverrides: cleanOverrides(o) }),
      setCustomization: (customization) => set((s) => ({
        customization: sanitizeCustomization({ ...s.customization, ...customization }),
      })),
      setSnakeVisualMode: (mode) => set({ snakeVisualMode: mode }),

      pinApp: (id) =>
        set((s) => ({ pinnedApps: s.pinnedApps.includes(id) ? s.pinnedApps : [...s.pinnedApps, id] })),
      unpinApp: (id) => set((s) => ({ pinnedApps: s.pinnedApps.filter((a) => a !== id) })),
      pushRecent: (id) =>
        set((s) => ({
          recentApps: [id, ...s.recentApps.filter((a) => a !== id)].slice(0, MAX_RECENTS),
        })),
      setAppInstalled: (id, installed) =>
        set((s) => {
          if (installed) {
            return { uninstalledApps: s.uninstalledApps.filter((appId) => appId !== id) };
          }
          if (REQUIRED_APP_IDS.includes(id) || s.uninstalledApps.includes(id)) return s;
          return {
            uninstalledApps: [...s.uninstalledApps, id],
            pinnedApps: s.pinnedApps.filter((appId) => appId !== id),
            recentApps: s.recentApps.filter((appId) => appId !== id),
          };
        }),

      resetSettings: () =>
        set({
          ...defaults,
          pinnedApps: DEFAULT_PINNED,
          recentApps: [],
          desktopIconPos: {},
          themeOverrides: { ...DEFAULT_THEME_OVERRIDES },
          customization: DEFAULT_CUSTOMIZATION,
          snakeVisualMode: "classic",
        }),
    }),
    {
      name: scopedStorageKey("system"),
      version: 6,
      partialize: (state) => ({
        theme: state.theme,
        wallpaper: state.wallpaper,
        username: state.username,
        accentColor: state.accentColor,
        soundEnabled: state.soundEnabled,
        windowStyle: state.windowStyle,
        volume: state.volume,
        brightness: state.brightness,
        nightMode: state.nightMode,
        doNotDisturb: state.doNotDisturb,
        startupSound: state.startupSound,
        restoreSession: state.restoreSession,
        wifi: state.wifi,
        locked: state.locked,
        welcomed: state.welcomed,
        pinnedApps: state.pinnedApps,
        recentApps: state.recentApps,
        uninstalledApps: state.uninstalledApps,
        desktopIconPos: state.desktopIconPos,
        themeOverrides: state.themeOverrides,
        customization: state.customization,
        snakeVisualMode: state.snakeVisualMode,
      }),
      // localStorage is untrusted input (edited by hand, an extension, or a stale
      // build), so everything read back is validated field by field.
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
      migrate: (persisted, version) => ({
        ...defaults,
        locked: false,
        welcomed: false,
        pinnedApps: DEFAULT_PINNED,
        recentApps: [],
        uninstalledApps: [],
        desktopIconPos: {},
        themeOverrides: { ...DEFAULT_THEME_OVERRIDES },
        snakeVisualMode: "classic" as const,
        customization: DEFAULT_CUSTOMIZATION,
        ...sanitizePersisted(version < 5 ? migrateAppearanceDefaults(persisted) : persisted),
      }),
    },
  ),
);
