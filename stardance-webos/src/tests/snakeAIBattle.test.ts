import { describe, expect, it } from "vitest";
import { advanceAIBattle, chooseBotDirection, createAIBattleState, setAIBattleDirection, type AIBattleState } from "../apps/Snake/aiBattle";
import { DEFAULT_BOARD, VIEWPORT_COLUMNS, VIEWPORT_ROWS } from "../apps/Snake/engine";
import { ARENA_PRESETS, boardForArena, normalizeSnakePreferences } from "../apps/Snake/snakePreferences";
import { calculateSnakeViewport } from "../apps/Snake/useSnakeViewport";

const fixedRandom = () => 0.5;

describe("Snake AI Battle", () => {
  it("creates a deterministic human-versus-bots match on the selected arena", () => {
    const board = { columns: 80, rows: 60 };
    const first = createAIBattleState("normal", fixedRandom, board);
    const second = createAIBattleState("normal", fixedRandom, board);

    expect(first).toEqual(second);
    expect(first.players).toHaveLength(5);
    expect(first.players.filter((player) => player.bot)).toHaveLength(4);
    expect(first.players.every((player) => player.alive && player.snake.length === 5)).toBe(true);
    expect(first.board).toEqual(board);
    const compact = createAIBattleState("normal", fixedRandom, { columns: 20, rows: 12 }, 1);
    expect(compact.players.every((player) =>
      player.snake.every((point) => point.x >= 0 && point.x < compact.board.columns && point.y >= 0 && point.y < compact.board.rows),
    )).toBe(true);
  });

  it("prevents human reverse turns and safely pursues nearby food", () => {
    const initial = createAIBattleState("expert", fixedRandom, { columns: 20, rows: 12 }, 1);
    const human = { ...initial.players[0], snake: [{ x: 14, y: 4 }, { x: 13, y: 4 }, { x: 12, y: 4 }], direction: "right" as const };
    const bot = { ...initial.players[1], snake: [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], direction: "right" as const };
    const state: AIBattleState = { ...initial, players: [human, bot], food: { x: 8, y: 4 } };

    expect(setAIBattleDirection(state, "left")).toBe(state);
    expect(chooseBotDirection(state, bot.id, fixedRandom)).toBe("right");
    expect(setAIBattleDirection(state, "up").players[0].nextDirection).toBe("up");
  });

  it("uses predicted intercepts against smaller rivals without sacrificing basic safety", () => {
    const initial = createAIBattleState("expert", fixedRandom, { columns: 30, rows: 40 }, 1);
    const bot = {
      ...initial.players[1],
      snake: Array.from({ length: 9 }, (_, index) => ({ x: 8 - index, y: 16 })),
      direction: "right" as const,
    };
    const smallerRival = {
      ...initial.players[0],
      snake: Array.from({ length: 5 }, (_, index) => ({ x: 20, y: 23 + index })),
      direction: "up" as const,
    };
    const interceptState: AIBattleState = { ...initial, players: [smallerRival, bot], food: { x: 1, y: 1 } };
    expect(chooseBotDirection(interceptState, bot.id, fixedRandom)).toBe("right");

    const dangerous = {
      ...initial.players[0],
      snake: Array.from({ length: 12 }, (_, index) => ({ x: 8 - index, y: 8 })),
      direction: "left" as const,
    };
    const retreatState: AIBattleState = {
      ...initial,
      players: [dangerous, { ...bot, snake: [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }] }],
      food: { x: 20, y: 15 },
    };
    expect(chooseBotDirection(retreatState, bot.id, fixedRandom)).not.toBe("right");
  });

  it("scores boosted food normally but requires two pickups for one segment", () => {
    const initial = createAIBattleState("easy", fixedRandom, { columns: 20, rows: 12 }, 1);
    const human = { ...initial.players[0], snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], direction: "right" as const };
    const state: AIBattleState = {
      ...initial,
      status: "playing",
      food: { x: 6, y: 5 },
      players: [human, initial.players[1]],
    };
    const first = advanceAIBattle(state, fixedRandom, true);
    expect(first.players[0]).toMatchObject({ score: 1, growthProgress: 0.5 });
    expect(first.players[0].snake).toHaveLength(3);

    const second = advanceAIBattle({ ...first, food: { x: 7, y: 5 } }, fixedRandom, true);
    expect(second.players[0]).toMatchObject({ score: 2, growthProgress: 0 });
    expect(second.players[0].snake).toHaveLength(4);
  });

  it("ends on a wall collision and awards the surviving bot", () => {
    const initial = createAIBattleState("normal", fixedRandom, { columns: 20, rows: 12 }, 1);
    const human = { ...initial.players[0], snake: [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }], direction: "right" as const };
    const state: AIBattleState = { ...initial, status: "playing", food: { x: 0, y: 0 }, players: [human, initial.players[1]] };
    const next = advanceAIBattle(state, fixedRandom);

    expect(next.status).toBe("gameover");
    expect(next.players[0].alive).toBe(false);
    expect(next.players[1].alive).toBe(true);
    expect(next.winner).toBe("bot-1");
  });

  it("persists safe arena defaults while keeping the world larger than the fixed camera viewport", () => {
    expect(DEFAULT_BOARD).toEqual({ columns: 120, rows: 80 });
    expect(boardForArena("colossal")).toEqual({ columns: 160, rows: 100 });
    expect(ARENA_PRESETS.wide.board.columns).toBeGreaterThan(VIEWPORT_COLUMNS);
    expect(ARENA_PRESETS.wide.board.rows).toBeGreaterThan(VIEWPORT_ROWS);
    expect(normalizeSnakePreferences({ difficulty: "hard", sound: false })).toMatchObject({
      difficulty: "hard",
      aiDifficulty: "normal",
      arenaSize: "vast",
      sound: false,
      effects: true,
    });
    expect(normalizeSnakePreferences({ arenaSize: "invalid", aiDifficulty: "impossible" })).toMatchObject({
      arenaSize: "vast",
      aiDifficulty: "normal",
    });
  });

  it("fits a readable square-cell camera to portrait and landscape game stages", () => {
    expect(calculateSnakeViewport(360, 540)).toEqual({ columns: 16, rows: 24, width: 360, height: 540 });
    expect(calculateSnakeViewport(900, 500)).toEqual({ columns: 24, rows: 16, width: 750, height: 500 });
    expect(calculateSnakeViewport(0, 0)).toMatchObject({ columns: 24, rows: 16, width: 0, height: 0 });
  });
});
