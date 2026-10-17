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

export function zoneToRect(zone: SnapZoneName, _minW: number, _minH: number): Rect {
  const { x: X, y: Y, width: W, height: H } = getWorkArea();
  const halfW = Math.floor(W / 2);
  const halfH = Math.floor(H / 2);
  const mk = (x: number, y: number, w: number, h: number): Rect => ({
    x,
    y,
    width: w,
    height: h,
  });
  switch (zone) {
    case "maximize":
      return { x: X, y: Y, width: W, height: H };
    case "left":
      return mk(X, Y, halfW, H);
    case "right":
      return mk(X + W - halfW, Y, halfW, H);
    case "topLeft":
      return mk(X, Y, halfW, halfH);
    case "topRight":
      return mk(X + W - halfW, Y, halfW, halfH);
    case "bottomLeft":
      return mk(X, Y + H - halfH, halfW, halfH);
    case "bottomRight":
      return mk(X + W - halfW, Y + H - halfH, halfW, halfH);
  }
}

export function detectSnapZone(cursorX: number, cursorY: number, minW: number, minH: number): SnapResult | null {
  const { x: X, y: Y, width: W, height: H } = getWorkArea();
  if (W <= 0 || H <= 0) return null;

  const nearLeft = cursorX <= X + SNAP_CORNER;
  const nearRight = cursorX >= X + W - SNAP_CORNER;
  const nearTop = cursorY <= Y + SNAP_CORNER;
  const nearBottom = cursorY >= Y + H - SNAP_CORNER && cursorY <= Y + H + 8;

  let zone: SnapZoneName | null = null;
  if (nearTop && nearLeft) zone = "topLeft";
  else if (nearTop && nearRight) zone = "topRight";
  else if (nearBottom && nearLeft) zone = "bottomLeft";
  else if (nearBottom && nearRight) zone = "bottomRight";
  else if (cursorY <= Y + SNAP_EDGE) zone = "maximize";
  else if (cursorX <= X + SNAP_EDGE) zone = "left";
  else if (cursorX >= X + W - SNAP_EDGE) zone = "right";

  if (!zone) return null;
  return { zone, rect: zoneToRect(zone, minW, minH) };
}
