import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { AppProps } from "../../types";
import { useSystemStore } from "../../stores/useSystemStore";
import { useWindowStore } from "../../stores/useWindowStore";
import { ClassicSnakeHead, Cupcake, UnicornHead } from "./SnakeArt";
import { readUnicornSkin, saveUnicornSkin, UNICORN_SKINS, type UnicornSkin } from "./unicornSkins";
import { SnakeMultiplayer } from "./SnakeMultiplayer";
import { PreferenceControls, SnakeArcadeMenu, SnakeLocalGame, type SnakeMode } from "./SnakeArcade";
import { boardForArena, readSnakePreferences, type SnakePreferences } from "./snakePreferences";
import {
  advanceGame,
  CELEBRATION_DURATION_MS,
  createGameState,
  directionFromSwipe,
  getStepMs,
  pauseGame,
  restartGame,
  resumeGame,
  setDirection,
  startGame,
  VIEWPORT_COLUMNS,
  VIEWPORT_ROWS,
  WINNING_SCORE,
  type Direction,
  type GameState,
  type Point,
} from "./engine";
import "./Snake.css";
import { appendHeadHistory, interpolateSnake } from "./motion";
import { useSnakeAnimation } from "./useSnakeAnimation";
import { useSnakeViewport } from "./useSnakeViewport";

interface Sprinkle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  star: boolean;
}

const SPRINKLE_COLORS = ["#ff76a8", "#56c7e9", "#ffc94f", "#a98bff", "#79d5ad", "#ff9a67"];
const UNICORN_BEST_KEY = "orbitos-snake-unicorn-best";
const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

function pointStyle(point: Point, camera: Point, columns = VIEWPORT_COLUMNS, rows = VIEWPORT_ROWS): CSSProperties {
  return {
    left: `${((point.x - camera.x) / columns) * 100}%`,
    top: `${((point.y - camera.y) / rows) * 100}%`,
    width: `${100 / columns}%`,
    height: `${100 / rows}%`,
  };
}

