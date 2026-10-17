import { addFoodGrowth } from "./motion.js";

export interface BoardSize {
  columns: number;
  rows: number;
}

export const DEFAULT_BOARD: BoardSize = { columns: 60, rows: 40 };
export const BOARD_COLUMNS = DEFAULT_BOARD.columns;
export const BOARD_ROWS = DEFAULT_BOARD.rows;
export const VIEWPORT_COLUMNS = 24;
export const VIEWPORT_ROWS = 16;
export const WINNING_SCORE = 67;
export const FIRST_SPECIAL_SCORE = 25;
export const CELEBRATION_DURATION_MS = 3000;
export const BASE_STEP_MS = 260;
export const MIN_STEP_MS = 110;
export const SPEEDUP_PER_CUPCAKE_MS = 2;

export interface Point {
  x: number;
  y: number;
}

export type Direction = "up" | "right" | "down" | "left";
export type GameStatus = "ready" | "playing" | "paused" | "celebrating" | "won" | "gameover";

export interface GameState {
  snake: Point[];
  board: BoardSize;
  direction: Direction;
  nextDirection: Direction | null;
  food: Point | null;
  specialFood: Point | null;
  score: number;
  growthProgress: number;
  nextSpecialScore: number;
  status: GameStatus;
}

const directions: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const opposite: Record<Direction, Direction> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};

export function getStepMs(score: number): number {
  return Math.max(MIN_STEP_MS, BASE_STEP_MS - Math.max(0, score) * SPEEDUP_PER_CUPCAKE_MS);
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function spawnFood(snake: Point[], random = Math.random, board: BoardSize = DEFAULT_BOARD): Point | null {
  const occupied = new Set(snake.map(({ x, y }) => `${x},${y}`));
  const free: Point[] = [];

  for (let y = 0; y < board.rows; y += 1) {
    for (let x = 0; x < board.columns; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }

  if (free.length === 0) return null;
  const index = Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)));
  return free[index];
}

export function createGameState(random = Math.random, board: BoardSize = DEFAULT_BOARD): GameState {
  const snake = [
    { x: Math.floor(board.columns / 2), y: Math.floor(board.rows / 2) },
    { x: Math.floor(board.columns / 2), y: Math.floor(board.rows / 2) + 1 },
    { x: Math.floor(board.columns / 2), y: Math.floor(board.rows / 2) + 2 },
  ];

  return {
    snake,
    board,
    direction: "up",
    nextDirection: null,
    food: spawnFood(snake, random, board),
    specialFood: null,
    score: 0,
    growthProgress: 0,
    nextSpecialScore: FIRST_SPECIAL_SCORE,
    status: "ready",
  };
}

export function restartGame(random = Math.random, board: BoardSize = DEFAULT_BOARD): GameState {
  return createGameState(random, board);
}

export function setDirection(state: GameState, direction: Direction): GameState {
  const current = state.nextDirection ?? state.direction;
  if (opposite[current] === direction || opposite[state.direction] === direction || direction === current) return state;
  return { ...state, nextDirection: direction };
}

export function directionFromSwipe(start: Point, end: Point): Direction | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export function advanceGame(state: GameState, random = Math.random, boosting = false): GameState {
  if (state.status !== "playing") return state;

  const head = state.snake[0];
  const direction = state.nextDirection ?? state.direction;
  const movement = directions[direction];
  const nextHead = { x: head.x + movement.x, y: head.y + movement.y };
  const eatsRegular = state.food !== null && samePoint(nextHead, state.food);
  const eatsSpecial = state.specialFood !== null && samePoint(nextHead, state.specialFood);
  const collectedFood = eatsRegular || eatsSpecial;
  const growth = collectedFood ? addFoodGrowth(state.growthProgress, boosting) : { grow: false, progress: state.growthProgress };
  const grows = collectedFood && growth.grow;
  const collidableBody = grows ? state.snake : state.snake.slice(0, -1);

  if (
    nextHead.x < 0 ||
    nextHead.x >= state.board.columns ||
    nextHead.y < 0 ||
    nextHead.y >= state.board.rows ||
    collidableBody.some((segment) => samePoint(segment, nextHead))
  ) {
    return { ...state, direction, nextDirection: null, status: "gameover" };
  }

  const snake = [nextHead, ...state.snake];
  if (!grows) snake.pop();

  if (eatsSpecial) {
    const score = state.score + 1;
    return {
      ...state,
      snake,
      direction,
      nextDirection: null,
      score,
      growthProgress: growth.progress,
      specialFood: null,
      food: spawnFood(snake, random, state.board),
      status: score >= WINNING_SCORE ? "won" : "celebrating",
    };
  }

  if (eatsRegular) {
    const score = state.score + 1;
    const specialReady = score >= state.nextSpecialScore;
    const food = spawnFood(snake, random, state.board);
    const specialFood = specialReady ? spawnFood([...snake, ...(food ? [food] : [])], random, state.board) : state.specialFood;
    return {
      ...state,
      snake,
      direction,
      nextDirection: null,
      score,
      growthProgress: growth.progress,
      food,
      specialFood,
      nextSpecialScore: specialReady ? state.nextSpecialScore + FIRST_SPECIAL_SCORE : state.nextSpecialScore,
      status: score >= WINNING_SCORE || (!food && !specialFood) ? "won" : "playing",
    };
  }

  return { ...state, snake, direction, nextDirection: null };
}

export function startGame(state: GameState): GameState {
  return state.status === "ready" ? { ...state, status: "playing" } : state;
}

export function pauseGame(state: GameState): GameState {
  return state.status === "playing" ? { ...state, status: "paused" } : state;
}

export function resumeGame(state: GameState): GameState {
  return state.status === "paused" ? { ...state, status: "playing" } : state;
}
