import type { AppId, WindowState } from "../types";
import { appRegistry } from "../apps/registry";
import { useWindowStore } from "../stores/useWindowStore";
import { useSystemStore } from "../stores/useSystemStore";
import { clampWorkspace } from "./workspaces";
import { fitRectToWorkArea } from "./geometry";

/**
 * Optional session restore (from webos-master's persisted window store).
 * WebOS-main always started fresh, so this is opt-in via Settings →
 * "Restore windows on reload". Windows are validated on the way back in:
 * unknown apps are dropped and geometry is re-fitted to the viewport.
 */
const KEY = "webos-session";

interface SessionSnapshot {
  windows: WindowState[];
  focusedId: string | null;
  topZIndex: number;
  activeWorkspace: number;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function sanitize(raw: unknown): SessionSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SessionSnapshot>;
  if (!Array.isArray(r.windows)) return null;

  const windows: WindowState[] = [];
  const seen = new Set<string>();
  for (const w of r.windows as Partial<WindowState>[]) {
    if (!w || typeof w.id !== "string" || seen.has(w.id)) continue;
    if (typeof w.appId !== "string" || !(w.appId in appRegistry)) continue;
    if (![w.x, w.y, w.width, w.height, w.zIndex].every(isNum)) continue;
    const def = appRegistry[w.appId as AppId];
    const fit = fitRectToWorkArea(
      { x: w.x!, y: w.y!, width: w.width!, height: w.height! },
      def.minWidth ?? 320,
      def.minHeight ?? 220,
    );
    seen.add(w.id);
    windows.push({
      id: w.id,
      appId: w.appId as AppId,
      title: typeof w.title === "string" ? w.title : def.name,
      icon: typeof w.icon === "string" ? w.icon : def.icon,
      zIndex: w.zIndex!,
      workspace: clampWorkspace(w.workspace),
      isMinimized: !!w.isMinimized,
      isMaximized: !!w.isMaximized,
      snapZone: w.snapZone,
      prevBounds: w.prevBounds,
      launchProps: w.launchProps && typeof w.launchProps === "object" ? w.launchProps : undefined,
      ...fit,
    });
  }

  const topZ = windows.reduce((m, w) => Math.max(m, w.zIndex), 100);
  const focusedId = windows.some((w) => w.id === r.focusedId) ? (r.focusedId as string) : null;
  return {
    windows,
    focusedId,
    topZIndex: Math.max(topZ, isNum(r.topZIndex) ? r.topZIndex : 100),
    activeWorkspace: clampWorkspace(r.activeWorkspace),
  };
}

/** Call once before first render. Returns how many windows came back. */
export function restoreSession(): number {
  if (!useSystemStore.getState().restoreSession) return 0;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const snap = sanitize(JSON.parse(raw));
    if (!snap || snap.windows.length === 0) return 0;
    useWindowStore.getState().hydrate(snap);
    // A restored window is re-fitted, so refresh maximized / snapped geometry too.
    useWindowStore.getState().refitWindows();
    return snap.windows.length;
  } catch {
    localStorage.removeItem(KEY);
    return 0;
  }
}

let timer: number | undefined;

function save() {
  try {
    if (!useSystemStore.getState().restoreSession) {
      localStorage.removeItem(KEY);
      return;
    }
    const { windows, focusedId, topZIndex, activeWorkspace } = useWindowStore.getState();
    const snap: SessionSnapshot = { windows, focusedId, topZIndex, activeWorkspace };
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // storage full / unavailable — session restore is best-effort
  }
}

/** Debounced writer; also flushes when the tab is hidden or closed. */
export function startSessionPersistence() {
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(save, 250);
  };
  const unsubW = useWindowStore.subscribe(schedule);
  const unsubS = useSystemStore.subscribe((s, prev) => {
    if (s.restoreSession !== prev.restoreSession) schedule();
  });
  const flush = () => save();
  window.addEventListener("pagehide", flush);
  return () => {
    unsubW();
    unsubS();
    window.removeEventListener("pagehide", flush);
    window.clearTimeout(timer);
  };
}
