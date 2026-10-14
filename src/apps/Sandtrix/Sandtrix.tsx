import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type { AppProps } from "../../types";
import "./Sandtrix.css";

const COLUMNS = 12;
const ROWS = 12;
const COLORS = ["#ef7568", "#efb84b", "#64c7b1", "#6fa8e8", "#a887e8"];
type Grid = (string | null)[][];
type Point = { x: number; y: number };

const SHAPES: Point[][] = [
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
];

interface Piece {
  x: number;
  y: number;
  shape: Point[];
  color: string;
}

function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
}

function newPiece(): Piece {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)].map((point) => ({ ...point }));
  const width = Math.max(...shape.map((point) => point.x)) + 1;
  return { x: Math.floor((COLUMNS - width) / 2), y: 0, shape, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
}

function canPlace(grid: Grid, piece: Piece): boolean {
  return piece.shape.every(({ x, y }) => {
    const column = piece.x + x;
    const row = piece.y + y;
    return column >= 0 && column < COLUMNS && row >= 0 && row < ROWS && !grid[row][column];
  });
}

function settleSand(grid: Grid): Grid {
  const next = grid.map((row) => [...row]);
  const offset = Math.floor(Math.random() * COLUMNS);

  for (let row = ROWS - 2; row >= 0; row--) {
    for (let step = 0; step < COLUMNS; step++) {
      const column = (step + offset) % COLUMNS;
      const grain = next[row][column];
      if (!grain) continue;

      if (!next[row + 1][column]) {
        next[row + 1][column] = grain;
        next[row][column] = null;
        continue;
      }

      const diagonals = Math.random() < 0.5 ? [-1, 1] : [1, -1];
      const openDiagonal = diagonals.find((direction) => {
        const nextColumn = column + direction;
        return nextColumn >= 0 && nextColumn < COLUMNS && !next[row + 1][nextColumn];
      });
      if (openDiagonal !== undefined) {
        next[row + 1][column + openDiagonal] = grain;
        next[row][column] = null;
      }
    }
  }

  return next;
}

function rotateShape(shape: Point[]): Point[] {
  const maxY = Math.max(...shape.map((point) => point.y));
  return shape.map(({ x, y }) => ({ x: maxY - y, y: x }));
}

function clearSolidRows(grid: Grid): { grid: Grid; cleared: number } {
  const kept = grid.filter((row) => {
    const first = row[0];
    return !first || row.some((cell) => cell !== first);
  });
  const cleared = ROWS - kept.length;
  return {
    grid: [...Array.from({ length: cleared }, () => Array(COLUMNS).fill(null)), ...kept],
    cleared,
  };
}

