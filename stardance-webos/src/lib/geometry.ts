import type { Rect } from "../types";
import { clamp } from "./helpers";

export const TASKBAR_HEIGHT = 48;
export const TITLEBAR_HEIGHT = 34;
export const MOBILE_BREAKPOINT = 768;

export interface Size2 {
  width: number;
  height: number;
}

/** The area windows may occupy: the whole viewport minus the taskbar. */
export function getWorkArea(): Size2 {
  return {
    width: window.innerWidth,
    height: Math.max(0, window.innerHeight - TASKBAR_HEIGHT),
  };
}

/**
 * Keep a window reachable: at least 80px of it stays horizontally on-screen,
 * and the title bar never leaves the work area.
 */
export function clampWindowPosition(x: number, y: number, width: number): { x: number; y: number } {
  const area = getWorkArea();
  return {
    x: clamp(x, -(width - 80), area.width - 80),
    y: clamp(y, 0, Math.max(0, area.height - TITLEBAR_HEIGHT)),
  };
}

/** Clamp a rect into the work area (used when restoring saved sessions). */
export function fitRectToWorkArea(r: Rect, minW: number, minH: number): Rect {
  const area = getWorkArea();
  const width = clamp(r.width, minW, Math.max(minW, area.width));
  const height = clamp(r.height, minH, Math.max(minH, area.height));
  const p = clampWindowPosition(r.x, r.y, width);
  return { x: p.x, y: p.y, width, height };
}
