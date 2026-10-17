import { describe, expect, it } from "vitest";
import {
  advanceGame,
  BOARD_COLUMNS,
  BOARD_ROWS,
  CELEBRATION_DURATION_MS,
  createGameState,
  directionFromSwipe,
  getStepMs,
  setDirection,
  pauseGame,
  restartGame,
  resumeGame,
  startGame,
  type GameState,
} from "../apps/Snake/engine";

const constantRandom = () => 0;
const stateWithFood = (score: number, foodScore = score + 1): GameState => {
  const base = createGameState(constantRandom);
  const snake = [{ x: 8, y: 7 }, { x: 8, y: 8 }, { x: 8, y: 9 }];
  return {
    ...base,
    snake,
    direction: "up",
    food: { x: 8, y: 6 },
    score,
    nextSpecialScore: foodScore,
    status: "playing",
  };
};

describe("Snake game engine", () => {
  it("spawns food on a free in-bounds grid cell", () => {
    const game = createGameState(constantRandom);
    expect(game.food).toEqual({ x: 0, y: 0 });
    expect(game.snake).not.toContainEqual(game.food);
    expect(game.food!.x).toBeGreaterThanOrEqual(0);
    expect(game.food!.x).toBeLessThan(BOARD_COLUMNS);
    expect(game.food!.y).toBeGreaterThanOrEqual(0);
    expect(game.food!.y).toBeLessThan(BOARD_ROWS);
  });

  it("uses the expanded configurable 120 by 80 world and checks collisions against that world", () => {
    const game = createGameState(constantRandom);
    expect(game.board).toEqual({ columns: 120, rows: 80 });
    const smaller = createGameState(constantRandom, { columns: 12, rows: 8 });
    expect(smaller.board).toEqual({ columns: 12, rows: 8 });
    expect(smaller.snake[0]).toEqual({ x: 6, y: 4 });
    expect(smaller.food!.x).toBeLessThan(12);
    expect(smaller.food!.y).toBeLessThan(8);
    expect(advanceGame({
      ...smaller,
      snake: [{ x: 11, y: 4 }, { x: 10, y: 4 }],
      direction: "right",
      status: "playing",
      food: { x: 0, y: 0 },
    }, constantRandom).status).toBe("gameover");
  });

  it("grows, increments the cupcake score, and gradually increases speed", () => {
    const next = advanceGame(stateWithFood(0), constantRandom);
    expect(next.snake).toHaveLength(4);
    expect(next.score).toBe(1);
    expect(getStepMs(next.score)).toBeLessThan(getStepMs(0));
    expect(getStepMs(1000)).toBe(110);
  });

  it("spawns a special cupcake at each 25-cupcake milestone", () => {
    const at25 = advanceGame(stateWithFood(24, 25), constantRandom);
    expect(at25.score).toBe(25);
    expect(at25.specialFood).not.toBeNull();
    expect(at25.specialFood).not.toEqual(at25.food);
    expect(at25.nextSpecialScore).toBe(50);

    const at50 = advanceGame(stateWithFood(49, 50), constantRandom);
    expect(at50.score).toBe(50);
    expect(at50.specialFood).not.toBeNull();
    expect(at50.nextSpecialScore).toBe(75);
  });

  it("pauses into a celebration when the special cupcake is collected", () => {
    const state = {
      ...stateWithFood(25, 50),
      food: { x: 0, y: 0 },
      specialFood: { x: 8, y: 6 },
    };
    const next = advanceGame(state, constantRandom);
    expect(next.status).toBe("celebrating");
    expect(next.score).toBe(26);
    expect(next.snake).toHaveLength(4);
    expect(advanceGame(next, constantRandom)).toBe(next);
  });

  it("wins at 67 cupcakes and stops advancing", () => {
    const won = advanceGame(stateWithFood(66, 75), constantRandom);
    expect(won.score).toBe(67);
    expect(won.status).toBe("won");
    expect(advanceGame(won, constantRandom)).toBe(won);
  });

  it("ends on wall and body collisions", () => {
    const wallCollision = {
      ...stateWithFood(0),
      snake: [{ x: 8, y: 0 }, { x: 8, y: 1 }],
      food: { x: 0, y: 0 },
    };
    expect(advanceGame(wallCollision, constantRandom).status).toBe("gameover");

    const bodyCollision = {
      ...stateWithFood(0),
      snake: [{ x: 8, y: 7 }, { x: 8, y: 6 }, { x: 9, y: 6 }, { x: 9, y: 7 }],
      direction: "up" as const,
      food: { x: 0, y: 0 },
    };
    expect(advanceGame(bodyCollision, constantRandom).status).toBe("gameover");
  });

  it("rejects reverse turns and derives touch swipes consistently", () => {
    const initial = createGameState(constantRandom);
    expect(setDirection(initial, "down")).toBe(initial);
    expect(setDirection(initial, "left").nextDirection).toBe("left");
    expect(setDirection(setDirection(initial, "right"), "down").nextDirection).toBe("right");
    expect(directionFromSwipe({ x: 0, y: 0 }, { x: 40, y: 8 })).toBe("right");
    expect(directionFromSwipe({ x: 0, y: 0 }, { x: -40, y: 8 })).toBe("left");
    expect(directionFromSwipe({ x: 0, y: 0 }, { x: 5, y: 45 })).toBe("down");
    expect(directionFromSwipe({ x: 0, y: 0 }, { x: 0, y: 5 })).toBeNull();
  });

  it("handles start, pause, resume, and restart as isolated states", () => {
    const started = startGame(createGameState(constantRandom));
    expect(started.status).toBe("playing");
    expect(startGame(started)).toBe(started);
    const paused = pauseGame(started);
    expect(paused.status).toBe("paused");
    expect(resumeGame(paused).status).toBe("playing");
    expect(CELEBRATION_DURATION_MS).toBe(3000);
    expect(restartGame(constantRandom)).toMatchObject({ score: 0, status: "ready", specialFood: null });
  });
});
