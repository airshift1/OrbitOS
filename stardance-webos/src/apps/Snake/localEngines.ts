import { DEFAULT_BOARD, type BoardSize, type Direction, type Point } from "./engine";
import { addFoodGrowth, advanceBoostLevel, gridCellKey, moveSnake, segmentDistance, speedMultiplier, sweptPointHitsPoint, sweptPointHitsSnake } from "./motion.js";

export type Difficulty = "easy" | "normal" | "hard";
export type AIDifficulty = "easy" | "normal" | "hard" | "expert";
export type LocalStatus = "ready" | "playing" | "paused" | "gameover" | "won";

export const DIFFICULTIES: Record<Difficulty, { label: string; stepMs: number; speedupMs: number; minimumMs: number }> = {
  easy: { label: "Easy", stepMs: 260, speedupMs: 1, minimumMs: 155 },
  normal: { label: "Normal", stepMs: 210, speedupMs: 2, minimumMs: 105 },
  hard: { label: "Hard", stepMs: 165, speedupMs: 2, minimumMs: 80 },
};

export interface ClassicState {
  snake: Point[];
  direction: Direction;
  nextDirection: Direction | null;
  food: Point | null;
  score: number;
  growthProgress: number;
  boostLevel: number;
  board: BoardSize;
  difficulty: Difficulty;
  status: LocalStatus;
}

export interface VersusPlayer {
  id: "one" | "two";
  name: string;
  color: string;
  snake: Point[];
  direction: Direction;
  nextDirection: Direction | null;
  score: number;
  growthProgress: number;
  boostLevel: number;
  alive: boolean;
}

export interface VersusState {
  players: [VersusPlayer, VersusPlayer];
  food: Point | null;
  board: BoardSize;
  status: LocalStatus;
  winner: "one" | "two" | "draw" | null;
}

const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITES: Record<Direction, Direction> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};

function spawnFood(snakes: Point[][], board: BoardSize, random: () => number): Point | null {
  const occupied = new Set(snakes.flatMap((snake) => snake.map(gridCellKey)));
  const available: Point[] = [];
  for (let y = 0; y < board.rows; y += 1) {
    for (let x = 0; x < board.columns; x += 1) {
      if (!occupied.has(gridCellKey({ x, y }))) available.push({ x, y });
    }
  }
  if (!available.length) return null;
  const index = Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)));
  return available[index];
}

export function createClassicState(
  difficulty: Difficulty = "normal",
  random = Math.random,
  board: BoardSize = DEFAULT_BOARD,
): ClassicState {
  const head = { x: Math.floor(board.columns / 2), y: Math.floor(board.rows / 2) };
  const snake = [0, 1, 2, 3, 4].map((offset) => ({ x: head.x - offset, y: head.y }));
  return { snake, direction: "right", nextDirection: null, food: spawnFood([snake], board, random), score: 0, growthProgress: 0, boostLevel: 0, board, difficulty, status: "ready" };
}

export function setClassicDirection(state: ClassicState, direction: Direction): ClassicState {
  const effective = state.nextDirection ?? state.direction;
  if (OPPOSITES[effective] === direction || OPPOSITES[state.direction] === direction || direction === effective || (state.nextDirection !== null && direction === state.direction)) return state;
  return { ...state, nextDirection: direction };
}

export function classicStepMs(state: Pick<ClassicState, "score" | "difficulty">): number {
  const settings = DIFFICULTIES[state.difficulty];
  return Math.max(settings.minimumMs, settings.stepMs - state.score * settings.speedupMs);
}

export function advanceClassic(state: ClassicState, random = Math.random, boosting = false, deltaMs = classicStepMs(state)): ClassicState {
  if (state.status !== "playing") return state;
  const direction = state.nextDirection ?? state.direction;
  const vector = VECTORS[direction];
  const nextBoostLevel = advanceBoostLevel(state.boostLevel, boosting, deltaMs);
  const movementBoost = speedMultiplier((state.boostLevel + nextBoostLevel) / 2);
  const distance = Math.max(0, deltaMs) / classicStepMs(state) * movementBoost;
  const previousHead = state.snake[0];
  const head = { x: previousHead.x + vector.x * distance, y: previousHead.y + vector.y * distance };
  const collectsFood = state.food !== null && sweptPointHitsPoint(previousHead, head, state.food);
  const growth = collectsFood ? addFoodGrowth(state.growthProgress, boosting) : { grow: false, progress: state.growthProgress };
  const grows = collectsFood && growth.grow;
  const body = grows ? state.snake : state.snake.slice(0, -1);
  if (
    head.x < 0 || head.x >= state.board.columns || head.y < 0 || head.y >= state.board.rows ||
    sweptPointHitsSnake(previousHead, head, body, 1)
  ) return { ...state, direction, nextDirection: null, status: "gameover" };

  const snake = moveSnake(state.snake, vector, distance, state.snake.length + (grows ? 1 : 0));
  const food = collectsFood ? spawnFood([snake], state.board, random) : state.food;
  return {
    ...state,
    snake,
    direction,
    nextDirection: null,
    food,
    score: state.score + (collectsFood ? 1 : 0),
    growthProgress: growth.progress,
    boostLevel: nextBoostLevel,
    status: grows && food === null ? "won" : "playing",
  };
}

