import type { Point } from "./engine.js";

export function appendHeadHistory(history: Point[], previousHead: Point, nextHead: Point, length: number): Point[] {
  if (previousHead.x === nextHead.x && previousHead.y === nextHead.y) return history.slice(0, length + 2);
  return [nextHead, ...history].slice(0, length + 2);
}

function pointAtDistance(history: Point[], distance: number, fallback: Point): Point {
  const wholeSteps = Math.floor(distance);
  const fraction = distance - wholeSteps;
  const from = history[wholeSteps] ?? fallback;
  const to = history[wholeSteps + 1] ?? from;
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
}

export function interpolateSnake(history: Point[], fallbackSnake: Point[], progress: number): Point[] {
  const amount = Math.max(0, Math.min(1, progress));
  return fallbackSnake.map((fallback, index) => pointAtDistance(history, index + 1 - amount, fallback));
}

export function addFoodGrowth(progress: number, boosting: boolean): { grow: boolean; progress: number } {
  const accumulated = progress + (boosting ? 0.5 : 1);
  const grow = accumulated >= 1;
  return { grow, progress: grow ? accumulated - 1 : accumulated };
}
