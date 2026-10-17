import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CUSTOMIZATION, sanitizeCustomization, sanitizePersisted, useSystemStore } from "../stores/useSystemStore";
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
    expect(useSystemStore.getState().wallpaper).toBe(DEFAULT_WALLPAPER);
    expect(useFileSystemStore.getState().nodes).toBe(fileNodes);
  });
});
