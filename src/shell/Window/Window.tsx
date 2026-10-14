import { memo, useEffect, useRef, useState } from "react";
import type { WindowState } from "../../types";
import { appRegistry } from "../../apps/registry";
import { useWindowStore } from "../../stores/useWindowStore";
import { useSystemStore } from "../../stores/useSystemStore";
import { ContextMenu } from "../ContextMenu/ContextMenu";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { detectSnapZone } from "../../lib/snap";
import { clampWindowPosition } from "../../lib/geometry";
import { WORKSPACE_INDICES } from "../../lib/workspaces";
import { playSound } from "../../lib/sound";
import { useIsMobile } from "../../lib/useIsMobile";
import { getIcon } from "../../lib/icons";
import { cx } from "../../lib/helpers";
import type { ContextMenuItem } from "../../types";
import "./Window.css";

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const RESIZE_DIRS: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const CLOSE_MS = 150;
const KEY_STEP = 20;
const DRAG_THRESHOLD = 4;

function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

interface WindowProps {
  win: WindowState;
}

function WindowImpl({ win }: WindowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const isMobile = useIsMobile();
  const windowStyle = useSystemStore((s) => s.windowStyle);
  const activeWorkspace = useWindowStore((s) => s.activeWorkspace);
  const focused = useWindowStore((s) => s.focusedId === win.id);
  // On phones only the top-most visible window is shown, full-screen.
  const mobileTopId = useWindowStore((s) => {
    let best: WindowState | null = null;
    for (const w of s.windows) {
      if (w.workspace === s.activeWorkspace && !w.isMinimized && (!best || w.zIndex > best.zIndex)) best = w;
    }
    return best?.id ?? null;
  });

  const app = appRegistry[win.appId];
  const minW = app?.minWidth ?? 320;
  const minH = app?.minHeight ?? 220;

  const hidden = win.isMinimized || win.workspace !== activeWorkspace || (isMobile && mobileTopId !== win.id);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Keep DOM focus on the focused window so its keyboard shortcuts work —
  // but never steal focus from an input the user is typing in.
  useEffect(() => {
    if (!focused || hidden) return;
    const el = rootRef.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [focused, hidden]);

  if (!app) return null;
  const AppComponent = app.component;
  const canMaximize = !isMobile;

  function requestClose() {
    if (closing) return;
    setClosing(true);
    playSound("close");
    closeTimer.current = window.setTimeout(() => useWindowStore.getState().closeWindow(win.id), CLOSE_MS);
  }

  function focusSelf() {
    useWindowStore.getState().focusWindow(win.id);
  }

  // ---------------- Dragging (+ snap preview) ----------------
  function onTitlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".terminal-btn")) return;
    focusSelf();
    if (isMobile) return;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    let startX = e.clientX;
    let startY = e.clientY;
    let origX = win.x;
    let origY = win.y;
    let width = win.width;
    let started = false;
    let zoneRect: ReturnType<typeof detectSnapZone> = null;

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        started = true;
        setDragging(true);
        document.body.classList.add("dragging");
        // Leaving a maximized / snapped state: restore its size under the cursor.
        const b = useWindowStore.getState().beginDrag(win.id, ev.clientX, ev.clientY);
        if (b) {
          origX = b.x;
          origY = b.y;
          width = b.width;
          startX = ev.clientX;
          startY = ev.clientY;
        }
      }
      const p = clampWindowPosition(origX + (ev.clientX - startX), origY + (ev.clientY - startY), width);
      const store = useWindowStore.getState();
      store.moveWindow(win.id, p.x, p.y);
      zoneRect = detectSnapZone(ev.clientX, ev.clientY, minW, minH);
      store.setSnapPreview(zoneRect ? zoneRect.rect : null);
    };

    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("dragging");
      setDragging(false);
      const store = useWindowStore.getState();
      if (started && zoneRect) store.snapWindow(win.id, zoneRect.rect, zoneRect.zone);
      store.setSnapPreview(null);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  // ---------------- Resizing ----------------
  function onResizePointerDown(e: React.PointerEvent<HTMLDivElement>, dir: ResizeDir) {
    if (e.button !== 0 || win.isMaximized || isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    focusSelf();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);

    const sx = e.clientX;
    const sy = e.clientY;
    const { x: bx, y: by, width: bw, height: bh } = win;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let x = bx;
      let y = by;
      let w = bw;
      let h = bh;
      if (dir.includes("e")) w = Math.max(minW, bw + dx);
      if (dir.includes("s")) h = Math.max(minH, bh + dy);
      if (dir.includes("w")) {
        w = Math.max(minW, bw - dx);
        x = bx + (bw - w);
      }
      if (dir.includes("n")) {
        h = Math.max(minH, bh - dy);
        y = by + (bh - h);
      }
      if (y < 0) {
        h += y;
        y = 0;
      }
      useWindowStore.getState().setBounds(win.id, { x, y, width: w, height: h });
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      setDragging(false);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  // ---------------- Keyboard (only while this window has focus) ----------------
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      requestClose();
      return;
    }
    if (!e.key.startsWith("Arrow") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target) || isMobile || win.isMaximized) return;
    // Only when the window frame / title bar itself is focused — arrows inside apps stay theirs.
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.closest(".window-header")) return;

    e.preventDefault();
    const dx = e.key === "ArrowLeft" ? -KEY_STEP : e.key === "ArrowRight" ? KEY_STEP : 0;
    const dy = e.key === "ArrowUp" ? -KEY_STEP : e.key === "ArrowDown" ? KEY_STEP : 0;
    const store = useWindowStore.getState();
    if (e.shiftKey) {
      store.setBounds(win.id, {
        x: win.x,
        y: win.y,
        width: Math.max(minW, win.width + dx),
        height: Math.max(minH, win.height + dy),
      });
    } else {
      const p = clampWindowPosition(win.x + dx, win.y + dy, win.width);
      store.moveWindow(win.id, p.x, p.y);
    }
  }

  // ---------------- Title-bar context menu ----------------
  const menuItems: ContextMenuItem[] = [
    { label: "Minimize", icon: "Minus", onClick: () => useWindowStore.getState().minimizeWindow(win.id) },
    ...(canMaximize
      ? [
          {
            label: win.isMaximized ? "Restore" : "Maximize",
            icon: win.isMaximized ? "Minimize2" : "Maximize2",
            onClick: () => useWindowStore.getState().toggleMaximize(win.id),
          },
        ]
      : []),
    ...WORKSPACE_INDICES.filter((i) => i !== win.workspace).map((i, n) => ({
      label: `Move to Desktop ${i + 1}`,
      icon: "Layers",
      separatorBefore: n === 0,
      onClick: () => useWindowStore.getState().moveWindowToWorkspace(win.id, i),
    })),
    { label: "Close", icon: "X", danger: true, separatorBefore: true, onClick: requestClose },
  ];

  const geometry: React.CSSProperties = isMobile
    ? {}
    : { left: win.x, top: win.y, width: win.width, height: win.height };

  const MaxIcon = getIcon(win.isMaximized ? "Copy" : "Square");
  const MinIcon = getIcon("Minus");
  const CloseIcon = getIcon("X");
  const TitleIcon = getIcon(win.icon);

  return (
    <div
      ref={rootRef}
      id={`window-${win.id}`}
      data-window
      data-system-style={windowStyle}
      data-app={win.appId}
      role="dialog"
      aria-label={win.title}
      tabIndex={-1}
      className={cx(
        "window",
        focused && "focused",
        win.isMaximized && "window--maximized",
        win.snapZone && "window--snapped",
        dragging && "window--dragging",
        closing && "window--closing",
      )}
      style={{ ...geometry, zIndex: win.zIndex, display: hidden ? "none" : undefined }}
      onPointerDown={() => {
        if (!focused) focusSelf();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className="window-header"
        onPointerDown={onTitlePointerDown}
        onDoubleClick={(e) => {
          if (canMaximize && !(e.target as HTMLElement).closest(".terminal-btn")) {
            useWindowStore.getState().toggleMaximize(win.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          focusSelf();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="window-title">
          <TitleIcon size={14} className="window__icon" />
          <span className="brand-text">{win.title}</span>
        </div>
        <div className="window-controls">
          <button
            type="button"
            className="terminal-btn window__btn"
            data-action="minimize"
            aria-label="Minimize"
            title="Minimize"
            onClick={() => useWindowStore.getState().minimizeWindow(win.id)}
          >
            <MinIcon size={13} />
          </button>
          <button
            type="button"
            className="terminal-btn window__btn"
            data-action="maximize"
            aria-label={win.isMaximized ? "Restore" : "Maximize"}
            title={win.isMaximized ? "Restore" : "Maximize"}
            disabled={!canMaximize}
            onClick={() => useWindowStore.getState().toggleMaximize(win.id)}
          >
            <MaxIcon size={12} />
          </button>
          <button
            type="button"
            className="terminal-btn window__btn"
            data-action="close"
            aria-label="Close"
            title="Close"
            onClick={requestClose}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      <div className="window__body">
        <AppErrorBoundary appName={app.name}>
          <AppComponent windowId={win.id} launchProps={win.launchProps} />
        </AppErrorBoundary>
      </div>

      {!win.isMaximized &&
        !isMobile &&
        RESIZE_DIRS.map((dir) => (
          <div
            key={dir}
            className={`window__resize window__resize--${dir}`}
            onPointerDown={(e) => onResizePointerDown(e, dir)}
          />
        ))}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
    </div>
  );
}

export const Window = memo(WindowImpl);
