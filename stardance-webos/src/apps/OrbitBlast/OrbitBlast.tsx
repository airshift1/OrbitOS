import { useState } from "react";
import type { CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import type { AppProps } from "../../types";
import { Button } from "../../ui";
import "./OrbitBlast.css";

const BOARD_SIZE = 8;
const COLORS = ["#36c8bd", "#f3a64a", "#ef6f83", "#8c78e8", "#71a8ed"];

type Cell = string | null;
type Board = Cell[][];
type Position = { row: number; column: number };

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function newBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, randomColor),
  );
}

function connectedGroup(board: Board, start: Position): Position[] {
  const color = board[start.row][start.column];
  if (!color) return [];

  const group: Position[] = [];
  const pending = [start];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.pop()!;
    const key = `${current.row}:${current.column}`;
    if (visited.has(key) || board[current.row][current.column] !== color) continue;
    visited.add(key);
    group.push(current);

    for (const next of [
      { row: current.row - 1, column: current.column },
      { row: current.row + 1, column: current.column },
      { row: current.row, column: current.column - 1 },
      { row: current.row, column: current.column + 1 },
    ]) {
      if (
        next.row >= 0 && next.row < BOARD_SIZE &&
        next.column >= 0 && next.column < BOARD_SIZE
      ) {
        pending.push(next);
      }
    }
  }

  return group;
}

function dropAndRefill(board: Board): Board {
  const columns = Array.from({ length: BOARD_SIZE }, (_, column) => {
    const remaining = board.map((row) => row[column]).filter((cell): cell is string => cell !== null);
    const missing = BOARD_SIZE - remaining.length;
    return [...Array.from({ length: missing }, randomColor), ...remaining];
  });

  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, column) => columns[column][row]),
  );
}

export function OrbitBlast(_props: AppProps) {
  const [board, setBoard] = useState<Board>(newBoard);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Tap a group of 2 or more matching blocks.");

  function blast(position: Position) {
    const group = connectedGroup(board, position);
    if (group.length < 2) {
      setMessage("That block needs a matching neighbor.");
      return;
    }

    const next = board.map((row) => [...row]);
    for (const cell of group) next[cell.row][cell.column] = null;
    setBoard(dropAndRefill(next));
    setScore((current) => current + group.length * group.length * 10);
    setMessage(`${group.length} blocks cleared.`);
  }

  function restart() {
    setBoard(newBoard());
    setScore(0);
    setMessage("Tap a group of 2 or more matching blocks.");
  }

  return (
    <section className="orbit-blast" aria-label="Orbit Blast game">
      <header className="orbit-blast__header">
        <div>
          <span className="orbit-blast__eyebrow">ORBIT ARCADE</span>
          <h2>Orbit Blast</h2>
          <p>{message}</p>
        </div>
        <div className="orbit-blast__score" aria-live="polite">
          <span>Score</span>
          <strong>{score.toLocaleString()}</strong>
        </div>
      </header>

      <div className="orbit-blast__board" role="group" aria-label="Game board">
        {board.map((row, rowIndex) =>
          row.map((color, columnIndex) => (
            <button
              key={`${rowIndex}:${columnIndex}`}
              type="button"
              className="orbit-blast__cell"
              style={{ "--block-color": color ?? "transparent" } as CSSProperties}
              aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}${color ? ", colored block" : ", empty"}`}
              onClick={() => blast({ row: rowIndex, column: columnIndex })}
            />
          )),
        )}
      </div>

      <footer className="orbit-blast__footer">
        <span>Large groups score more.</span>
        <Button iconOnly title="New game" aria-label="New game" onClick={restart}>
          <RotateCcw size={16} />
        </Button>
      </footer>
    </section>
  );
}