import { DEFAULT_BOARD, type BoardSize, type Direction, type GameStatus, type Point } from "./engine";
import { addFoodGrowth } from "./motion.js";
import type { AIDifficulty } from "./localEngines";

export interface BattleSnake {
  id: string;
  name: string;
  color: string;
  snake: Point[];
  direction: Direction;
  nextDirection: Direction | null;
  score: number;
  growthProgress: number;
  alive: boolean;
  bot: boolean;
}

export interface AIBattleState {
  players: BattleSnake[];
  food: Point | null;
  board: BoardSize;
  status: GameStatus;
  difficulty: AIDifficulty;
  winner: string | null;
}

const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];
const VECTOR: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};
const BOT_COLORS = ["#e37765", "#8c71d4", "#4197c9", "#d2a33f"];
const DIFFICULTY: Record<AIDifficulty, { pursuit: number; lead: number; noise: number }> = {
  easy: { pursuit: 0.18, lead: 1, noise: 3 },
  normal: { pursuit: 0.42, lead: 2, noise: 1.5 },
  hard: { pursuit: 0.68, lead: 4, noise: 0.6 },
  expert: { pursuit: 0.88, lead: 6, noise: 0.15 },
};

function key(point: Point): string {
  return `${point.x},${point.y}`;
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function inside(point: Point, board: BoardSize): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < board.columns && point.y < board.rows;
}

function spawnFood(players: BattleSnake[], board: BoardSize, random: () => number): Point | null {
  const occupied = new Set(players.flatMap((player) => player.snake.map(key)));
  const freeCount = board.columns * board.rows - occupied.size;
  if (freeCount <= 0) return null;
  const target = Math.min(freeCount - 1, Math.max(0, Math.floor(random() * freeCount)));
  let index = 0;
  for (let y = 0; y < board.rows; y += 1) {
    for (let x = 0; x < board.columns; x += 1) {
      const point = { x, y };
      if (occupied.has(key(point))) continue;
      if (index === target) return point;
      index += 1;
    }
  }
  return null;
}

function createSnake(id: string, name: string, color: string, head: Point, direction: Direction, bot: boolean): BattleSnake {
  const delta = VECTOR[direction];
  return {
    id,
    name,
    color,
    snake: [0, 1, 2].map((offset) => ({ x: head.x - delta.x * offset, y: head.y - delta.y * offset })),
    direction,
    nextDirection: null,
    score: 0,
    growthProgress: 0,
    alive: true,
    bot,
  };
}

export function createAIBattleState(
  difficulty: AIDifficulty = "normal",
  random = Math.random,
  board: BoardSize = DEFAULT_BOARD,
  botCount = 4,
): AIBattleState {
  const middle = { x: Math.floor(board.columns / 2), y: Math.floor(board.rows / 2) };
  const positions = [
    { x: Math.floor(board.columns * 0.18), y: Math.floor(board.rows * 0.2), direction: "right" as const },
    { x: Math.floor(board.columns * 0.82), y: Math.floor(board.rows * 0.2), direction: "left" as const },
    { x: Math.floor(board.columns * 0.18), y: Math.floor(board.rows * 0.8), direction: "right" as const },
    { x: Math.floor(board.columns * 0.82), y: Math.floor(board.rows * 0.8), direction: "left" as const },
  ];
  const players = [
    createSnake("human", "You", "#52a56f", middle, "right", false),
    ...positions.slice(0, Math.max(1, Math.min(4, Math.floor(botCount)))).map((spawn, index) =>
      createSnake(`bot-${index + 1}`, `Bot ${index + 1}`, BOT_COLORS[index], spawn, spawn.direction, true),
    ),
  ];
  return { players, food: spawnFood(players, board, random), board, status: "ready", difficulty, winner: null };
}

export function setAIBattleDirection(state: AIBattleState, direction: Direction): AIBattleState {
  if (state.status !== "ready" && state.status !== "playing") return state;
  const human = state.players[0];
  const effective = human.nextDirection ?? human.direction;
  if (OPPOSITE[effective] === direction || OPPOSITE[human.direction] === direction || direction === effective ||
    (human.nextDirection !== null && direction === human.direction)) return state;
  const players = [...state.players];
  players[0] = { ...human, nextDirection: direction };
  return { ...state, players };
}

function projectHead(player: BattleSnake, steps: number, board: BoardSize): Point {
  let point = { ...player.snake[0] };
  let direction = player.direction;
  for (let step = 0; step < steps; step += 1) {
    let next = { x: point.x + VECTOR[direction].x, y: point.y + VECTOR[direction].y };
    if (!inside(next, board)) {
      direction = OPPOSITE[direction];
      next = { x: point.x + VECTOR[direction].x, y: point.y + VECTOR[direction].y };
    }
    point = next;
  }
  return point;
}

function distanceMap(target: Point, blocked: Set<string>, board: BoardSize): Map<string, number> {
  const distances = new Map<string, number>([[key(target), 0]]);
  const queue: Point[] = [target];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    const nextDistance = distances.get(key(point))! + 1;
    for (const direction of DIRECTIONS) {
      const delta = VECTOR[direction];
      const next = { x: point.x + delta.x, y: point.y + delta.y };
      const nextKey = key(next);
      if (!inside(next, board) || blocked.has(nextKey) || distances.has(nextKey)) continue;
      distances.set(nextKey, nextDistance);
      queue.push(next);
    }
  }
  return distances;
}

function occupiedForBot(state: AIBattleState, bot: BattleSnake): Set<string> {
  const occupied = new Set<string>();
  for (const player of state.players) {
    if (!player.alive) continue;
    player.snake.forEach((point) => occupied.add(key(point)));
  }
  occupied.delete(key(bot.snake[0]));
  return occupied;
}