export function createVersusState(random = Math.random, board: BoardSize = DEFAULT_BOARD): VersusState {
  const first = { x: Math.floor(board.columns / 2) - 6, y: Math.floor(board.rows / 2) };
  const second = { x: Math.floor(board.columns / 2) + 6, y: Math.floor(board.rows / 2) };
  const playerOne: VersusPlayer = {
    id: "one", name: "Player 1", color: "#32b8a5",
    snake: [0, 1, 2, 3, 4].map((offset) => ({ x: first.x + offset, y: first.y })),
    direction: "left", nextDirection: null, score: 0, growthProgress: 0, boostLevel: 0, alive: true,
  };
  const playerTwo: VersusPlayer = {
    id: "two", name: "Player 2", color: "#f06f91",
    snake: [0, 1, 2, 3, 4].map((offset) => ({ x: second.x - offset, y: second.y })),
    direction: "right", nextDirection: null, score: 0, growthProgress: 0, boostLevel: 0, alive: true,
  };
  return { players: [playerOne, playerTwo], food: spawnFood([playerOne.snake, playerTwo.snake], board, random), board, status: "ready", winner: null };
}

export function setVersusDirection(state: VersusState, id: VersusPlayer["id"], direction: Direction): VersusState {
  if (state.status !== "playing") return state;
  const index = id === "one" ? 0 : 1;
  const player = state.players[index];
  const effective = player.nextDirection ?? player.direction;
  if (OPPOSITES[effective] === direction || OPPOSITES[player.direction] === direction || direction === effective || (player.nextDirection !== null && direction === player.direction)) return state;
  const players = [...state.players] as VersusState["players"];
  players[index] = { ...player, nextDirection: direction };
  return { ...state, players };
}

function outOfBounds(point: Point, board: BoardSize): boolean {
  return point.x < 0 || point.y < 0 || point.x >= board.columns || point.y >= board.rows;
}

export function advanceVersus(state: VersusState, random = Math.random, boosting: Partial<Record<VersusPlayer["id"], boolean>> = {}, deltaMs = 210): VersusState {
  if (state.status !== "playing") return state;
  const moves = state.players.map((player) => {
    const direction = player.nextDirection ?? player.direction;
    const vector = VECTORS[direction];
    const activeBoost = Boolean(boosting[player.id]);
    const nextBoostLevel = advanceBoostLevel(player.boostLevel, activeBoost, deltaMs);
    const movementBoost = speedMultiplier((player.boostLevel + nextBoostLevel) / 2);
    const distance = Math.max(0, deltaMs) / Math.max(115, 210 - player.score * 1.5) * movementBoost;
    const previousHead = player.snake[0];
    const head = { x: previousHead.x + vector.x * distance, y: previousHead.y + vector.y * distance };
    const collectsFood = state.food !== null && sweptPointHitsPoint(previousHead, head, state.food);
    const growth = collectsFood ? addFoodGrowth(player.growthProgress, activeBoost) : { grow: false, progress: player.growthProgress };
    const grows = collectsFood && growth.grow;
    return { player, direction, vector, distance, previousHead, head, grows, collectsFood, growthProgress: growth.progress, boostLevel: nextBoostLevel };
  });
  const dead = new Set<VersusPlayer["id"]>();
  for (const move of moves) {
    const ownBody = move.grows ? move.player.snake : move.player.snake.slice(0, -1);
    if (outOfBounds(move.head, state.board) || sweptPointHitsSnake(move.previousHead, move.head, ownBody, 1)) dead.add(move.player.id);
    const opponent = moves.find((candidate) => candidate.player.id !== move.player.id)!;
    const opponentBody = opponent.grows ? opponent.player.snake : opponent.player.snake.slice(0, -1);
    if (sweptPointHitsSnake(move.previousHead, move.head, opponentBody, 1)) dead.add(move.player.id);
    if (segmentDistance(move.previousHead, move.head, opponent.previousHead, opponent.head) < 0.9) {
      dead.add(move.player.id);
      dead.add(opponent.player.id);
    }
  }

  const players = moves.map(({ player, direction, vector, distance, grows, collectsFood, growthProgress, boostLevel }) => {
    const alive = player.alive && !dead.has(player.id);
    if (!alive) return { ...player, alive: false, nextDirection: null };
    const snake = moveSnake(player.snake, vector, distance, player.snake.length + (grows ? 1 : 0));
    return {
      ...player,
      snake,
      direction,
      nextDirection: null,
      score: player.score + (collectsFood ? 1 : 0),
      growthProgress: collectsFood ? growthProgress : player.growthProgress,
      boostLevel,
    };
  }) as VersusState["players"];
  const alive = players.filter((player) => player.alive);
  const status: LocalStatus = alive.length < 2 ? "gameover" : "playing";
  const winner = status !== "gameover" ? null : alive[0]?.id ?? "draw";
  const ate = moves.some((move) => move.player.alive && !dead.has(move.player.id) && move.collectsFood);
  const food = ate ? spawnFood(players.filter((player) => player.alive).map((player) => player.snake), state.board, random) : state.food;
  return { ...state, players, food, status: food === null && status === "playing" ? "won" : status, winner };
}
