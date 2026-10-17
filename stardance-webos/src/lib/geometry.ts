import type { Rect } from "../types";
import { clamp } from "./helpers";
import { useSystemStore } from "../stores/useSystemStore";

export const TASKBAR_HEIGHT = 48;
export const TITLEBAR_HEIGHT = 34;
export const MOBILE_BREAKPOINT = 768;

export interface Size2 {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The area windows may occupy: the whole viewport minus the taskbar. */
export function getWorkArea(): Size2 {
  const { dockPosition, dockSize } = useSystemStore.getState().customization;
  const sideWidth = dockSize + 16;
  const x = dockPosition === "left" ? sideWidth : 0;
  const y = 0;
  return {
    x,
    y,
    width: Math.max(0, window.innerWidth - (dockPosition === "left" || dockPosition === "right" ? sideWidth : 0)),
    height: Math.max(0, window.innerHeight - (dockPosition === "bottom" ? dockSize : 0)),
  };
}

/**
 * Keep a window reachable: at least 80px of it stays horizontally on-screen,
 * and the title bar never leaves the work area.
 */
export function clampWindowPosition(x: number, y: number, width: number): { x: number; y: number } {
  const area = getWorkArea();
  return {
    x: clamp(x, area.x - (width - 80), area.x + area.width - 80),
    y: clamp(y, area.y, Math.max(area.y, area.y + area.height - TITLEBAR_HEIGHT)),
  };
}

/** Clamp a rect into the work area (used when restoring saved sessions). */
export function fitRectToWorkArea(r: Rect, minW: number, minH: number): Rect {
  const area = getWorkArea();
  const width = clamp(r.width, Math.min(minW, area.width), area.width);
  const height = clamp(r.height, Math.min(minH, area.height), area.height);
  return {
    x: clamp(r.x, area.x, Math.max(area.x, area.x + area.width - width)),
    y: clamp(r.y, area.y, Math.max(area.y, area.y + area.height - height)),
    width,
    height,
  };
}
