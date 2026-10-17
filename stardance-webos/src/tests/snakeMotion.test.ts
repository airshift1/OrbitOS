import { describe, expect, it } from "vitest";
import { advanceGame, createGameState } from "../apps/Snake/engine";
import { advanceClassic, createClassicState } from "../apps/Snake/localEngines";
import { appendHeadHistory, addFoodGrowth, interpolateSnake } from "../apps/Snake/motion";
import { DIRECTION_ANGLE } from "../apps/Snake/SnakeArt";
import { readUnicornSkin, saveUnicornSkin } from "../apps/Snake/unicornSkins";

describe("Snake rendering and growth helpers", () => {
  it("interpolates around a right-angle turn without cutting diagonally", () => {
    const path = [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }];
    const rendered = interpolateSnake(path, path, 0.5);
    expect(rendered[0]).toEqual({ x: 2, y: 1.5 });
    expect(rendered[1]).toEqual({ x: 1.5, y: 1 });
    expect(appendHeadHistory(path, path[1], path[0], 3)[0]).toEqual(path[0]);
  });

  it("uses a fractional boost accumulator without negative growth", () => {
    expect(addFoodGrowth(0, true)).toEqual({ grow: false, progress: 0.5 });
    expect(addFoodGrowth(0.5, true)).toEqual({ grow: true, progress: 0 });
    expect(addFoodGrowth(0, false)).toEqual({ grow: true, progress: 0 });
  });

  it("orients both snake heads for all four grid directions", () => {
    expect(DIRECTION_ANGLE).toEqual({ up: 0, right: 90, down: 180, left: 270 });
  });

  it("keeps Classic and Unicorn scores per food while boosted growth accrues", () => {
    const unicorn = createGameState(() => 0);
    const unicornReady = { ...unicorn, status: "playing" as const, snake: [{ x: 8, y: 7 }, { x: 8, y: 8 }, { x: 8, y: 9 }], direction: "up" as const, food: { x: 8, y: 6 } };
    const unicornFirst = advanceGame(unicornReady, () => 0, true);
    expect(unicornFirst).toMatchObject({ score: 1, growthProgress: 0.5 });
    expect(unicornFirst.snake).toHaveLength(3);

    const classic = createClassicState("normal", () => 0);
    const classicReady = { ...classic, status: "playing" as const, snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], direction: "right" as const, food: { x: 11, y: 10 } };
    const classicFirst = advanceClassic(classicReady, () => 0, true);
    expect(classicFirst).toMatchObject({ score: 1, growthProgress: 0.5, food: { x: 0, y: 0 } });
    expect(classicFirst.snake).toHaveLength(3);
    const classicSecond = advanceClassic({ ...classicFirst, food: { x: 12, y: 10 } }, () => 0, true);
    expect(classicSecond.score).toBe(2);
    expect(classicSecond.snake).toHaveLength(4);
    expect(classicSecond.growthProgress).toBe(0);
  });

  it("persists and validates the selected unicorn skin", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } satisfies Storage;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    expect(readUnicornSkin()).toBe("lavender");
    saveUnicornSkin("midnight");
    expect(readUnicornSkin()).toBe("midnight");
    storage.setItem("orbitos-snake-unicorn-skin", "unknown");
    expect(readUnicornSkin()).toBe("lavender");
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });
});
