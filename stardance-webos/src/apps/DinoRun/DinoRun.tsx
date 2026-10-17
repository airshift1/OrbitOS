import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Play, RotateCcw } from "lucide-react";
import type { AppProps } from "../../types";
import "./DinoRun.css";

type GameMode = "ready" | "running" | "over";
type ObstacleKind = "cactus" | "rock" | "bird";

interface Obstacle {
  kind: ObstacleKind;
  x: number;
  width: number;
  height: number;
  bottomOffset: number;
}

interface GameState {
  best: number;
  distance: number;
  jumpHeight: number;
  velocity: number;
  speed: number;
  spawnIn: number;
  ducking: boolean;
  obstacles: Obstacle[];
}

const CROUCH_SCORE = 2000;

function readBestScore(): number {
  try {
    const score = Number(localStorage.getItem("orbit-dino-best"));
    return Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
  } catch {
    return 0;
  }
}

function createGame(best: number): GameState {
  return {
    best,
    distance: 0,
    jumpHeight: 0,
    velocity: 0,
    speed: 300,
    spawnIn: 1.15,
    ducking: false,
    obstacles: [],
  };
}

function drawDinosaur(ctx: CanvasRenderingContext2D, x: number, ground: number, jump: number, step: number, crouching: boolean, color: string, eyeColor: string) {
  const y = ground - (crouching ? 20 : 34) - jump;
  const run = Math.sin(step) * 3;
  ctx.fillStyle = color;

  if (crouching) {
    ctx.fillRect(x + 5, y + 6, 29, 12);
    ctx.fillRect(x + 25, y, 13, 11);
    ctx.fillRect(x + 36, y + 4, 8, 4);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(x + 34, y + 2, 3, 3);
    ctx.fillStyle = color;
    ctx.fillRect(x + 9, y + 17, 7, 4);
    ctx.fillRect(x + 25, y + 17, 7, 4);
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 10);
    ctx.lineTo(x - 2, y + 6);
    ctx.lineTo(x + 7, y + 14);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + 7, y + 13);
  ctx.lineTo(x, y + 9);
  ctx.lineTo(x + 9, y + 18);
  ctx.lineTo(x + 12, y + 18);
  ctx.fill();

  ctx.fillRect(x + 8, y + 12, 21, 15);
  ctx.fillRect(x + 22, y + 2, 13, 14);
  ctx.fillRect(x + 27, y - 2, 13, 10);
  ctx.fillRect(x + 38, y + 3, 8, 5);

  ctx.beginPath();
  ctx.moveTo(x + 24, y + 2);
  ctx.lineTo(x + 28, y - 6);
  ctx.lineTo(x + 32, y + 2);
  ctx.fill();

  ctx.fillStyle = eyeColor;
  ctx.fillRect(x + 35, y + 1, 3, 3);
  ctx.fillStyle = color;
  ctx.fillRect(x + 11, y + 26, 6, Math.max(4, 9 + run));
  ctx.fillRect(x + 22, y + 26, 6, Math.max(4, 9 - run));
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, ground: number, colors: { cactus: string; rock: string; bird: string }, time: number) {
  const top = ground - obstacle.bottomOffset - obstacle.height;
  ctx.fillStyle = obstacle.kind === "bird" ? colors.bird : obstacle.kind === "rock" ? colors.rock : colors.cactus;

  if (obstacle.kind === "bird") {
    const wing = Math.sin(time / 65 + obstacle.x / 20) * 5;
    ctx.fillRect(obstacle.x + 5, top + 6, obstacle.width - 10, 8);
    ctx.fillRect(obstacle.x + obstacle.width - 9, top + 8, 7, 4);
    ctx.beginPath();
    ctx.moveTo(obstacle.x + 10, top + 7);
    ctx.lineTo(obstacle.x + 17, top + wing);
    ctx.lineTo(obstacle.x + 23, top + 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(obstacle.x + 11, top + 12);
    ctx.lineTo(obstacle.x + 18, top + 18 - wing);
    ctx.lineTo(obstacle.x + 24, top + 12);
    ctx.fill();
    return;
  }

  if (obstacle.kind === "rock") {
    ctx.beginPath();
    ctx.moveTo(obstacle.x, ground);
    ctx.lineTo(obstacle.x + 3, top + 8);
    ctx.lineTo(obstacle.x + obstacle.width * 0.42, top);
    ctx.lineTo(obstacle.x + obstacle.width - 2, top + 9);
    ctx.lineTo(obstacle.x + obstacle.width, ground);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(obstacle.x + 6, top + 10, 4, 2);
    ctx.globalAlpha = 1;
    return;
  }

  const cactusWidth = obstacle.width > 30 ? obstacle.width * 0.48 : obstacle.width;
  const count = obstacle.width > 30 ? 2 : 1;
  for (let index = 0; index < count; index++) {
    const x = obstacle.x + index * (cactusWidth + 3);
    const cactusTop = ground - obstacle.height;
    ctx.fillRect(x + cactusWidth * 0.34, cactusTop, cactusWidth * 0.32, obstacle.height);
    ctx.fillRect(x, cactusTop + obstacle.height * 0.42, cactusWidth * 0.42, 5);
    ctx.fillRect(x, cactusTop + obstacle.height * 0.28, 5, obstacle.height * 0.18);
    ctx.fillRect(x + cactusWidth * 0.58, cactusTop + obstacle.height * 0.58, cactusWidth * 0.42, 5);
    ctx.fillRect(x + cactusWidth - 5, cactusTop + obstacle.height * 0.43, 5, obstacle.height * 0.18);
  }
}

function drawScenery(ctx: CanvasRenderingContext2D, width: number, height: number, ground: number, game: GameState, colors: { background: string; surface: string; cloud: string; ground: string; accent: string; accentSoft: string }) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, colors.surface);
  sky.addColorStop(1, colors.background);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const score = Math.floor(game.distance / 10);
  const dusk = Math.min(0.22, score / 9000);
  ctx.globalAlpha = 0.12 + dusk;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(width * 0.78, Math.max(34, height * 0.28), 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (let layer = 0; layer < 2; layer++) {
    const step = layer === 0 ? 160 : 230;
    const scroll = (game.distance * (layer === 0 ? 0.12 : 0.055)) % step;
    const base = ground - (layer === 0 ? 8 : 25);
    ctx.globalAlpha = layer === 0 ? 0.07 : 0.12;
    ctx.fillStyle = layer === 0 ? colors.cloud : colors.accent;
    ctx.beginPath();
    ctx.moveTo(-step, ground);
    for (let x = -step - scroll; x < width + step; x += step) {
      ctx.quadraticCurveTo(x + step * 0.5, base - (layer === 0 ? 26 : 42), x + step, base);
    }
    ctx.lineTo(width + step, ground);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.cloud;
  ctx.globalAlpha = 0.2;
  for (let cloud = 0; cloud < 4; cloud++) {
    const span = width + 110;
    const cloudX = ((cloud * 193 - game.distance * 0.12) % span + span) % span;
    const cloudY = 24 + (cloud % 2) * 29;
    const x = cloudX - 45;
    ctx.fillRect(x, cloudY, 34, 3);
    ctx.fillRect(x + 8, cloudY - 4, 15, 4);
  }
  ctx.globalAlpha = 1;

  if (score > 3000) {
    ctx.fillStyle = colors.cloud;
    ctx.globalAlpha = Math.min(0.55, (score - 3000) / 7000);
    for (let star = 0; star < 18; star++) {
      const x = (star * 97 + width - (game.distance * 0.025) % width) % width;
      const y = 12 + ((star * 41) % Math.max(20, ground - 60));
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = colors.ground;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ground + 0.5);
  ctx.lineTo(width, ground + 0.5);
  ctx.stroke();

  ctx.fillStyle = colors.accentSoft;
  const dashOffset = game.distance % 46;
  for (let x = -dashOffset; x < width; x += 46) {
    ctx.fillRect(x, ground + 10, 16, 2);
  }
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = colors.ground;
  for (let pebble = 0; pebble < 9; pebble++) {
    const span = width + 25;
    const x = ((pebble * 127 - game.distance * 0.45) % span + span) % span;
    ctx.fillRect(x, ground + 19 + (pebble % 3) * 3, 3, 2);
  }
  ctx.globalAlpha = 1;
}

export function DinoRun(_props: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<GameMode>("ready");
  const gameRef = useRef<GameState>(createGame(0));
  const [mode, setMode] = useState<GameMode>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBestScore);

  function changeMode(next: GameMode) {
    modeRef.current = next;
    setMode(next);
  }

  function startRun() {
    gameRef.current = createGame(best);
    changeMode("running");
    setScore(0);
    canvasRef.current?.focus();
  }

  function jump() {
    if (modeRef.current !== "running" || gameRef.current.jumpHeight > 0) return;
    gameRef.current.velocity = 610;
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "Control") {
      if (score >= CROUCH_SCORE && modeRef.current === "running") {
        event.preventDefault();
        gameRef.current.ducking = true;
      }
      return;
    }
    if (event.key !== " " && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (modeRef.current === "running") jump();
    else startRun();
  }

  function handleKeyUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "Control") {
      gameRef.current.ducking = false;
    }
  }

  function startCrouch() {
    if (score >= CROUCH_SCORE && modeRef.current === "running") gameRef.current.ducking = true;
  }

  function stopCrouch() {
    gameRef.current.ducking = false;
  }

  useEffect(() => {
    gameRef.current.best = best;
  }, [best]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const gameCanvas = canvas;
    const context = ctx;
    const rootStyle = getComputedStyle(document.documentElement);
    const gameStyle = getComputedStyle(gameCanvas);
    const colors = {
      background: rootStyle.getPropertyValue("--color-surface-2").trim(),
      surface: rootStyle.getPropertyValue("--color-surface").trim(),
      cloud: rootStyle.getPropertyValue("--color-text-dim").trim(),
      ground: rootStyle.getPropertyValue("--color-border-strong").trim(),
      accent: rootStyle.getPropertyValue("--color-accent").trim(),
      accentSoft: rootStyle.getPropertyValue("--color-accent-soft").trim(),
      dino: gameStyle.getPropertyValue("--dino-color").trim(),
      eye: gameStyle.getPropertyValue("--dino-eye").trim(),
      cactus: gameStyle.getPropertyValue("--cactus-color").trim(),
      rock: rootStyle.getPropertyValue("--color-warning").trim(),
      bird: rootStyle.getPropertyValue("--color-danger").trim(),
    };

    let frameId = 0;
    let previousTime = 0;
    let lastShownScore = -1;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    function draw(time: number) {
      const rect = gameCanvas.getBoundingClientRect();
      const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
      if (rect.width !== width || rect.height !== height || nextRatio !== pixelRatio) {
        width = rect.width;
        height = rect.height;
        pixelRatio = nextRatio;
        gameCanvas.width = Math.round(width * pixelRatio);
        gameCanvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }

      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      const game = gameRef.current;
      const ground = height - 34;

      if (modeRef.current === "running") {
        game.distance += game.speed * delta;
        const currentScore = Math.floor(game.distance / 10);
        game.speed = Math.min(1200, 320 + currentScore * 0.11);
        game.velocity -= 1650 * delta;
        game.jumpHeight = Math.max(0, game.jumpHeight + game.velocity * delta);
        if (game.jumpHeight === 0) game.velocity = 0;
        if (currentScore < CROUCH_SCORE) game.ducking = false;

        game.spawnIn -= delta;
        if (game.spawnIn <= 0) {
          const roll = Math.random();
          if (currentScore >= CROUCH_SCORE && roll < 0.22) {
            game.obstacles.push({ kind: "bird", x: width + 8, width: 34, height: 18, bottomOffset: 27 });
          } else if (roll < 0.48) {
            game.obstacles.push({ kind: "rock", x: width + 8, width: 24 + Math.random() * 10, height: 17 + Math.random() * 13, bottomOffset: 0 });
          } else {
            game.obstacles.push({ kind: "cactus", x: width + 8, width: roll > 0.82 ? 42 : 22, height: 24 + Math.random() * 24, bottomOffset: 0 });
          }
          const difficulty = Math.min(1, currentScore / 5000);
          game.spawnIn = 1.45 - difficulty * 0.72 + Math.random() * (0.45 - difficulty * 0.15);
        }
        game.obstacles = game.obstacles
          .map((obstacle) => ({ ...obstacle, x: obstacle.x - game.speed * delta }))
          .filter((obstacle) => obstacle.x + obstacle.width > -4);

        const dinoHeight = game.ducking && currentScore >= CROUCH_SCORE ? 18 : 32;
        const dino = { left: 57, right: 88, top: ground - dinoHeight - game.jumpHeight, bottom: ground - game.jumpHeight };
        const hit = game.obstacles.some((obstacle) =>
          dino.right > obstacle.x + 3 &&
          dino.left < obstacle.x + obstacle.width - 2 &&
          dino.bottom > ground - obstacle.bottomOffset - obstacle.height + 2 &&
          dino.top < ground - obstacle.bottomOffset,
        );
        if (currentScore !== lastShownScore) {
          lastShownScore = currentScore;
          setScore(currentScore);
        }
        if (currentScore > game.best) {
          game.best = currentScore;
          setBest(currentScore);
          try {
            localStorage.setItem("orbit-dino-best", String(currentScore));
          } catch {
            // The current run still works when browser storage is unavailable.
          }
        }
        if (hit) changeMode("over");
      }

      context.clearRect(0, 0, width, height);
      drawScenery(context, width, height, ground, game, colors);
      context.save();
      const currentScore = Math.floor(game.distance / 10);
      drawDinosaur(context, 54, ground, game.jumpHeight, time / 70, game.ducking && currentScore >= CROUCH_SCORE, colors.dino, colors.eye);
      for (const obstacle of game.obstacles) drawObstacle(context, obstacle, ground, { cactus: colors.cactus, rock: colors.rock, bird: colors.bird }, time);
      context.restore();

      frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <main className="dino-run">
      <header className="dino-run__header">
        <div>
          <span className="dino-run__eyebrow">ORBIT ARCADE</span>
          <h2>Dino Run</h2>
        </div>
        <div className="dino-run__scores" aria-live="polite">
          <div><span>Score</span><strong>{score.toString().padStart(5, "0")}</strong></div>
          <div><span>Best</span><strong>{best.toString().padStart(5, "0")}</strong></div>
        </div>
      </header>

      <div className="dino-run__stage" onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
        <canvas
          ref={canvasRef}
          className="dino-run__canvas"
          tabIndex={0}
          aria-label="Dino Run game. Press Space or Up Arrow to jump. After 2,000 points, hold Down Arrow to crouch."
          onPointerDown={jump}
        />
        {mode !== "running" && (
          <div className="dino-run__overlay">
            <span className="dino-run__overlay-icon" aria-hidden="true">
              {mode === "over" ? <RotateCcw size={18} /> : <ArrowUp size={20} />}
            </span>
            <strong>{mode === "over" ? "Run ended" : "Ready to run?"}</strong>
            <span>{mode === "over" ? `Score ${score} · Best ${best}` : "Jump over rocks and cacti. Faster hazards arrive as your score grows."}</span>
            <button className="dino-run__start" type="button" onClick={startRun}>
              {mode === "over" ? <RotateCcw size={15} /> : <Play size={15} />}
              {mode === "over" ? "Run again" : "Start run"}
            </button>
          </div>
        )}
      </div>

      <footer className="dino-run__footer">
        <span><kbd>Space</kbd> or <kbd>↑</kbd> to jump</span>
        {score >= CROUCH_SCORE ? (
          <button className="dino-run__duck" type="button" onPointerDown={startCrouch} onPointerUp={stopCrouch} onPointerLeave={stopCrouch} onPointerCancel={stopCrouch} aria-label="Hold to crouch">
            <ArrowDown size={14} /> Hold to crouch
          </button>
        ) : (
          <span>{CROUCH_SCORE - score} points until crouch unlocks</span>
        )}
      </footer>
    </main>
  );
}