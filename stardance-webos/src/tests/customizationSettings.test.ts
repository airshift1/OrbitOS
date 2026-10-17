import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ACCENT,
  DEFAULT_CUSTOMIZATION,
  DEFAULT_THEME_OVERRIDES,
  migrateAppearanceDefaults,
  sanitizeCustomization,
  sanitizePersisted,
  useSystemStore,
} from "../stores/useSystemStore";
import { useFileSystemStore } from "../stores/useFileSystemStore";
import { DEFAULT_WALLPAPER } from "../lib/wallpapers";

describe("desktop customization preferences", () => {
  afterEach(() => {
    useSystemStore.getState().resetSettings();
  });

  it("fills safe defaults when migrating existing settings without customization fields", () => {
    const migrated = sanitizePersisted({
      theme: "light",
      wallpaper: "linear-gradient(90deg, #112233, #445566)",
      pinnedApps: ["notes", "settings"],
    });
    expect(migrated.theme).toBe("light");
    expect(migrated.pinnedApps).toEqual(["notes", "settings"]);
    expect(migrated.customization).toEqual(DEFAULT_CUSTOMIZATION);
  });

  it("uses the Ink appearance as the fresh-install and reset default", () => {
    useSystemStore.getState().resetSettings();
    expect(useSystemStore.getState()).toMatchObject({
      theme: "orbit",
      accentColor: DEFAULT_ACCENT,
      themeOverrides: DEFAULT_THEME_OVERRIDES,
      customization: { windowRadius: 24 },
    });
  });

  it("migrates only previous defaults while preserving chosen appearance settings", () => {
    const oldDefaults = migrateAppearanceDefaults({
      theme: "orbit",
      accentColor: "#e0653a",
      themeOverrides: {},
      customization: { ...DEFAULT_CUSTOMIZATION, windowRadius: 4 },
      wallpaper: "#123456",
    });
    expect(sanitizePersisted(oldDefaults)).toMatchObject({
      theme: "orbit",
      accentColor: DEFAULT_ACCENT,
      themeOverrides: DEFAULT_THEME_OVERRIDES,
      customization: { windowRadius: 24 },
      wallpaper: "#123456",
    });

    const chosen = migrateAppearanceDefaults({
      theme: "dark",
      accentColor: "#66a8a0",
      themeOverrides: { surface: "#132331", radiusWin: 14 },
      customization: { ...DEFAULT_CUSTOMIZATION, windowRadius: 14, dockPosition: "left" },
      wallpaper: "linear-gradient(90deg, #112233, #445566)",
    });
    expect(sanitizePersisted(chosen)).toMatchObject({
      theme: "dark",
      accentColor: "#66a8a0",
      themeOverrides: { surface: "#132331", radiusWin: 14, radiusSm: 2 },
      customization: { windowRadius: 14, dockPosition: "left" },
      wallpaper: "linear-gradient(90deg, #112233, #445566)",
    });
  });

  it("keeps existing Theme Studio corner overrides aligned with the Windows control", () => {
    expect(sanitizePersisted({ themeOverrides: { radiusWin: 11 } }).customization?.windowRadius).toBe(11);
  });

  it("clamps invalid values and retains valid saved preferences", () => {
    expect(sanitizeCustomization({
      dockPosition: "left",
      dockSize: 90,
      wallpaperFit: "cover",
      desktopScale: 60,
      transparency: 24,
      iconOverrides: { settings: "Palette", "bad id": "Zap", terminal: "bad icon;" },
      wallpaperImageId: "../path",
    })).toMatchObject({
      dockPosition: "left",
      dockSize: 64,
      wallpaperFit: "cover",
      desktopScale: 80,
      transparency: 24,
      iconOverrides: { settings: "Palette" },
      wallpaperImageId: "",
    });
  });

  it("resets appearance preferences without touching file content", () => {
    const fileNodes = useFileSystemStore.getState().nodes;
    useSystemStore.setState({
      customization: { ...DEFAULT_CUSTOMIZATION, dockPosition: "right", reduceMotion: true },
      wallpaper: "#123456",
    });
    useSystemStore.getState().resetSettings();
    expect(useSystemStore.getState().customization).toEqual(DEFAULT_CUSTOMIZATION);
    expect(useSystemStore.getState().themeOverrides).toEqual(DEFAULT_THEME_OVERRIDES);
    expect(useSystemStore.getState().accentColor).toBe(DEFAULT_ACCENT);
    expect(useSystemStore.getState().wallpaper).toBe(DEFAULT_WALLPAPER);
    expect(useFileSystemStore.getState().nodes).toBe(fileNodes);
  });
});
