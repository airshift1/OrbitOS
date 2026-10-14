import { create } from "zustand";
import type { AppId, Rect, SnapZoneName, WindowState } from "../types";
import { getWorkArea, fitRectToWorkArea, clampWindowPosition } from "../lib/geometry";
import { zoneToRect } from "../lib/snap";
import { clampWorkspace } from "../lib/workspaces";

/**
 * Window manager state.
 *
 * Merges three upstream window managers:
 *  - WebOS-main   : the flat-rect window model, z-order stacking & 8-way resize
 *  - webos-master : virtual desktops (workspaces) + snap tiling
 *  - core-main    : half / quarter snap preview overlay
 *
 * Geometry is expressed in viewport pixels; the work area is the viewport
 * minus the taskbar (see lib/geometry).
 */

interface OpenParams {
  appId: AppId;
  title: string;
  icon: string;
  width: number;
  height: number;
  launchProps?: Record<string, unknown>;
}

interface WindowStoreState {
  windows: WindowState[];
  focusedId: string | null;
  topZIndex: number;
  activeWorkspace: number;
  /** Transient: the rect previewed while dragging a window to a snap zone. */
  snapPreview: Rect | null;

  openWindow: (params: OpenParams) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  setBounds: (id: string, b: Rect) => void;
  setTitle: (id: string, title: string) => void;

  /** Leave maximized / snapped state so a drag can start (keeps the cursor on the title bar). */
  beginDrag: (id: string, pointerX: number, pointerY: number) => Rect | null;
  setSnapPreview: (rect: Rect | null) => void;
  snapWindow: (id: string, rect: Rect, zone: SnapZoneName) => void;

  /** Re-fit maximized / snapped / off-screen windows after the viewport changed. */
  refitWindows: () => void;

  switchWorkspace: (n: number) => void;
  moveWindowToWorkspace: (id: string, n: number) => void;

  /** Replace everything (used by session restore). */
  hydrate: (snapshot: { windows: WindowState[]; focusedId: string | null; topZIndex: number; activeWorkspace: number }) => void;
}

/** The visible window with the highest zIndex inside one workspace. */
function topVisibleId(windows: WindowState[], workspace: number, excludeId?: string): string | null {
  const visible = windows.filter((w) => w.workspace === workspace && !w.isMinimized && w.id !== excludeId);
  if (visible.length === 0) return null;
  return visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).id;
}

const CASCADE_STEP = 30;