export function chooseBotDirection(state: AIBattleState, botId: string, random = Math.random): Direction | null {
  const bot = state.players.find((player) => player.id === botId && player.alive && player.bot);
  const human = state.players[0];
  if (!bot || !human?.alive) return null;
  const config = DIFFICULTY[state.difficulty];
  const occupied = occupiedForBot(state, bot);
  const chasePoint = projectHead(human, config.lead, state.board);
  const foodTarget = state.food;
  const chaseBlocks = new Set(occupied);
  chaseBlocks.delete(key(chasePoint));
  const foodBlocks = new Set(occupied);
  if (foodTarget) foodBlocks.delete(key(foodTarget));
  const chaseDistances = distanceMap(chasePoint, chaseBlocks, state.board);
  const foodDistances = foodTarget ? distanceMap(foodTarget, foodBlocks, state.board) : null;
  const candidates = DIRECTIONS.filter((direction) => direction !== OPPOSITE[bot.direction]).map((direction) => {
    const delta = VECTOR[direction];
    const point = { x: bot.snake[0].x + delta.x, y: bot.snake[0].y + delta.y };
    const isEating = foodTarget !== null && samePoint(point, foodTarget);
    const entersOwnVacatingTail = !isEating && samePoint(point, bot.snake[bot.snake.length - 1]);
    if (!inside(point, state.board) || (occupied.has(key(point)) && !entersOwnVacatingTail)) return null;
    const chaseDistance = chaseDistances.get(key(point));
    const foodDistance = foodDistances?.get(key(point));
    if (chaseDistance === undefined && foodDistance === undefined) return null;
    let openNeighbors = 0;
    for (const neighborDirection of DIRECTIONS) {
      const neighborDelta = VECTOR[neighborDirection];
      const neighbor = { x: point.x + neighborDelta.x, y: point.y + neighborDelta.y };
      if (inside(neighbor, state.board) && !occupied.has(key(neighbor))) openNeighbors += 1;
    }
    const foodCost = foodDistance ?? state.board.columns + state.board.rows;
    const chaseCost = chaseDistance ?? state.board.columns + state.board.rows;
    const edgeDistance = Math.min(point.x, point.y, state.board.columns - 1 - point.x, state.board.rows - 1 - point.y);
    const noise = (random() * 2 - 1) * config.noise;
    const score = foodCost * (1 - config.pursuit) + chaseCost * config.pursuit + (3 - openNeighbors) * 1.4 - Math.min(edgeDistance, 4) * 0.12 + noise;
    return { direction, score };
  }).filter((candidate): candidate is { direction: Direction; score: number } => candidate !== null);
  candidates.sort((a, b) => a.score - b.score || DIRECTIONS.indexOf(a.direction) - DIRECTIONS.indexOf(b.direction));
  return candidates[0]?.direction ?? DIRECTIONS.find((direction) => direction !== OPPOSITE[bot.direction]) ?? null;
}

export function advanceAIBattle(
  state: AIBattleState,
  random = Math.random,
  boosting = false,
): AIBattleState {
  if (state.status !== "playing") return state;
  const moves = state.players.map((player) => {
    const direction = player.bot ? chooseBotDirection(state, player.id, random) ?? player.direction : player.nextDirection ?? player.direction;
    const delta = VECTOR[direction];
    const head = { x: player.snake[0].x + delta.x, y: player.snake[0].y + delta.y };
    const collectsFood = player.alive && state.food !== null && samePoint(head, state.food);
    const growth = collectsFood ? addFoodGrowth(player.growthProgress, !player.bot && boosting) : { grow: false, progress: player.growthProgress };
    return { player, direction, head, collectsFood, grows: collectsFood && growth.grow, growthProgress: growth.progress };
  });
  const dead = new Set<string>();
  for (const move of moves) {
    if (!move.player.alive) continue;
    const ownBody = move.grows ? move.player.snake : move.player.snake.slice(0, -1);
    if (!inside(move.head, state.board) || ownBody.some((segment) => samePoint(segment, move.head))) dead.add(move.player.id);
    for (const other of moves) {
      if (other.player.id === move.player.id || !other.player.alive) continue;
      const body = other.grows ? other.player.snake : other.player.snake.slice(0, -1);
      if (body.some((segment) => samePoint(segment, move.head))) dead.add(move.player.id);
      if (samePoint(move.head, other.head) ||
        (samePoint(move.head, other.player.snake[0]) && samePoint(other.head, move.player.snake[0]))) {
        dead.add(move.player.id);
        dead.add(other.player.id);
      }
    }
  }
  const players = moves.map((move) => {
    const { player, direction, head, grows, collectsFood, growthProgress } = move;
    if (!player.alive || dead.has(player.id)) return { ...player, alive: false, nextDirection: null };
    const snake = [head, ...player.snake];
    if (!grows) snake.pop();
    return {
      ...player,
      snake,
      direction,
      nextDirection: null,
      score: player.score + Number(collectsFood),
      growthProgress: collectsFood ? growthProgress : player.growthProgress,
    };
  });
  const human = players[0];
  const botsAlive = players.slice(1).filter((player) => player.alive);
  const ended = !human.alive || botsAlive.length === 0;
  const winner = ended
    ? human.alive ? human.id : botsAlive.sort((a, b) => b.score - a.score)[0]?.id ?? null
    : null;
  const ate = moves.some((move) => move.collectsFood && !dead.has(move.player.id));
  const food = ate ? spawnFood(players.filter((player) => player.alive), state.board, random) : state.food;
  const boardCleared = food === null && !ended;
  return {
    ...state,
    players,
    food,
    status: ended ? "gameover" : boardCleared ? "won" : "playing",
    winner: boardCleared && human.alive ? human.id : winner,
  };
}
