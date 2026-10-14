import type { Rect, SnapZoneName } from "../types";
import { getWorkArea } from "./geometry";

/**
 * Pure snap-zone maths (ported from webos-master's `os/snap.ts`).
 *
 * The cursor is in viewport coordinates; the work area is the viewport minus
 * the taskbar. Corners are tested before edges so a cursor in a corner box
 * becomes a quarter tile rather than a half tile.
 */
export const SNAP_EDGE = 24;
export const SNAP_CORNER = 56;

export interface SnapResult {
  zone: SnapZoneName;
  rect: Rect;
}

export function zoneToRect(zone: SnapZoneName, minW: number, minH: number): Rect {
  const { width: W, height: H } = getWorkArea();
  const halfW = Math.floor(W / 2);
  const halfH = Math.floor(H / 2);
  const mk = (x: number, y: number, w: number, h: number): Rect => ({
    x,
    y,
    width: Math.max(minW, w),
    height: Math.max(minH, h),
  });
  switch (zone) {
    case "maximize":
      return { x: 0, y: 0, width: W, height: H };
    case "left":
      return mk(0, 0, halfW, H);
    case "right":
      return mk(W - halfW, 0, halfW, H);
    case "topLeft":
      return mk(0, 0, halfW, halfH);
    case "topRight":
      return mk(W - halfW, 0, halfW, halfH);
    case "bottomLeft":
      return mk(0, H - halfH, halfW, halfH);
    case "bottomRight":
      return mk(W - halfW, H - halfH, halfW, halfH);
  }
}

export function detectSnapZone(cursorX: number, cursorY: number, minW: number, minH: number): SnapResult | null {
  const { width: W, height: H } = getWorkArea();
  if (W <= 0 || H <= 0) return null;

  const nearLeft = cursorX <= SNAP_CORNER;
  const nearRight = cursorX >= W - SNAP_CORNER;
  const nearTop = cursorY <= SNAP_CORNER;
  const nearBottom = cursorY >= H - SNAP_CORNER && cursorY <= H + 8;

  let zone: SnapZoneName | null = null;
  if (nearTop && nearLeft) zone = "topLeft";
  else if (nearTop && nearRight) zone = "topRight";
  else if (nearBottom && nearLeft) zone = "bottomLeft";
  else if (nearBottom && nearRight) zone = "bottomRight";
  else if (cursorY <= SNAP_EDGE) zone = "maximize";
  else if (cursorX <= SNAP_EDGE) zone = "left";
  else if (cursorX >= W - SNAP_EDGE) zone = "right";

  if (!zone) return null;
  return { zone, rect: zoneToRect(zone, minW, minH) };
}
