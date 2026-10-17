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
    expect(first.players.every((player) => player.alive && player.snake.length === 3)).toBe(true);
    expect(first.board).toEqual(board);
  });

  it("prevents human reverse turns and makes bots pursue food and predicted routes", () => {
    const initial = createAIBattleState("expert", fixedRandom, { columns: 20, rows: 12 }, 1);
    const human = { ...initial.players[0], snake: [{ x: 14, y: 4 }, { x: 13, y: 4 }, { x: 12, y: 4 }], direction: "right" as const };
    const bot = { ...initial.players[1], snake: [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], direction: "right" as const };
    const state: AIBattleState = { ...initial, players: [human, bot], food: { x: 0, y: 0 } };

    expect(setAIBattleDirection(state, "left")).toBe(state);
    expect(chooseBotDirection(state, bot.id, fixedRandom)).toBe("up");
    expect(setAIBattleDirection(state, "up").players[0].nextDirection).toBe("up");
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