export function Snake({ windowId }: AppProps) {
  const theme = useSystemStore((store) => store.theme);
  const accentColor = useSystemStore((store) => store.accentColor);
  const visualMode = useSystemStore((store) => store.snakeVisualMode);
  const setVisualMode = useSystemStore((store) => store.setSnakeVisualMode);
  const [playMode, setPlayMode] = useState<SnakeMode | "menu" | "unicorn-select">("menu");
  const [selectedSkin, setSelectedSkin] = useState<UnicornSkin>(readUnicornSkin);
  const [preferences, setPreferences] = useState<SnakePreferences>(readSnakePreferences);
  const arena = useMemo(() => boardForArena(preferences.arenaSize), [preferences.arenaSize]);
  const windowState = useWindowStore((store) => store.windows.find((item) => item.id === windowId));
  const toggleMaximize = useWindowStore((store) => store.toggleMaximize);
  const [game, setGame] = useState<GameState>(() => createGameState(Math.random, arena));
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(UNICORN_BEST_KEY));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [sprinkles, setSprinkles] = useState<Sprinkle[]>([]);
  const gameRef = useRef(game);
  const boardRef = useRef<HTMLDivElement>(null);
  const playAreaRef = useRef<HTMLDivElement>(null);
  const viewport = useSnakeViewport(playAreaRef, playMode === "unicorn");
  const swipeStart = useRef<Point | null>(null);
  const historyRef = useRef<Point[]>([...game.snake]);
  const boostingRef = useRef(false);
  const [boosting, setBoosting] = useState(false);
  const particleId = useRef(0);
  const particleTimers = useRef<number[]>([]);
  const modeClass = visualMode === "unicorn" ? "snake--unicorn" : "snake--classic";
  const style = {
    "--snake-accent": accentColor,
    "--snake-move-duration": `${Math.max(80, getStepMs(game.score) * 0.7)}ms`,
    "--snake-viewport-columns": Math.min(game.board.columns, viewport.columns),
    "--snake-viewport-rows": Math.min(game.board.rows, viewport.rows),
    "--snake-board-ratio": Math.min(game.board.columns, viewport.columns) / Math.min(game.board.rows, viewport.rows),
  } as CSSProperties;

  const commit = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const reset = useCallback(() => {
    particleTimers.current.forEach((timer) => window.clearTimeout(timer));
    particleTimers.current = [];
    setSprinkles([]);
    setBoostActive(false);
    boostingRef.current = false;
    setBoosting(false);
    const restarted = restartGame(Math.random, arena);
    historyRef.current = [...restarted.snake];
    commit(restarted);
    boardRef.current?.focus();
  }, [arena, commit]);

  const burst = useCallback((point: Point, amount = 16) => {
    const id = particleId.current++;
    const newParticles = Array.from({ length: amount }, (_, index) => {
      const angle = (Math.PI * 2 * index) / amount + Math.random() * 0.4;
      const distance = 26 + Math.random() * 72;
      return {
        id: id * 100 + index,
        x: point.x,
        y: point.y,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 15,
        color: SPRINKLE_COLORS[Math.floor(Math.random() * SPRINKLE_COLORS.length)],
        star: Math.random() > 0.7,
      };
    });
    setSprinkles((current) => [...current, ...newParticles]);
    const timer = window.setTimeout(() => {
      setSprinkles((current) => current.filter((particle) => Math.floor(particle.id / 100) !== id));
      particleTimers.current = particleTimers.current.filter((active) => active !== timer);
    }, 1050);
    particleTimers.current.push(timer);
  }, []);

  const tick = useCallback(() => {
    const before = gameRef.current;
    const next = advanceGame(before, Math.random, boostingRef.current);
    if (next.snake[0].x !== before.snake[0].x || next.snake[0].y !== before.snake[0].y) {
      historyRef.current = appendHeadHistory(historyRef.current, before.snake[0], next.snake[0], next.snake.length);
    }
    if (next.score > before.score) {
      setBestScore((current) => Math.max(current, next.score));
      try { localStorage.setItem(UNICORN_BEST_KEY, String(next.score)); } catch { /* Saved scores are optional. */ }
      burst(next.snake[0], visualMode === "unicorn" ? 22 : 10);
    }
    commit(next);
  }, [burst, commit, visualMode]);
  const animationProgress = useSnakeAnimation(playMode === "unicorn" && game.status === "playing", getStepMs(game.score), tick);
  const renderedSnake = interpolateSnake(historyRef.current, game.snake, animationProgress);
  const setBoostActive = (active: boolean) => {
    const allowed = active && gameRef.current.status === "playing";
    boostingRef.current = allowed;
    setBoosting(allowed);
  };

  useEffect(() => {
    if (playMode !== "unicorn" || game.status !== "playing") setBoostActive(false);
  }, [game.status, playMode]);

  useEffect(() => {
    const release = () => setBoostActive(false);
    const onVisibilityChange = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (playMode === "unicorn") boardRef.current?.focus();
  }, [playMode, windowId]);

  useEffect(() => {
    if (playMode !== "unicorn" || game.status !== "celebrating") return;
    burst(gameRef.current.snake[0], 30);
    const timer = window.setTimeout(() => {
      if (gameRef.current.status === "celebrating") {
        commit({ ...gameRef.current, status: "playing" });
      }
    }, CELEBRATION_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [burst, commit, game.status, playMode]);

  useEffect(() => () => {
    particleTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const steer = (direction: Direction) => {
    const current = gameRef.current;
    if (current.status === "ready") {
      const started = startGame(current);
      commit(setDirection(started, direction));
      return;
    }
    if (current.status !== "playing") return;
    commit(setDirection(current, direction));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, summary") && target !== boardRef.current) return;
    const keys: Record<string, Direction> = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowRight: "right",
      d: "right",
      D: "right",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
    };
    const direction = keys[event.key];
    if (direction) {
      event.preventDefault();
      steer(direction);
    } else if ((event.key === " " || event.key === "Enter" || event.key === "Escape" || event.key.toLowerCase() === "p") && event.target === boardRef.current) {
      event.preventDefault();
      const current = gameRef.current;
      if (current.status === "ready") commit(startGame(current));
      else if (current.status === "playing") { setBoostActive(false); commit(pauseGame(current)); }
      else if (current.status === "paused") commit(resumeGame(current));
      else if (current.status === "gameover" || current.status === "won") reset();
    }
    if (event.key === "Shift") setBoostActive(true);
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Shift") setBoostActive(false);
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const direction = directionFromSwipe(start, { x: event.clientX, y: event.clientY });
    if (direction) steer(direction);
  };

  const rootClassName = `snake ${modeClass} snake--unicorn-skin-${selectedSkin} snake--theme-${theme}`;
  const nextHead = renderedSnake[0] ?? game.snake[0];
  const isWin = game.status === "won";
  const viewColumns = Math.min(game.board.columns, viewport.columns);
  const viewRows = Math.min(game.board.rows, viewport.rows);
  const camera = {
    x: Math.max(0, Math.min(game.board.columns - viewColumns, nextHead.x - Math.floor(viewColumns / 2))),
    y: Math.max(0, Math.min(game.board.rows - viewRows, nextHead.y - Math.floor(viewRows / 2))),
  };

  if (playMode === "menu") {
    return (
      <SnakeArcadeMenu
        accentColor={accentColor}
        theme={theme}
        preferences={preferences}
        onPreferences={setPreferences}
        onFullscreen={() => toggleMaximize(windowId)}
        isMaximized={Boolean(windowState?.isMaximized)}
        serverConfigured={Boolean(import.meta.env.VITE_SNAKE_SERVER_URL)}
        onSelect={(mode) => {
          if (mode === "unicorn") {
            setPlayMode("unicorn-select");
          } else if (mode === "classic") {
            setVisualMode("classic");
          }
          if (mode !== "unicorn") setPlayMode(mode);
        }}
      />
    );
  }

  if (playMode === "unicorn-select") {
    return (
      <main className={`snake ${modeClass} snake--unicorn-skin-${selectedSkin} snake--theme-${theme} snake__skin-select`} style={style}>
        <header className="snake__header">
          <button type="button" className="snake__online-button" onClick={() => setPlayMode("menu")}>‹ Game selection</button>
          <div className="snake__brand"><span className="snake__brand-mark">✦</span><div><h1>Choose your unicorn</h1><p>Your look is saved on this device. Every unicorn plays the same.</p></div></div>
          <button type="button" className="snake__online-button" onClick={() => toggleMaximize(windowId)}>{windowState?.isMaximized ? "Restore" : "Maximize"}</button>
        </header>
        <section className="snake__skin-cards" aria-label="Unicorn designs">
          {UNICORN_SKINS.map((skin) => (
            <button type="button" key={skin.id} className={`snake__skin-card snake__skin-card--${skin.id} snake--unicorn-skin-${skin.id}`} aria-pressed={selectedSkin === skin.id}
              onClick={() => { setSelectedSkin(skin.id); saveUnicornSkin(skin.id); }}>
              <UnicornHead direction="up" skin={skin.id} />
              <strong>{skin.name}</strong><small>{skin.description}</small>
              {selectedSkin === skin.id && <span className="snake__skin-selected">Selected</span>}
            </button>
          ))}
        </section>
        <button type="button" className="snake__primary snake__skin-play" onClick={() => {
          setVisualMode("unicorn");
          saveUnicornSkin(selectedSkin);
          reset();
          setPlayMode("unicorn");
        }}>Play Unicorn Dreams</button>
      </main>
    );
  }

  if (playMode === "online") {
    return (
      <SnakeMultiplayer
        visualMode={visualMode}
        unicornSkin={selectedSkin}
        accentColor={accentColor}
        theme={theme}
        windowId={windowId}
        onVisualModeChange={setVisualMode}
        onExit={() => setPlayMode("menu")}
      />
    );
  }

  if (playMode === "classic" || playMode === "versus" || playMode === "ai-battle") {
    return (
      <SnakeLocalGame
        mode={playMode}
        accentColor={accentColor}
        theme={theme}
        preferences={preferences}
        onPreferences={setPreferences}
        onMenu={() => setPlayMode("menu")}
        onFullscreen={() => toggleMaximize(windowId)}
        isMaximized={Boolean(windowState?.isMaximized)}
      />
    );
  }

  return (
    <main className={rootClassName} style={style} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      <header className="snake__header">
        <div className="snake__brand">
          <span className="snake__brand-mark" aria-hidden="true">✦</span>
          <div>
            <h1>Unicorn Dreams</h1>
            <p>A little magic with every cupcake</p>
          </div>
        </div>
        <div className="snake__header-actions">
          <button type="button" className="snake__online-button" onClick={() => setPlayMode("menu")}>Game selection</button>
          <PreferenceControls value={preferences} onChange={setPreferences} />
          <button type="button" className="snake__online-button" onClick={() => toggleMaximize(windowId)}>{windowState?.isMaximized ? "Restore" : "Full screen"}</button>
        </div>
      </header>

      <div className="snake__scorebar">
        <div className="snake__score">
          <span>{visualMode === "unicorn" ? "Cupcakes" : "Score"}</span>
          <strong>{game.score}<small> / {WINNING_SCORE}</small></strong>
        </div>
        <div className="snake__score snake__best"><span>Best</span><strong>{bestScore}</strong></div>
        <div className="snake__progress" role="progressbar" aria-label={visualMode === "unicorn" ? "Cupcakes collected" : "Score"} aria-valuemin={0} aria-valuemax={WINNING_SCORE} aria-valuenow={Math.min(game.score, WINNING_SCORE)}>
          <span style={{ width: `${Math.min(100, (game.score / WINNING_SCORE) * 100)}%` }} />
        </div>
        <div className="snake__length"><span>Length</span><strong>{game.snake.length}</strong></div>
      </div>

      <div ref={playAreaRef} className="snake__playarea">
        <div
          ref={boardRef}
          className="snake__board"
          style={{ width: viewport.width || undefined, height: viewport.height || undefined }}
          tabIndex={0}
          role="application"
          aria-label={`Snake game board. ${game.score} ${visualMode === "unicorn" ? "cupcakes collected" : "points"}. Use arrow keys or WASD to steer.`}
          onPointerDown={(event) => {
            boardRef.current?.focus();
            handlePointerDown(event);
          }}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeStart.current = null; }}
        >
          <div
            className="snake__world-edge"
            style={{
              left: `${(-camera.x / viewColumns) * 100}%`,
              top: `${(-camera.y / viewRows) * 100}%`,
              width: `${(game.board.columns / viewColumns) * 100}%`,
              height: `${(game.board.rows / viewRows) * 100}%`,
            }}
            aria-hidden="true"
          />
          <div className="snake__grid" aria-hidden="true">
            {game.snake.slice(1).map((segment, index) => (
              <div
                key={`segment-${index}`}
                className={`snake__segment ${visualMode === "unicorn" ? "snake__segment--unicorn" : ""} ${index === game.snake.length - 2 ? "snake__tail" : ""}`}
                style={pointStyle(renderedSnake[index + 1] ?? segment, camera, viewColumns, viewRows)}
              >
                {visualMode === "unicorn" && <span className="snake__leg snake__leg--left" />}
                {visualMode === "unicorn" && <span className="snake__leg snake__leg--right" />}
              </div>
            ))}
            <div className="snake__head" style={pointStyle(nextHead, camera, viewColumns, viewRows)}>
              {visualMode === "unicorn" ? (
                <UnicornHead direction={game.direction} flying={isWin} skin={selectedSkin} />
              ) : (
                <ClassicSnakeHead direction={game.direction} />
              )}
            </div>
            {visualMode === "unicorn" ? (
              <>
                {game.food && <div className="snake__food" style={pointStyle(game.food, camera, viewColumns, viewRows)} role="img" aria-label="Cupcake"><Cupcake /></div>}
                {game.specialFood && <div className="snake__food snake__food--special" style={pointStyle(game.specialFood, camera, viewColumns, viewRows)} role="img" aria-label="Special cupcake"><Cupcake special /></div>}
              </>
            ) : (
              <>
                {game.food && <div className="snake__food snake__food--classic" style={pointStyle(game.food, camera, viewColumns, viewRows)} aria-label="Food"><span /></div>}
                {game.specialFood && <div className="snake__food snake__food--bonus" style={pointStyle(game.specialFood, camera, viewColumns, viewRows)} aria-label="Bonus food">★</div>}
              </>
            )}
            {sprinkles.map((particle) => (
              <i
                key={particle.id}
                className={`snake__particle ${particle.star ? "snake__particle--star" : ""}`}
                style={{
                  left: `${((particle.x - camera.x + 0.5) / viewColumns) * 100}%`,
                  top: `${((particle.y - camera.y + 0.5) / viewRows) * 100}%`,
                  "--dx": `${particle.dx}px`,
                  "--dy": `${particle.dy}px`,
                  background: particle.star ? "transparent" : particle.color,
                  color: particle.color,
                } as CSSProperties}
              />
            ))}
          </div>

          {game.status !== "playing" && (
            <section className={`snake__overlay ${game.status === "won" ? "snake__overlay--win" : ""}`} aria-live="polite">
              {game.status === "ready" && (
                <>
                  <span className="snake__overlay-icon">{visualMode === "unicorn" ? "🦄" : "🐍"}</span>
                  <h2>Ready when you are</h2>
                  <p>{visualMode === "unicorn" ? "Collect cupcakes, grow your unicorn, and reach 67!" : "Collect food and try to reach 67."}</p>
                  <button type="button" className="snake__primary" onClick={() => commit(startGame(gameRef.current))}>Start game</button>
                </>
              )}
              {game.status === "paused" && (
                <>
                  <span className="snake__overlay-icon">Ⅱ</span>
                  <h2>Taking a breather?</h2>
                  <p>Your game is paused. Pick up where you left off.</p>
                  <button type="button" className="snake__primary" onClick={() => commit(resumeGame(gameRef.current))}>Resume</button>
                </>
              )}
              {game.status === "celebrating" && (
                <>
                  {visualMode === "unicorn" ? (
                    <span className="snake__celebration-cupcake"><Cupcake special /></span>
                  ) : (
                    <span className="snake__overlay-icon">★</span>
                  )}
                  <h2>{visualMode === "unicorn" ? "Magic cupcake!" : "Bonus collected!"}</h2>
                  <p>{visualMode === "unicorn" ? "A little celebration, then right back to the adventure." : "Take a moment, then the game will resume."}</p>
                  <span className="snake__countdown">✨ 3 seconds of magic ✨</span>
                </>
              )}
              {game.status === "gameover" && (
                <>
                  <span className="snake__overlay-icon">♡</span>
                  <h2>Nice try!</h2>
                  <p>You collected {game.score} {visualMode === "unicorn" ? "cupcakes" : "points"}. Ready for another round?</p>
                  <button type="button" className="snake__primary" onClick={reset}>Play again</button>
                </>
              )}
              {game.status === "won" && (
                <>
                  <span className="snake__overlay-icon">✦</span>
                  <h2>Great job!</h2>
                  <p>You collected all {WINNING_SCORE} cupcakes. The unicorn is off to dream up more magic!</p>
                  <button type="button" className="snake__primary" onClick={reset}>Play again</button>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="snake__footer">
        <div className="snake__controls" role="group" aria-label="Touch direction controls">
          {DIRECTIONS.map((direction) => (
            <button
              key={direction}
              type="button"
              className={`snake__direction snake__direction--${direction}`}
              onClick={() => steer(direction)}
              aria-label={`Move ${direction}`}
              disabled={game.status === "paused" || game.status === "celebrating" || game.status === "won" || game.status === "gameover"}
            >
              {direction === "up" ? "↑" : direction === "right" ? "→" : direction === "down" ? "↓" : "←"}
            </button>
          ))}
        </div>
        <div className="snake__actions">
          {game.status === "playing" ? (
            <button type="button" onClick={() => { setBoostActive(false); commit(pauseGame(gameRef.current)); }}>Pause</button>
          ) : game.status === "paused" ? (
            <button type="button" onClick={() => commit(resumeGame(gameRef.current))}>Resume</button>
          ) : game.status === "ready" ? (
            <button type="button" onClick={() => commit(startGame(gameRef.current))}>Start</button>
          ) : null}
          <button type="button" onClick={reset}>Restart</button>
          <button type="button" className={`snake__boost ${boosting ? "is-active" : ""}`} aria-pressed={boosting} title="Hold BOOST: every two snacks add one unit of growth. Score is unchanged." disabled={game.status !== "playing"}
            onPointerDown={(event) => { event.preventDefault(); setBoostActive(true); }}
            onPointerUp={() => setBoostActive(false)} onPointerCancel={() => setBoostActive(false)} onPointerLeave={() => setBoostActive(false)}
            onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); setBoostActive(true); } }}
            onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") setBoostActive(false); }}>BOOST</button>
        </div>
        <p className="snake__hint">
          {visualMode === "unicorn" ? "Arrow keys or WASD · swipe or tap the arrows · hold Shift or BOOST to grow at half rate · every 25 cupcakes brings a surprise" : "Arrow keys or WASD · swipe or tap the arrows · hold Shift or BOOST to grow at half rate · avoid the walls and yourself"}
        </p>
      </footer>
    </main>
  );
}
