import type { Difficulty } from "./localEngines";

export interface SnakePreferences {
  difficulty: Difficulty;
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

export function readSnakePreferences(): SnakePreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return { difficulty: "normal", sound: true, effects: true };
    const values = saved as Partial<SnakePreferences>;
    return {
      difficulty: values.difficulty === "easy" || values.difficulty === "hard" ? values.difficulty : "normal",
      sound: values.sound !== false,
      effects: values.effects !== false,
    };
  } catch {
    return { difficulty: "normal", sound: true, effects: true };
  }
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
