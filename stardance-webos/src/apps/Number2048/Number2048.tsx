import { useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { RotateCcw } from "lucide-react";
import type { AppProps } from "../../types";
import "./Number2048.css";

const SIZE = 4;
type Direction = "left" | "right" | "up" | "down";
type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addTile(board: Board): Board {
  const next = board.map((row) => [...row]);
  const empty: [number, number][] = [];
  next.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === 0) empty.push([rowIndex, columnIndex]);
  }));
  if (empty.length === 0) return next;
  const [row, column] = empty[Math.floor(Math.random() * empty.length)];
  next[row][column] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function newBoard(): Board {
  return addTile(addTile(emptyBoard()));
}

function slideLine(line: number[]): { values: number[]; gained: number } {
  const compact = line.filter((value) => value !== 0);
  const values: number[] = [];
  let gained = 0;
  for (let index = 0; index < compact.length; index++) {
    if (compact[index] === compact[index + 1]) {
      const merged = compact[index] * 2;
      values.push(merged);
      gained += merged;
      index++;
    } else {
      values.push(compact[index]);
    }
  }
  while (values.length < SIZE) values.push(0);
  return { values, gained };
}

function moveBoard(board: Board, direction: Direction): { board: Board; gained: number; changed: boolean } {
  const next = board.map((row) => [...row]);
  let gained = 0;
  for (let line = 0; line < SIZE; line++) {
    const positions = Array.from({ length: SIZE }, (_, step) => {
      if (direction === "left") return [line, step] as const;
      if (direction === "right") return [line, SIZE - 1 - step] as const;
      if (direction === "up") return [step, line] as const;
      return [SIZE - 1 - step, line] as const;
    });
    const current = positions.map(([row, column]) => board[row][column]);
    const result = slideLine(current);
    gained += result.gained;
    positions.forEach(([row, column], index) => { next[row][column] = result.values[index]; });
  }
  const changed = next.some((row, rowIndex) => row.some((value, columnIndex) => value !== board[rowIndex][columnIndex]));
  return { board: changed ? addTile(next) : board, gained, changed };
}

function hasMoves(board: Board): boolean {
  return board.some((row, rowIndex) => row.some((value, columnIndex) => {
    if (value === 0) return true;
    return row[columnIndex + 1] === value || board[rowIndex + 1]?.[columnIndex] === value;
  }));
}

function readBest(): number {
  try {
    const saved = Number(localStorage.getItem("orbit-2048-best"));
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
  } catch {
    return 0;
  }
}

export function Number2048(_props: AppProps) {
  const [board, setBoard] = useState<Board>(newBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [won, setWon] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const over = !hasMoves(board);

  function move(direction: Direction) {
    if (over) return;
    const result = moveBoard(board, direction);
    if (!result.changed) return;
    setBoard(result.board);
    const nextScore = score + result.gained;
    setScore(nextScore);
    if (!won && result.board.some((row) => row.includes(2048))) setWon(true);
    if (nextScore > best) {
      setBest(nextScore);
      try { localStorage.setItem("orbit-2048-best", String(nextScore)); } catch { /* Storage is optional. */ }
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const directions: Record<string, Direction> = {
      ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right",
      ArrowUp: "up", w: "up", ArrowDown: "down", s: "down",
    };
    const direction = directions[event.key] ?? directions[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }

  function restart() {
    setBoard(newBoard());
    setScore(0);
    setWon(false);
  }

  return (
    <main className="game-2048">
      <header className="game-2048__header">
        <div>
          <span className="game-2048__eyebrow">ORBIT ARCADE</span>
          <h2>2048</h2>
        </div>
        <div className="game-2048__scores" aria-live="polite">
          <div><span>Score</span><strong>{score.toLocaleString()}</strong></div>
          <div><span>Best</span><strong>{best.toLocaleString()}</strong></div>
        </div>
      </header>

      <div className="game-2048__toolbar">
        <p>Join matching numbers. Reach <strong>2048</strong>.</p>
        <button type="button" onClick={restart} title="New game" aria-label="New game"><RotateCcw size={16} /></button>
      </div>

      <div
        className="game-2048__board"
        role="grid"
        aria-label="2048 game board. Use arrow keys or swipe to move tiles."
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {board.flatMap((row, rowIndex) => row.map((value, columnIndex) => (
          <div className="game-2048__tile" data-value={value || 0} role="gridcell" aria-label={value ? String(value) : "empty"} key={`${rowIndex}-${columnIndex}`}>
            {value || ""}
          </div>
        )))}
        {over && (
          <div className="game-2048__overlay">
            <strong>Board full</strong>
            <span>No more moves. Give it another run.</span>
            <button type="button" onClick={restart}>New game</button>
          </div>
        )}
      </div>

      <div className="game-2048__status" aria-live="polite">
        {won ? <span>You made 2048. Keep going for a higher tile.</span> : <span>Arrow keys or WASD · Swipe on touchscreens</span>}
      </div>
    </main>
  );
}