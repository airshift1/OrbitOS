import { afterEach, describe, expect, it, vi } from "vitest";
import { fitRectToWorkArea, getWorkArea } from "../lib/geometry";
import { zoneToRect } from "../lib/snap";
import { useWindowStore } from "../stores/useWindowStore";
import { DEFAULT_CUSTOMIZATION, useSystemStore } from "../stores/useSystemStore";

describe("OrbitOS window work area", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useWindowStore.setState({ windows: [], focusedId: null, topZIndex: 100, activeWorkspace: 0 });
    useSystemStore.setState({ customization: DEFAULT_CUSTOMIZATION });
  });

  it("keeps restored and snapped rectangles inside a small work area", () => {
    vi.stubGlobal("window", { innerWidth: 680, innerHeight: 480 });
    expect(getWorkArea()).toEqual({ x: 0, y: 0, width: 680, height: 432 });
    expect(fitRectToWorkArea({ x: 400, y: 300, width: 900, height: 700 }, 240, 160)).toEqual({
      x: 0, y: 0, width: 680, height: 432,
    });
    expect(zoneToRect("topLeft", 560, 400)).toEqual({ x: 0, y: 0, width: 340, height: 216 });
  });

  it("reserves the selected side dock and maximizes inside the remaining work area", () => {
    vi.stubGlobal("window", { innerWidth: 680, innerHeight: 480 });
    useSystemStore.setState({ customization: { ...DEFAULT_CUSTOMIZATION, dockPosition: "left", dockSize: 48 } });
    expect(getWorkArea()).toEqual({ x: 64, y: 0, width: 616, height: 480 });
    expect(zoneToRect("maximize", 240, 160)).toEqual({ x: 64, y: 0, width: 616, height: 480 });
    expect(fitRectToWorkArea({ x: 0, y: 0, width: 700, height: 500 }, 240, 160)).toEqual({
      x: 64, y: 0, width: 616, height: 480,
    });
  });

  it("opens large app windows within the viewport and refits both dimensions after resizing", () => {
    vi.stubGlobal("window", { innerWidth: 980, innerHeight: 620 });
    vi.stubGlobal("crypto", { randomUUID: () => "window-test" });
    const id = useWindowStore.getState().openWindow({
      appId: "snake", title: "Snake", icon: "Gamepad2", width: 1120, height: 820,
    });
    expect(useWindowStore.getState().windows[0]).toMatchObject({ x: 12, y: 12, width: 956, height: 548 });

    const viewport = window as unknown as { innerWidth: number; innerHeight: number };
    viewport.innerWidth = 500;
    viewport.innerHeight = 340;
    useWindowStore.getState().refitWindows();
    expect(useWindowStore.getState().windows[0]).toMatchObject({ x: 12, y: 12, width: 488, height: 280 });

    useWindowStore.getState().toggleMaximize(id);
    expect(useWindowStore.getState().windows[0]).toMatchObject({ isMaximized: true, width: 500, height: 292 });
    useWindowStore.getState().toggleMaximize(id);
    const restored = useWindowStore.getState().windows[0];
    expect(restored.x).toBeGreaterThanOrEqual(0);
    expect(restored.y).toBeGreaterThanOrEqual(0);
    expect(restored.x + restored.width).toBeLessThanOrEqual(500);
    expect(restored.y + restored.height).toBeLessThanOrEqual(292);
  });
});
