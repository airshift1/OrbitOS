import { describe, expect, it } from "vitest";
import { advanceClassic, advanceVersus, classicStepMs, createClassicState, createVersusState, setClassicDirection, setVersusDirection, type ClassicState, type VersusState } from "../apps/Snake/localEngines";

const fixedRandom = () => 0;

describe("Classic Snake rules", () => {
  it("starts with a three-cell snake and scores/grows only when food is collected", () => {
    const state = createClassicState("normal", fixedRandom, { columns: 10, rows: 8 });
    expect(state.snake).toHaveLength(3);
    const ready = { ...state, status: "playing" as const, food: { x: state.snake[0].x + 1, y: state.snake[0].y } };
    const next = advanceClassic(ready, fixedRandom);
    expect(next.score).toBe(1);
    expect(next.snake).toHaveLength(4);
    expect(next.snake[0]).toEqual(ready.food);
    expect(classicStepMs({ score: 10, difficulty: "hard" })).toBeLessThan(classicStepMs({ score: 0, difficulty: "easy" }));
  });

  it("ends runs on wall and self collisions", () => {
    const base = createClassicState("normal", fixedRandom, { columns: 8, rows: 8 });
    const wall: ClassicState = { ...base, snake: [{ x: 7, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 4 }], direction: "right", food: { x: 0, y: 0 }, status: "playing" };
    expect(advanceClassic(wall, fixedRandom).status).toBe("gameover");
    const self: ClassicState = { ...base, snake: [{ x: 3, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }], direction: "up", food: { x: 0, y: 0 }, status: "playing" };
    expect(advanceClassic(self, fixedRandom).status).toBe("gameover");
  });

  it("rejects instant reversals, including a second queued turn before a tick", () => {
    const state = createClassicState("normal", fixedRandom);
    expect(setClassicDirection(state, "left")).toBe(state);
    const turned = setClassicDirection(state, "up");
    expect(setClassicDirection(turned, "left")).toBe(turned);
  });
});

describe("local two-player VS Snake rules", () => {
  it("grows and scores the player who collects shared food", () => {
    const state = createVersusState(fixedRandom);
    const [one, two] = state.players;
    const playing: VersusState = { ...state, status: "playing", food: { x: one.snake[0].x - 1, y: one.snake[0].y } };
    const next = advanceVersus(playing, fixedRandom);
    expect(next.players[0].score).toBe(1);
    expect(next.players[0].snake).toHaveLength(4);
    expect(next.players[1].score).toBe(0);
    expect(next.players[1].alive).toBe(true);
    expect(two.id).toBe("two");
  });

  it("applies boost growth independently to each VS player without reducing food score", () => {
    const state = createVersusState(fixedRandom);
    const [one, two] = state.players;
    const firstFood = { x: one.snake[0].x - 1, y: one.snake[0].y };
    const first = advanceVersus({ ...state, status: "playing", food: firstFood }, fixedRandom, { one: true });
    expect(first.players[0]).toMatchObject({ score: 1, growthProgress: 0.5 });
    expect(first.players[0].snake).toHaveLength(3);
    const secondFood = { x: one.snake[0].x - 2, y: one.snake[0].y };
    const second = advanceVersus({ ...first, food: secondFood }, fixedRandom, { one: true });
    expect(second.players[0]).toMatchObject({ score: 2, growthProgress: 0 });
    expect(second.players[0].snake).toHaveLength(4);
    expect(second.players[1].snake).toEqual(two.snake.map((point) => ({ x: point.x + 2, y: point.y })));
  });

  it("ends in a draw when both players collide on the same move", () => {
    const state = createVersusState(fixedRandom, { columns: 20, rows: 12 });
    const [one, two] = state.players;
    const playing: VersusState = {
      ...state,
      status: "playing",
      food: { x: 0, y: 0 },
      players: [
        { ...one, snake: [{ x: 8, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 5 }], direction: "right" },
        { ...two, snake: [{ x: 10, y: 5 }, { x: 11, y: 5 }, { x: 12, y: 5 }], direction: "left" },
      ],
    };
    const next = advanceVersus(playing, fixedRandom);
    expect(next.status).toBe("gameover");
    expect(next.winner).toBe("draw");
    expect(next.players.every((player) => !player.alive)).toBe(true);
  });

  it("awards the round to the surviving player after a wall collision", () => {
    const state = createVersusState(fixedRandom, { columns: 20, rows: 12 });
    const [one, two] = state.players;
    const playing: VersusState = {
      ...state,
      status: "playing",
      food: { x: 0, y: 0 },
      players: [
        { ...one, snake: [{ x: 19, y: 3 }, { x: 18, y: 3 }, { x: 17, y: 3 }], direction: "right" },
        { ...two, snake: [{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }], direction: "right" },
      ],
    };
    const next = advanceVersus(playing, fixedRandom);
    expect(next.winner).toBe("two");
    expect(next.players[0].alive).toBe(false);
    expect(next.players[1].alive).toBe(true);
  });

  it("rejects reversal inputs and ignores steering after the round ends", () => {
    const playing: VersusState = { ...createVersusState(fixedRandom), status: "playing" };
    expect(setVersusDirection(playing, "one", "right")).toBe(playing);
    const turned = setVersusDirection(playing, "one", "up");
    expect(turned.players[0].nextDirection).toBe("up");
    expect(setVersusDirection(turned, "one", "left")).toBe(turned);
    expect(setVersusDirection({ ...turned, status: "gameover" }, "one", "down")).toMatchObject({ status: "gameover" });
  });
});
