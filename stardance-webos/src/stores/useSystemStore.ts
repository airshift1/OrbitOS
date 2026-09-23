import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppId, SystemSettings, ThemeName, WindowStyle } from "../types";
import { DEFAULT_WALLPAPER, LEGACY_DEFAULT_WALLPAPER_MARKER } from "../lib/wallpapers";
import { isHexColor, sanitizeWallpaper } from "../lib/security";

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

const MAX_RECENTS = 6;

interface SystemStoreState extends SystemSettings {
  booted: boolean;
  locked: boolean;
  pinnedApps: AppId[];
  /** Most-recently launched apps, newest first. */
  recentApps: AppId[];
  /** Saved desktop icon positions, keyed by icon key ("app-<id>" or fs node id). */
  desktopIconPos: Record<string, IconPos>;
  themeOverrides: ThemeOverrides;
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
  setBluetooth: (v: boolean) => void;
  toggleSound: () => void;
  setBooted: (v: boolean) => void;
  setLocked: (v: boolean) => void;
  setWelcomed: (v: boolean) => void;
  setThemeOverrides: (o: ThemeOverrides) => void;
  pinApp: (id: AppId) => void;
  unpinApp: (id: AppId) => void;
  pushRecent: (id: AppId) => void;
  resetSettings: () => void;
}

export const DEFAULT_ACCENT = "#e0653a";
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
  bluetooth: false,
};

const DEFAULT_PINNED: AppId[] = ["notes", "file-explorer", "settings"];

const THEMES: ThemeName[] = ["orbit", "dark", "light", "midnight"];
const STYLES: WindowStyle[] = ["orbit", "classic", "traffic", "linux", "yk2000", "aero"];
const APP_ID = /^[a-z][a-z-]{0,30}$/;

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
  out.bluetooth = bool(p.bluetooth, defaults.bluetooth);
  out.locked = bool(p.locked, false);
  out.welcomed = bool(p.welcomed, false);
  out.volume = clampNum(p.volume, 0, 100, defaults.volume);
  out.brightness = clampNum(p.brightness, 20, 100, defaults.brightness);
  out.pinnedApps = idList(p.pinnedApps, DEFAULT_PINNED, 24);
  out.recentApps = idList(p.recentApps, [], MAX_RECENTS);
  out.desktopIconPos = cleanIconPositions(p.desktopIconPos);
  out.themeOverrides = cleanOverrides(p.themeOverrides);
  return out;
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
      desktopIconPos: {},
      themeOverrides: {},

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
      setBluetooth: (v) => set({ bluetooth: v }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setBooted: (v) => set({ booted: v }),
      setLocked: (v) => set({ locked: v }),
      setWelcomed: (v) => set({ welcomed: v }),
      setThemeOverrides: (o) => set({ themeOverrides: cleanOverrides(o) }),

      pinApp: (id) =>
        set((s) => ({ pinnedApps: s.pinnedApps.includes(id) ? s.pinnedApps : [...s.pinnedApps, id] })),
      unpinApp: (id) => set((s) => ({ pinnedApps: s.pinnedApps.filter((a) => a !== id) })),
      pushRecent: (id) =>
        set((s) => ({
          recentApps: [id, ...s.recentApps.filter((a) => a !== id)].slice(0, MAX_RECENTS),
        })),

      resetSettings: () =>
        set({
          ...defaults,
          pinnedApps: DEFAULT_PINNED,
          recentApps: [],
          desktopIconPos: {},
          themeOverrides: {},
        }),
    }),
    {
      name: "webos-system",
      version: 3,
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
        bluetooth: state.bluetooth,
        locked: state.locked,
        welcomed: state.welcomed,
        pinnedApps: state.pinnedApps,
        recentApps: state.recentApps,
        desktopIconPos: state.desktopIconPos,
        themeOverrides: state.themeOverrides,
      }),
      // localStorage is untrusted input (edited by hand, an extension, or a stale
      // build), so everything read back is validated field by field.
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
    },
  ),
);
