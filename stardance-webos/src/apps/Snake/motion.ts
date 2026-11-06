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

const SEGMENT_SPACING = 1;
const COLLISION_RADIUS = 0.48;
export const BOOST_RAMP_MS = 180;
export const BOOST_SPEED_INCREASE = 0.55;

export function advanceBoostLevel(level: number, boosting: boolean, deltaMs: number): number {
  const amount = Math.max(0, deltaMs) / BOOST_RAMP_MS;
  return Math.max(0, Math.min(1, level + (boosting ? amount : -amount)));
}

export function speedMultiplier(boostLevel: number): number {
  return 1 + Math.max(0, Math.min(1, boostLevel)) * BOOST_SPEED_INCREASE;
}

export function gridCellKey(point: Point): string {
  return `${Math.round(point.x)},${Math.round(point.y)}`;
}

export function moveSnake(snake: Point[], direction: Point, distance: number, targetLength = snake.length): Point[] {
  if (snake.length === 0 || distance <= 0) return snake;
  const head = { x: snake[0].x + direction.x * distance, y: snake[0].y + direction.y * distance };
  const path = [head, ...snake];
  const requiredDistance = Math.max(0, targetLength - 1);
  let pathLength = path.slice(1).reduce((length, point, index) =>
    length + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0);
  if (pathLength < requiredDistance && path.length > 1) {
    let previous = path[path.length - 2];
    let tail = path[path.length - 1];
    let tailLength = Math.hypot(tail.x - previous.x, tail.y - previous.y);
    for (let index = path.length - 2; tailLength === 0 && index > 0; index -= 1) {
      previous = path[index - 1];
      tail = path[index];
      tailLength = Math.hypot(tail.x - previous.x, tail.y - previous.y);
    }
    if (tailLength > 0) {
      const extraDistance = requiredDistance - pathLength;
      path.push({
        x: tail.x + ((tail.x - previous.x) / tailLength) * extraDistance,
        y: tail.y + ((tail.y - previous.y) / tailLength) * extraDistance,
      });
    }
  }
  const result: Point[] = [head];
  let pathIndex = 0;
  let traversed = 0;

  for (let segment = 1; segment < targetLength; segment += 1) {
    const targetDistance = segment * SEGMENT_SPACING;
    while (pathIndex < path.length - 1) {
      const from = path[pathIndex];
      const to = path[pathIndex + 1];
      const span = Math.hypot(to.x - from.x, to.y - from.y);
      if (traversed + span >= targetDistance) {
        const fraction = span === 0 ? 0 : (targetDistance - traversed) / span;
        result.push({ x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction });
        break;
      }
      traversed += span;
      pathIndex += 1;
    }
    if (result.length === segment) result.push({ ...path[path.length - 1] });
  }

  return result;
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + fraction * dx), point.y - (start.y + fraction * dy));
}

export function sweptPointHitsSnake(from: Point, to: Point, snake: Point[], skipSegments = 2): boolean {
  for (let index = Math.max(0, skipSegments); index < snake.length; index += 1) {
    if (distanceToSegment(snake[index], from, to) < COLLISION_RADIUS) return true;
  }
  for (let index = Math.max(1, skipSegments + 1); index < snake.length; index += 1) {
    if (segmentDistance(from, to, snake[index - 1], snake[index]) < COLLISION_RADIUS) return true;
  }
  return false;
}

export function sweptPointHitsPoint(from: Point, to: Point, target: Point, radius = COLLISION_RADIUS): boolean {
  return distanceToSegment(target, from, to) <= radius;
}

export function pointHitsSnake(point: Point, snake: Point[], skipSegments = 0, radius = COLLISION_RADIUS): boolean {
  for (let index = skipSegments; index < snake.length; index += 1) {
    if (Math.hypot(point.x - snake[index].x, point.y - snake[index].y) <= radius) return true;
  }
  return false;
}

export function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  const orientation = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if ((abC > 0 && abD < 0 || abC < 0 && abD > 0) &&
      (cdA > 0 && cdB < 0 || cdA < 0 && cdB > 0)) return 0;
  if ((abC === 0 && onSegment(a, c, b)) || (abD === 0 && onSegment(a, d, b)) ||
      (cdA === 0 && onSegment(c, a, d)) || (cdB === 0 && onSegment(c, b, d))) return 0;
  return Math.min(
    distanceToSegment(a, c, d),
    distanceToSegment(b, c, d),
    distanceToSegment(c, a, b),
    distanceToSegment(d, a, b),
  );
}