export function Sandtrix(_props: AppProps) {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [piece, setPiece] = useState<Piece>(newPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  function lockPiece(current: Piece = piece, baseGrid: Grid = grid) {
    const next = baseGrid.map((row) => [...row]);
    for (const block of current.shape) {
      const row = current.y + block.y;
      const column = current.x + block.x;
      if (row >= 0 && row < ROWS && column >= 0 && column < COLUMNS) next[row][column] = current.color;
    }
    const result = clearSolidRows(settleSand(next));
    const nextPiece = newPiece();
    setGrid(result.grid);
    setPiece(nextPiece);
    if (result.cleared > 0) {
      setLines((value) => value + result.cleared);
      setScore((value) => value + result.cleared * result.cleared * 100);
    }
    if (!canPlace(result.grid, nextPiece)) setOver(true);
  }

  function move(dx: number, dy: number) {
    if (!started || over) return;
    const next = { ...piece, x: piece.x + dx, y: piece.y + dy };
    if (canPlace(grid, next)) setPiece(next);
    else if (dy > 0) lockPiece();
  }

  function rotate() {
    if (!started || over) return;
    const shape = rotateShape(piece.shape);
    for (const offset of [0, -1, 1, -2, 2]) {
      const next = { ...piece, x: piece.x + offset, shape };
      if (canPlace(grid, next)) { setPiece(next); return; }
    }
  }

  function drop() {
    if (!started || over) return;
    let next = { ...piece };
    while (canPlace(grid, { ...next, y: next.y + 1 })) next = { ...next, y: next.y + 1 };
    lockPiece(next);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") { event.preventDefault(); move(-1, 0); }
    else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") { event.preventDefault(); move(1, 0); }
    else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") { event.preventDefault(); move(0, 1); }
    else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") { event.preventDefault(); rotate(); }
    else if (event.code === "Space") { event.preventDefault(); drop(); }
  }

  function restart() {
    const nextGrid = emptyGrid();
    setGrid(nextGrid);
    setPiece(newPiece());
    setScore(0);
    setLines(0);
    setOver(false);
    setStarted(true);
    boardRef.current?.focus();
  }

  const tick = useEffectEvent(() => {
    const settled = settleSand(grid);
    const rows = clearSolidRows(settled);
    if (rows.cleared > 0) {
      setLines((value) => value + rows.cleared);
      setScore((value) => value + rows.cleared * rows.cleared * 100);
    }
    setGrid(rows.cleared > 0 ? rows.grid : settled);
    const next = { ...piece, y: piece.y + 1 };
    if (canPlace(rows.grid, next)) {
      setPiece(next);
    } else {
      lockPiece(piece, rows.grid);
    }
  });

  useEffect(() => {
    if (!started || over) return;
    const interval = Math.max(170, 680 - Math.floor(lines / 4) * 45);
    const timer = window.setInterval(tick, interval);
    return () => window.clearInterval(timer);
  }, [lines, over, started]);

  const active = new Set(piece.shape.map(({ x, y }) => `${piece.y + y}:${piece.x + x}`));

  return (
    <main className="sandtrix">
      <header className="sandtrix__header">
        <div><span className="sandtrix__eyebrow">ORBIT ARCADE</span><h2>Sandtrix</h2></div>
        <div className="sandtrix__stats" aria-live="polite">
          <div><span>Score</span><strong>{score.toLocaleString()}</strong></div>
          <div><span>Lines</span><strong>{lines}</strong></div>
        </div>
      </header>

      <div className="sandtrix__layout">
        <div className="sandtrix__board-wrap">
          <div className="sandtrix__board" role="grid" aria-label="Sandtrix board" tabIndex={0} ref={boardRef} onKeyDown={handleKeyDown}>
            {grid.map((row, rowIndex) => row.map((color, columnIndex) => {
              const isActive = active.has(`${rowIndex}:${columnIndex}`);
              const cellColor = isActive ? piece.color : color;
              return <div key={`${rowIndex}-${columnIndex}`} className="sandtrix__grain" role="gridcell" style={{ "--grain-color": cellColor ?? "transparent" } as React.CSSProperties} />;
            }))}
            {!started && <div className="sandtrix__overlay"><strong>Sandtrix</strong><span>Grains tumble into gaps. Fill a row with one colour to clear it.</span><button type="button" onClick={() => { setStarted(true); boardRef.current?.focus(); }}>Start game</button></div>}
            {over && <div className="sandtrix__overlay"><strong>Game over</strong><span>{score.toLocaleString()} points · {lines} lines</span><button type="button" onClick={restart}>Play again</button></div>}
          </div>
        </div>
        <aside className="sandtrix__side">
          <h3>Controls</h3>
          <span><kbd>←</kbd><kbd>→</kbd> Move</span>
          <span><kbd>↑</kbd> Rotate</span>
          <span><kbd>↓</kbd> Soft drop</span>
          <span><kbd>Space</kbd> Drop</span>
          <div className="sandtrix__buttons">
            <button type="button" onClick={() => move(-1, 0)} aria-label="Move left"><ArrowLeft size={16} /></button>
            <button type="button" onClick={rotate} aria-label="Rotate piece"><RotateCw size={16} /></button>
            <button type="button" onClick={() => move(1, 0)} aria-label="Move right"><ArrowRight size={16} /></button>
            <button type="button" onClick={() => move(0, 1)} aria-label="Drop one row"><ArrowDown size={16} /></button>
          </div>
          <button className="sandtrix__restart" type="button" onClick={restart}>New game</button>
        </aside>
      </div>
    </main>
  );
}