export const useWindowStore = create<WindowStoreState>()((set, get) => ({
  windows: [],
  focusedId: null,
  topZIndex: 100,
  activeWorkspace: 0,
  snapPreview: null,

  openWindow: (params) => {
    const id = crypto.randomUUID();
    const { windows, topZIndex, activeWorkspace } = get();
    const newZ = topZIndex + 1;
    // Cascade against the ACTIVE desktop only.
    const onActive = windows.filter((w) => w.workspace === activeWorkspace);
    const cascade = onActive.length % 6;
    const area = getWorkArea();
    const width = Math.min(params.width, Math.max(320, area.width - 24));
    const height = Math.min(params.height, Math.max(220, area.height - 24));
    const p = Math.max(0, Math.min(132 + cascade * CASCADE_STEP, area.width - width));
    const q = Math.max(0, Math.min(60 + cascade * CASCADE_STEP, area.height - height));
    const win: WindowState = {
      id,
      appId: params.appId,
      title: params.title,
      icon: params.icon,
      x: p,
      y: q,
      width,
      height,
      zIndex: newZ,
      workspace: activeWorkspace,
      isMinimized: false,
      isMaximized: false,
      launchProps: params.launchProps,
    };
    set({ windows: [...windows, win], topZIndex: newZ, focusedId: id });
    return id;
  },

  closeWindow: (id) => {
    set((state) => {
      const target = state.windows.find((w) => w.id === id);
      if (!target) return state;
      const remaining = state.windows.filter((w) => w.id !== id);
      let focusedId = state.focusedId;
      if (state.focusedId === id) {
        // Promote within the ACTIVE workspace only.
        focusedId = topVisibleId(remaining, state.activeWorkspace);
      }
      return { windows: remaining, focusedId, snapPreview: null };
    });
  },

  // Focusing a window also reveals it: un-minimizes and follows it to its desktop.
  focusWindow: (id) => {
    set((state) => {
      const target = state.windows.find((w) => w.id === id);
      if (!target) return state;
      if (
        state.focusedId === id &&
        !target.isMinimized &&
        target.workspace === state.activeWorkspace &&
        target.zIndex === state.topZIndex
      ) {
        return state;
      }
      const newZ = state.topZIndex + 1;
      return {
        topZIndex: newZ,
        focusedId: id,
        activeWorkspace: target.workspace,
        windows: state.windows.map((w) => (w.id === id ? { ...w, zIndex: newZ, isMinimized: false } : w)),
      };
    });
  },

  minimizeWindow: (id) => {
    set((state) => {
      const windows = state.windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w));
      const focusedId = state.focusedId === id ? topVisibleId(windows, state.activeWorkspace) : state.focusedId;
      return { windows, focusedId };
    });
  },

  restoreWindow: (id) => {
    get().focusWindow(id);
  },

  toggleMaximize: (id) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.isMaximized) {
          const prev = w.prevBounds;
          if (prev) {
            const fit = fitRectToWorkArea(prev, 240, 160);
            return { ...w, isMaximized: false, snapZone: undefined, prevBounds: undefined, ...fit };
          }
          return { ...w, isMaximized: false, snapZone: undefined, x: 80, y: 60 };
        }
        const area = getWorkArea();
        return {
          ...w,
          isMaximized: true,
          snapZone: undefined,
          // If it was snapped, remember the pre-snap geometry rather than the tile.
          prevBounds: w.prevBounds ?? { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0,
          y: 0,
          width: area.width,
          height: area.height,
        };
      }),
    }));
    get().focusWindow(id);
  },

  moveWindow: (id, x, y) => {
    set((state) => ({ windows: state.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) }));
  },

  resizeWindow: (id, width, height) => {
    set((state) => ({ windows: state.windows.map((w) => (w.id === id ? { ...w, width, height } : w)) }));
  },

  setBounds: (id, b) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        // Manually resizing a tiled window takes it out of its snap zone.
        w.id === id ? { ...w, ...b, snapZone: undefined, prevBounds: w.snapZone ? undefined : w.prevBounds } : w,
      ),
    }));
  },

  setTitle: (id, title) => {
    set((state) => ({ windows: state.windows.map((w) => (w.id === id ? { ...w, title } : w)) }));
  },

  beginDrag: (id, pointerX, pointerY) => {
    const w = get().windows.find((x) => x.id === id);
    if (!w) return null;
    if (!w.isMaximized && !w.snapZone) return { x: w.x, y: w.y, width: w.width, height: w.height };

    const prev = w.prevBounds ?? { x: 80, y: 60, width: Math.min(w.width, 720), height: Math.min(w.height, 480) };
    // Keep the cursor at the same horizontal proportion of the title bar.
    const ratio = w.width > 0 ? Math.min(1, Math.max(0, (pointerX - w.x) / w.width)) : 0.5;
    const nx = pointerX - ratio * prev.width;
    const ny = Math.max(0, pointerY - 16);
    const next: Rect = { x: nx, y: ny, width: prev.width, height: prev.height };
    set((state) => ({
      windows: state.windows.map((x) =>
        x.id === id ? { ...x, ...next, isMaximized: false, snapZone: undefined, prevBounds: undefined } : x,
      ),
    }));
    return next;
  },

  setSnapPreview: (rect) => {
    set((s) => {
      if (s.snapPreview === null && rect === null) return s;
      if (
        s.snapPreview &&
        rect &&
        s.snapPreview.x === rect.x &&
        s.snapPreview.y === rect.y &&
        s.snapPreview.width === rect.width &&
        s.snapPreview.height === rect.height
      )
        return s;
      return { snapPreview: rect };
    });
  },

  snapWindow: (id, rect, zone) => {
    set((state) => ({
      snapPreview: null,
      windows: state.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...rect,
              isMaximized: zone === "maximize",
              snapZone: zone === "maximize" ? undefined : zone,
              prevBounds: w.prevBounds ?? { x: w.x, y: w.y, width: w.width, height: w.height },
            }
          : w,
      ),
    }));
  },

  refitWindows: () => {
    const area = getWorkArea();
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.isMaximized) {
          if (w.x === 0 && w.y === 0 && w.width === area.width && w.height === area.height) return w;
          return { ...w, x: 0, y: 0, width: area.width, height: area.height };
        }
        if (w.snapZone) return { ...w, ...zoneToRect(w.snapZone, 240, 160) };
        const width = Math.min(w.width, Math.max(240, area.width));
        const p = clampWindowPosition(w.x, w.y, width);
        if (p.x === w.x && p.y === w.y && width === w.width) return w;
        return { ...w, x: p.x, y: p.y, width };
      }),
    }));
  },

  switchWorkspace: (n) => {
    const target = clampWorkspace(n);
    set((state) => {
      if (state.activeWorkspace === target) return state;
      return { activeWorkspace: target, focusedId: topVisibleId(state.windows, target), snapPreview: null };
    });
  },

  moveWindowToWorkspace: (id, n) => {
    const target = clampWorkspace(n);
    set((state) => {
      const w = state.windows.find((x) => x.id === id);
      if (!w || w.workspace === target) return state;
      // Slip in just below the destination's top window so it doesn't steal focus later.
      const destMax = state.windows
        .filter((x) => x.workspace === target && x.id !== id)
        .reduce((m, x) => Math.max(m, x.zIndex), -Infinity);
      const movedZ = Number.isFinite(destMax) ? destMax - 1 : w.zIndex;
      const windows = state.windows.map((x) => (x.id === id ? { ...x, workspace: target, zIndex: movedZ } : x));
      const focusedId =
        state.focusedId === id ? topVisibleId(windows, state.activeWorkspace, id) : state.focusedId;
      return { windows, focusedId };
    });
  },

  hydrate: (snapshot) => {
    set({
      windows: snapshot.windows,
      focusedId: snapshot.focusedId,
      topZIndex: snapshot.topZIndex,
      activeWorkspace: clampWorkspace(snapshot.activeWorkspace),
      snapPreview: null,
    });
  },
}));
