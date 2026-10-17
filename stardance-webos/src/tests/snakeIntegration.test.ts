import { describe, expect, it } from "vitest";
import { appList, appRegistry } from "../apps/registry";
import { sanitizePersisted } from "../stores/useSystemStore";
import { useFileSystemStore } from "../stores/useFileSystemStore";
import { useWindowStore } from "../stores/useWindowStore";
import { launchApp } from "../lib/launch";

const ORIGINAL_GAMES = [
  "dino-run",
  "orbit-blast",
  "orbit-depths",
  "mortal-kombat-mobile",
  "2048",
  "sandtrix",
] as const;

describe("OrbitOS game integration", () => {
  it("is registered as an installable, single-instance application", () => {
    expect(appRegistry.snake).toMatchObject({
      id: "snake",
      name: "Snake",
      singleInstance: true,
    });
  });

  it("seeds the System Apps folder with a Snake shortcut", () => {
    const filesystem = useFileSystemStore.getState();
    const systemApps = filesystem.getChildren(filesystem.rootId).find((node) => node.name === "System Apps");
    expect(systemApps).toBeDefined();
    expect(filesystem.getChildren(systemApps!.id).some((node) => node.name === "Snake.app" && node.content === "snake")).toBe(true);
  });

  it("accepts only supported persisted visual modes", () => {
    expect(sanitizePersisted({ snakeVisualMode: "unicorn" }).snakeVisualMode).toBe("unicorn");
    expect(sanitizePersisted({ snakeVisualMode: "unknown" }).snakeVisualMode).toBeUndefined();
  });

  it("lists every original game in the app launcher with its historical ID", () => {
    for (const id of ORIGINAL_GAMES) {
      expect(appRegistry[id].id).toBe(id);
      expect(appList.some((app) => app.id === id)).toBe(true);
    }
    expect(appRegistry["dino-run"].name).toBe("Dino Run");
    expect(appRegistry["orbit-blast"].name).toBe("Orbit Blast");
    expect(appRegistry["orbit-depths"].name).toBe("Orbit Depths");
    expect(appRegistry["mortal-kombat-mobile"].name).toBe("Mortal Kombat Mobile");
    expect(appRegistry["2048"].name).toBe("2048");
    expect(appRegistry.sandtrix.name).toBe("Sandtrix");
  });

  it("opens each original game through the normal OrbitOS launch path", () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { innerWidth: 1280, innerHeight: 800 },
    });
    useWindowStore.setState({ windows: [], focusedId: null, topZIndex: 100, activeWorkspace: 0 });

    try {
      for (const id of ORIGINAL_GAMES) launchApp(id);
      expect(useWindowStore.getState().windows.map((window) => window.appId)).toEqual(ORIGINAL_GAMES);
    } finally {
      useWindowStore.setState({ windows: [], focusedId: null, topZIndex: 100, activeWorkspace: 0 });
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("seeds all original game shortcuts and keeps the numeric 2048 app pinnable", () => {
    const filesystem = useFileSystemStore.getState();
    const systemApps = filesystem.getChildren(filesystem.rootId).find((node) => node.name === "System Apps");
    expect(systemApps).toBeDefined();
    const shortcuts = filesystem.getChildren(systemApps!.id);
    for (const id of ORIGINAL_GAMES) {
      expect(shortcuts.some((node) => node.type === "file" && node.content === id)).toBe(true);
    }
    expect(sanitizePersisted({ pinnedApps: ["2048"], recentApps: ["2048"] })).toMatchObject({
      pinnedApps: ["2048"],
      recentApps: ["2048"],
    });
  });
});
