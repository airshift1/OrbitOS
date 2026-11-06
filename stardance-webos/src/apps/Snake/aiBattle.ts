import { DEFAULT_BOARD, type BoardSize, type Direction, type GameStatus, type Point } from "./engine";
import { addFoodGrowth, advanceBoostLevel, gridCellKey, moveSnake, speedMultiplier, sweptPointHitsPoint, sweptPointHitsSnake } from "./motion.js";
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
  boostLevel: number;
  decisionProgress: number;
  boosting: boolean;
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
const DIFFICULTY: Record<AIDifficulty, { lead: number; lookAhead: number; advantage: number; noise: number }> = {
  easy: { lead: 2, lookAhead: 2, advantage: 7, noise: 0.9 },
  normal: { lead: 3, lookAhead: 4, advantage: 5, noise: 0.45 },
  hard: { lead: 5, lookAhead: 6, advantage: 4, noise: 0.18 },
  expert: { lead: 7, lookAhead: 8, advantage: 3, noise: 0.05 },
};

function key(point: Point): string {
  return gridCellKey(point);
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

function createSnake(id: string, name: string, color: string, head: Point, direction: Direction, bot: boolean, board: BoardSize): BattleSnake {
  const delta = VECTOR[direction];
  const fittedHead = {
    x: delta.x === 0
      ? head.x
      : Math.max(4, Math.min(board.columns - 5, head.x)),
    y: delta.y === 0
      ? head.y
      : Math.max(4, Math.min(board.rows - 5, head.y)),
  };
  return {
    id,
    name,
    color,
    snake: [0, 1, 2, 3, 4].map((offset) => ({ x: fittedHead.x - delta.x * offset, y: fittedHead.y - delta.y * offset })),
    direction,
    nextDirection: null,
    score: 0,
    growthProgress: 0,
    boostLevel: 0,
    decisionProgress: 0,
    boosting: false,
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
    createSnake("human", "You", "#52a56f", middle, "right", false, board),
    ...positions.slice(0, Math.max(1, Math.min(4, Math.floor(botCount)))).map((spawn, index) =>
      createSnake(`bot-${index + 1}`, `Bot ${index + 1}`, BOT_COLORS[index], spawn, spawn.direction, true, board),
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

export function chooseBotDirection(state: AIBattleState, botId: string, random = Math.random): Direction | null {
  const bot = state.players.find((player) => player.id === botId && player.alive && player.bot);
  if (!bot) return null;
  const config = DIFFICULTY[state.difficulty];
  const botHead = bot.snake[0];
  const rivals = state.players.filter((player) => player.id !== bot.id && player.alive);
  const target = rivals
    .filter((player) => bot.snake.length >= player.snake.length + config.advantage)
    .sort((a, b) => Math.hypot(a.snake[0].x - botHead.x, a.snake[0].y - botHead.y) -
      Math.hypot(b.snake[0].x - botHead.x, b.snake[0].y - botHead.y))[0];
  const intercept = target ? {
    x: target.snake[0].x + VECTOR[target.direction].x * config.lead,
    y: target.snake[0].y + VECTOR[target.direction].y * config.lead,
  } : null;
  const candidates = DIRECTIONS.filter((direction) => direction !== OPPOSITE[bot.direction]).map((direction) => {
    const delta = VECTOR[direction];
    let previous = botHead;
    let endpoint = botHead;
    let safe = true;
    for (let step = 1; step <= config.lookAhead * 2; step += 1) {
      endpoint = { x: botHead.x + delta.x * step / 2, y: botHead.y + delta.y * step / 2 };
      if (!inside(endpoint, state.board) ||
        sweptPointHitsSnake(previous, endpoint, bot.snake.slice(1, -1), 0) ||
        rivals.some((rival) => sweptPointHitsSnake(previous, endpoint, rival.snake.slice(1, -1), 0))) {
        safe = false;
        break;
      }
      previous = endpoint;
    }
    if (!safe) return null;
    const foodCost = state.food ? Math.hypot(endpoint.x - state.food.x, endpoint.y - state.food.y) : 0;
    const interceptCost = intercept ? Math.hypot(endpoint.x - intercept.x, endpoint.y - intercept.y) : Number.POSITIVE_INFINITY;
    const edgeDistance = Math.min(endpoint.x, endpoint.y, state.board.columns - 1 - endpoint.x, state.board.rows - 1 - endpoint.y);
    const freedom = DIRECTIONS.filter((exit) => {
      const next = { x: endpoint.x + VECTOR[exit].x, y: endpoint.y + VECTOR[exit].y };
      return inside(next, state.board) && !sweptPointHitsSnake(endpoint, next, bot.snake.slice(1, -1), 0) &&
        !rivals.some((rival) => sweptPointHitsSnake(endpoint, next, rival.snake.slice(1, -1), 0));
    }).length;
    const rivalRisk = rivals.reduce((risk, rival) => {
      const head = { x: rival.snake[0].x + VECTOR[rival.direction].x * config.lead, y: rival.snake[0].y + VECTOR[rival.direction].y * config.lead };
      const distance = Math.hypot(endpoint.x - head.x, endpoint.y - head.y);
      return Math.max(risk, distance < 2.5 ? (2.5 - distance) * 1.5 : 0);
    }, 0);
    const noise = (random() * 2 - 1) * config.noise;
    const foodWeight = intercept ? 0.38 : 1;
    const score = foodCost * foodWeight + (intercept ? interceptCost * 0.72 : 0) +
      rivalRisk - Math.min(edgeDistance, 5) * 0.16 - freedom * 0.55 + noise;
    return { direction, score };
  }).filter((candidate): candidate is { direction: Direction; score: number } => candidate !== null);
  candidates.sort((a, b) => a.score - b.score || DIRECTIONS.indexOf(a.direction) - DIRECTIONS.indexOf(b.direction));
  return candidates[0]?.direction ?? DIRECTIONS.find((direction) => direction !== OPPOSITE[bot.direction]) ?? null;
}

function chooseBotBoost(state: AIBattleState, bot: BattleSnake, direction: Direction): boolean {
  const config = DIFFICULTY[state.difficulty];
  const vector = VECTOR[direction];
  const next = { x: bot.snake[0].x + vector.x * 2, y: bot.snake[0].y + vector.y * 2 };
  const threat = state.players.some((rival) => rival.id !== bot.id && rival.alive &&
    (sweptPointHitsSnake(bot.snake[0], next, rival.snake.slice(1, -1), 0) ||
      Math.hypot(rival.snake[0].x - bot.snake[0].x, rival.snake[0].y - bot.snake[0].y) < config.lead + 2));
  const canEscape = inside(next, state.board) &&
    !sweptPointHitsSnake(bot.snake[0], next, bot.snake.slice(1, -1), 0);
  const largerRival = state.players.some((rival) => rival.id !== bot.id && rival.alive &&
    rival.snake.length >= bot.snake.length + config.advantage &&
    Math.hypot(rival.snake[0].x - bot.snake[0].x, rival.snake[0].y - bot.snake[0].y) < config.lead + 3);
  const attackOpportunity = state.players.some((rival) => rival.id !== bot.id && rival.alive &&
    bot.snake.length >= rival.snake.length + config.advantage &&
    Math.hypot(rival.snake[0].x - next.x, rival.snake[0].y - next.y) < config.lead + 5);
  return canEscape && ((threat && largerRival) || attackOpportunity);
}

export function advanceAIBattle(
  state: AIBattleState,
  random = Math.random,
  boosting = false,
  deltaMs = 190,
): AIBattleState {
  if (state.status !== "playing") return state;
  const speedMs = Math.max(115, 190 - Math.max(...state.players.map((player) => player.score)) * 1.2);
  const moves = state.players.map((player) => {
    const decisionProgress = player.bot ? player.decisionProgress + Math.max(0, deltaMs) / speedMs : player.decisionProgress;
    const shouldDecide = player.bot && decisionProgress >= 1;
    const direction = player.bot
      ? shouldDecide ? chooseBotDirection(state, player.id, random) ?? player.direction : player.direction
      : player.nextDirection ?? player.direction;
    const botBoosting = player.bot && chooseBotBoost(state, player, direction);
    const activeBoost = player.bot ? botBoosting : boosting;
    const nextBoostLevel = advanceBoostLevel(player.boostLevel, activeBoost, deltaMs);
    const movementBoost = speedMultiplier((player.boostLevel + nextBoostLevel) / 2);
    const delta = VECTOR[direction];
    const distance = Math.max(0, deltaMs) / speedMs * movementBoost;
    const previousHead = player.snake[0];
    const head = { x: previousHead.x + delta.x * distance, y: previousHead.y + delta.y * distance };
    const collectsFood = player.alive && state.food !== null && sweptPointHitsPoint(previousHead, head, state.food);
    const growth = collectsFood ? addFoodGrowth(player.growthProgress, activeBoost) : { grow: false, progress: player.growthProgress };
    return {
      player, direction, delta, distance, previousHead, head, collectsFood,
      grows: collectsFood && growth.grow, growthProgress: growth.progress, boostLevel: nextBoostLevel,
      decisionProgress: shouldDecide ? decisionProgress - Math.floor(decisionProgress) : decisionProgress,
      boosting: activeBoost,
    };
  });
  const dead = new Set<string>();
  for (const move of moves) {
    if (!move.player.alive) continue;
    const ownBody = move.grows ? move.player.snake : move.player.snake.slice(0, -1);
    if (!inside(move.head, state.board) || sweptPointHitsSnake(move.previousHead, move.head, ownBody, 1)) dead.add(move.player.id);
    for (const other of moves) {
      if (other.player.id === move.player.id || !other.player.alive) continue;
      const body = other.grows ? other.player.snake : other.player.snake.slice(0, -1);
      if (sweptPointHitsSnake(move.previousHead, move.head, body, 1)) dead.add(move.player.id);
      if (Math.hypot(move.head.x - other.head.x, move.head.y - other.head.y) < 0.9) {
        dead.add(move.player.id);
        dead.add(other.player.id);
      }
    }
  }
  const players = moves.map((move) => {
    const { player, direction, delta, distance, grows, collectsFood, growthProgress, boostLevel, decisionProgress, boosting: activeBoost } = move;
    if (!player.alive || dead.has(player.id)) return { ...player, alive: false, nextDirection: null };
    const snake = moveSnake(player.snake, delta, distance, player.snake.length + (grows ? 1 : 0));
    return {
      ...player,
      snake,
      direction,
      nextDirection: null,
      score: player.score + Number(collectsFood),
      growthProgress: collectsFood ? growthProgress : player.growthProgress,
      boostLevel,
      decisionProgress,
      boosting: activeBoost,
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
