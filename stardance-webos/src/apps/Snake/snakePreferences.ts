import type { BoardSize } from "./engine";
import type { AIDifficulty, Difficulty } from "./localEngines";

export type ArenaSize = "wide" | "vast" | "colossal";

export const ARENA_PRESETS: Record<ArenaSize, { label: string; board: BoardSize }> = {
  wide: { label: "Wide · 80 × 60", board: { columns: 80, rows: 60 } },
  vast: { label: "Vast · 120 × 80", board: { columns: 120, rows: 80 } },
  colossal: { label: "Colossal · 160 × 100", board: { columns: 160, rows: 100 } },
};

export function boardForArena(size: ArenaSize): BoardSize {
  const board = ARENA_PRESETS[size].board;
  return { ...board };
}

export interface SnakePreferences {
  difficulty: Difficulty;
  aiDifficulty: AIDifficulty;
  arenaSize: ArenaSize;
  sound: boolean;
  effects: boolean;
}

export interface HighScoreEntry {
  score: number;
  difficulty: Difficulty;
  date: string;
}

const PREFS_KEY = "orbitos-snake-preferences";
const HIGH_SCORES_KEY = "orbitos-snake-classic-high-scores";
const DEFAULT_PREFERENCES: SnakePreferences = {
  difficulty: "normal",
  aiDifficulty: "normal",
  arenaSize: "vast",
  sound: true,
  effects: true,
};

export function readSnakePreferences(): SnakePreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    return normalizeSnakePreferences(saved);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function normalizeSnakePreferences(saved: unknown): SnakePreferences {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ...DEFAULT_PREFERENCES };
  const values = saved as Partial<SnakePreferences>;
  return {
    difficulty: values.difficulty === "easy" || values.difficulty === "hard" ? values.difficulty : "normal",
    aiDifficulty: values.aiDifficulty === "easy" || values.aiDifficulty === "hard" || values.aiDifficulty === "expert" ? values.aiDifficulty : "normal",
    arenaSize: values.arenaSize === "wide" || values.arenaSize === "colossal" ? values.arenaSize : "vast",
    sound: values.sound !== false,
    effects: values.effects !== false,
  };
}

export function saveSnakePreferences(preferences: SnakePreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  } catch {
    return;
  }
}

export function readClassicHighScores(): HighScoreEntry[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(HIGH_SCORES_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((row): row is HighScoreEntry =>
      Boolean(row) && typeof row === "object" &&
      Number.isInteger(row.score) && row.score >= 0 &&
      (row.difficulty === "easy" || row.difficulty === "normal" || row.difficulty === "hard") &&
      typeof row.date === "string",
    ).slice(0, 5);
  } catch {
    return [];
  }
}

export function recordClassicHighScore(entry: HighScoreEntry): HighScoreEntry[] {
  const rows = [...readClassicHighScores(), entry]
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, 5);
  try {
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(rows));
  } catch {
    return rows;
  }
  return rows;
}
