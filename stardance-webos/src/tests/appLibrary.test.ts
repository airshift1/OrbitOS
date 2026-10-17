import { afterEach, describe, expect, it, vi } from "vitest";
import { launchApp } from "../lib/launch";
import { REQUIRED_APP_IDS, sanitizePersisted, useSystemStore } from "../stores/useSystemStore";
import { useWindowStore } from "../stores/useWindowStore";

describe("bundled app library", () => {
  afterEach(() => {
    useSystemStore.getState().resetSettings();
    useWindowStore.setState({ windows: [], focusedId: null, topZIndex: 100, activeWorkspace: 0, snapPreview: null });
    vi.unstubAllGlobals();
  });

  it("removes optional apps from launch surfaces and allows them to be re-added", () => {
    useSystemStore.getState().pinApp("snake");
    useSystemStore.getState().pushRecent("snake");
    useSystemStore.getState().setAppInstalled("snake", false);

    expect(useSystemStore.getState().uninstalledApps).toContain("snake");
    expect(useSystemStore.getState().pinnedApps).not.toContain("snake");
    expect(useSystemStore.getState().recentApps).not.toContain("snake");
    const windowsBeforeLaunch = useWindowStore.getState().windows.length;
    launchApp("snake");
    expect(useWindowStore.getState().windows).toHaveLength(windowsBeforeLaunch);

    useSystemStore.getState().setAppInstalled("snake", true);
    vi.stubGlobal("window", { innerWidth: 1280, innerHeight: 800 });
    launchApp("snake");
    expect(useWindowStore.getState().windows.some((window) => window.appId === "snake")).toBe(true);
  });

  it("keeps required system apps installed and sanitizes persisted library state", () => {
    for (const appId of REQUIRED_APP_IDS) useSystemStore.getState().setAppInstalled(appId, false);
    expect(useSystemStore.getState().uninstalledApps).toEqual([]);

    expect(sanitizePersisted({
      uninstalledApps: ["snake", "settings", "../outside", "unknown id"],
      pinnedApps: ["snake", "settings"],
      recentApps: ["snake", "settings"],
    })).toMatchObject({
      uninstalledApps: ["snake"],
      pinnedApps: ["settings"],
      recentApps: ["settings"],
    });
  });
});
