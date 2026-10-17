import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, Gamepad2, Settings2, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import type { ThemeName } from "../../types";
import type { Direction, Point } from "./engine";
import {
  advanceClassic,
  advanceVersus,
  classicStepMs,
  createClassicState,
  createVersusState,
  DIFFICULTIES,
  setClassicDirection,
  setVersusDirection,
  type ClassicState,
  type Difficulty,
  type VersusState,
  type VersusPlayer,
} from "./localEngines";
import { advanceAIBattle, createAIBattleState, setAIBattleDirection, type AIBattleState } from "./aiBattle";
import { ARENA_PRESETS, boardForArena, readClassicHighScores, recordClassicHighScore, saveSnakePreferences, type ArenaSize, type SnakePreferences } from "./snakePreferences";
import { appendHeadHistory, interpolateSnake } from "./motion";
import { ClassicSnakeHead } from "./SnakeArt";
import { useSnakeAnimation } from "./useSnakeAnimation";
import { useSnakeViewport } from "./useSnakeViewport";
import "./SnakeArcade.css";

export type SnakeMode = "classic" | "unicorn" | "versus" | "ai-battle" | "online";
const DIR_KEYS: Record<string, Direction> = {
  ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left",
  w: "up", W: "up", d: "right", D: "right", s: "down", S: "down", a: "left", A: "left",
};
function useScoreSound(enabled: boolean) {
  const audioRef = useRef<AudioContext | null>(null);
  const prime = useCallback(() => {
    if (!enabled) return;
    try {
      const context = audioRef.current ?? new AudioContext();
      audioRef.current = context;
      if (context.state === "suspended") void context.resume();
    } catch {
      audioRef.current = null;
    }
  }, [enabled]);
  const play = useCallback(() => {
    if (!enabled) return;
    try {
      const context = audioRef.current;
      if (!context || context.state !== "running") return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(990, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.13);
    } catch {
      audioRef.current = null;
    }
  }, [enabled]);
  useEffect(() => () => { void audioRef.current?.close(); audioRef.current = null; }, []);
  return { prime, play };
}

function clampCamera(head: { x: number; y: number }, width: number, height: number, viewport: { columns: number; rows: number }) {
  const columns = Math.min(width, viewport.columns);
  const rows = Math.min(height, viewport.rows);
  return {
    x: Math.max(0, Math.min(width - columns, head.x - Math.floor(columns / 2))),
    y: Math.max(0, Math.min(height - rows, head.y - Math.floor(rows / 2))),
    columns,
    rows,
  };
}

function Cell({ point, camera, className, children, color }: {
  point: { x: number; y: number };
  camera: ReturnType<typeof clampCamera>;
  className: string;
  children?: ReactNode;
  color?: string;
}) {
  const style: CSSProperties = {
    left: `${((point.x - camera.x) / camera.columns) * 100}%`,
    top: `${((point.y - camera.y) / camera.rows) * 100}%`,
    width: `${100 / camera.columns}%`,
    height: `${100 / camera.rows}%`,
    ...(color ? { "--local-snake-color": color } as CSSProperties : {}),
  };
  return <span className={className} style={style}>{children}</span>;
}

function DirectionPad({ disabled, onMove }: { disabled: boolean; onMove: (direction: Direction) => void }) {
  return (
    <div className="snake-arcade__dpad" role="group" aria-label="Touch direction controls">
      {(["up", "left", "down", "right"] as const).map((direction) => {
        const Icon = direction === "up" ? ArrowUp : direction === "right" ? ArrowRight : direction === "down" ? ArrowDown : ArrowLeft;
        return <button key={direction} type="button" aria-label={`Move ${direction}`} disabled={disabled} onClick={() => onMove(direction)}><Icon size={18} /></button>;
      })}
    </div>
  );
}

export function PreferenceControls({ value, onChange }: { value: SnakePreferences; onChange: (next: SnakePreferences) => void }) {
  return (
    <details className="snake-arcade__settings">
      <summary aria-label="Game settings"><Settings2 size={15} /><span>Settings</span></summary>
      <div className="snake-arcade__settings-panel">
        <label>Difficulty
          <select value={value.difficulty} onChange={(event) => onChange({ ...value, difficulty: event.target.value as Difficulty })}>
            {Object.entries(DIFFICULTIES).map(([key, difficulty]) => <option key={key} value={key}>{difficulty.label}</option>)}
          </select>
        </label>
        <label>AI Battle difficulty
          <select value={value.aiDifficulty} onChange={(event) => onChange({ ...value, aiDifficulty: event.target.value as SnakePreferences["aiDifficulty"] })}>
            {(["easy", "normal", "hard", "expert"] as const).map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty[0].toUpperCase() + difficulty.slice(1)}</option>)}
          </select>
        </label>
        <label>Arena size <small>Used for the next run</small>
          <select value={value.arenaSize} onChange={(event) => onChange({ ...value, arenaSize: event.target.value as ArenaSize })}>
            {Object.entries(ARENA_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
          </select>
        </label>
        <label className="snake-arcade__toggle"><input type="checkbox" checked={value.sound} onChange={(event) => onChange({ ...value, sound: event.target.checked })} />{value.sound ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound</label>
        <label className="snake-arcade__toggle"><input type="checkbox" checked={value.effects} onChange={(event) => onChange({ ...value, effects: event.target.checked })} /><Sparkles size={15} /> Visual effects</label>
      </div>
    </details>
  );
}

export function SnakeArcadeMenu({ accentColor, theme, preferences, onPreferences, onSelect, onFullscreen, isMaximized, serverConfigured }: {
  accentColor: string;
  theme: ThemeName;
  preferences: SnakePreferences;
  onPreferences: (next: SnakePreferences) => void;
  onSelect: (mode: SnakeMode) => void;
  onFullscreen: () => void;
  isMaximized: boolean;
  serverConfigured: boolean;
}) {
  const style = { "--snake-accent": accentColor } as CSSProperties;
  useEffect(() => {
    saveSnakePreferences(preferences);
  }, [preferences]);
  const options: Array<{ mode: SnakeMode; title: string; label: string; description: string; icon: string; controls: string }> = [
    { mode: "classic", title: "Classic Snake", label: "SOLO", description: "Eat, grow, and stay clear of the walls and your own tail.", icon: "◉", controls: "Arrows / WASD · Easy to Hard" },
    { mode: "unicorn", title: "Unicorn Dreams", label: "MAGICAL", description: "Guide a pastel unicorn through cupcake milestones to a 67-treat finale.", icon: "✧", controls: "Arrows / WASD · 25-treat celebrations" },
    { mode: "versus", title: "VS Snake", label: "LOCAL 2P", description: "Two people, one board. Collect more food and outlast your rival.", icon: "⚔", controls: "P1 WASD · P2 Arrow keys" },
    { mode: "ai-battle", title: "AI Battle", label: "SOLO VS BOTS", description: "Outlast four hunting snakes that chase you, predict your route, and race for food.", icon: "⌁", controls: "Arrows / WASD · Easy to Expert" },
    { mode: "online", title: "Online Multiplayer", label: serverConfigured ? "SERVER CONFIGURED" : "SERVER REQUIRED", description: serverConfigured ? "Create a public room or invite a friend with a private room code." : "Connect to the authoritative multiplayer server using VITE_SNAKE_SERVER_URL.", icon: "⌁", controls: "Public lobby · private room codes" },
  ];
  return (
    <main className={`snake snake--theme-${theme} snake-arcade snake-arcade--menu`} style={style}>
      <header className="snake-arcade__topbar">
        <div className="snake-arcade__wordmark"><span>✦</span><div><strong>ORBIT ARCADE</strong><small>Snake collection</small></div></div>
        <div className="snake-arcade__top-actions">
          <PreferenceControls value={preferences} onChange={onPreferences} />
          <button type="button" className="snake-arcade__quiet" onClick={onFullscreen}>{isMaximized ? "Restore window" : "Maximize window"}</button>
        </div>
      </header>
      <section className="snake-arcade__intro">
        <div className="snake-arcade__eyebrow"><Gamepad2 size={14} /> PICK YOUR RUN</div>
        <h1>Ready, set, <em>slither.</em></h1>
        <p>Pick a game mode. Local games work offline; online rooms connect only to the configured game server.</p>
      </section>
      <section className="snake-arcade__cards" aria-label="Snake game modes">
        {options.map((option, index) => (
          <article className={`snake-arcade__card snake-arcade__card--${option.mode}`} key={option.mode} style={{ "--card-index": index } as CSSProperties}>
            <div className="snake-arcade__card-top"><span className="snake-arcade__card-icon" aria-hidden="true">{option.icon}</span><span className="snake-arcade__badge">{option.label}</span></div>
            <h2>{option.title}</h2><p>{option.description}</p>
            <div className="snake-arcade__card-foot"><small>{option.controls}</small><button type="button" onClick={() => onSelect(option.mode)}>{option.mode === "online" ? "Open lobby" : "Play"} <ChevronLeft size={15} /></button></div>
          </article>
        ))}
      </section>
      <footer className="snake-arcade__menu-foot">
        <span><Zap size={14} /> Classic: <strong>{DIFFICULTIES[preferences.difficulty].label}</strong></span>
        <span>AI: <strong>{preferences.aiDifficulty[0].toUpperCase() + preferences.aiDifficulty.slice(1)}</strong> · Arena: <strong>{ARENA_PRESETS[preferences.arenaSize].label}</strong></span>
        <span className={serverConfigured ? "is-online" : "is-offline"}><i />{serverConfigured ? "Online endpoint configured" : "Local modes ready · multiplayer server not configured"}</span>
      </footer>
    </main>
  );
}

export function SnakeLocalGame({ mode, accentColor, theme, preferences, onPreferences, onMenu, onFullscreen, isMaximized }: {
  mode: "classic" | "versus" | "ai-battle";
  accentColor: string;
  theme: ThemeName;
  preferences: SnakePreferences;
  onPreferences: (next: SnakePreferences) => void;
  onMenu: () => void;
  onFullscreen: () => void;
  isMaximized: boolean;
}) {
  const isVersus = mode === "versus";
  const isAIBattle = mode === "ai-battle";
  const arena = boardForArena(preferences.arenaSize);
  const [classic, setClassic] = useState<ClassicState>(() => createClassicState(preferences.difficulty, Math.random, arena));
  const [versus, setVersus] = useState<VersusState>(() => createVersusState(Math.random, arena));
  const [aiBattle, setAIBattle] = useState<AIBattleState>(() => createAIBattleState(preferences.aiDifficulty, Math.random, arena));
  const [highScores, setHighScores] = useState(readClassicHighScores);
  const classicRef = useRef(classic);
  const versusRef = useRef(versus);
  const aiBattleRef = useRef(aiBattle);
  const boardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const viewport = useSnakeViewport(stageRef);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const recordedRef = useRef(false);
  const classicHistory = useRef<Point[]>([...classic.snake]);
  const versusHistory = useRef<Point[][]>(versus.players.map((player) => [...player.snake]));
  const aiBattleHistory = useRef<Point[][]>(aiBattle.players.map((player) => [...player.snake]));
  const boostRef = useRef({ one: false, two: false });
  const [boostState, setBoostState] = useState({ one: false, two: false });
  const sound = useScoreSound(preferences.sound);
  const state = isVersus ? versus : isAIBattle ? aiBattle : classic;
  const currentStatus = state.status;
  const playerOne = isVersus ? versus.players[0] : null;
  const playerTwo = isVersus ? versus.players[1] : null;
  const localStepMs = isVersus
    ? Math.max(115, 210 - Math.max(versus.players[0].score, versus.players[1].score) * 1.5)
    : isAIBattle
      ? Math.max(115, 190 - Math.max(...aiBattle.players.map((player) => player.score)) * 1.2)
      : classicStepMs(classic);
  const playScoreSound = sound.play;

  useEffect(() => {
    saveSnakePreferences(preferences);
  }, [preferences]);
  useEffect(() => {
    classicRef.current = classic;
  }, [classic]);
  useEffect(() => {
    versusRef.current = versus;
  }, [versus]);
  useEffect(() => {
    aiBattleRef.current = aiBattle;
  }, [aiBattle]);
  const tick = () => {
    if (isVersus) {
      const before = versusRef.current;
      const after = advanceVersus(before, Math.random, boostRef.current);
      after.players.forEach((player, index) => {
        if (player.snake[0].x !== before.players[index].snake[0].x || player.snake[0].y !== before.players[index].snake[0].y) {
          versusHistory.current[index] = appendHeadHistory(versusHistory.current[index], before.players[index].snake[0], player.snake[0], player.snake.length);
        }
      });
      if (after.players.some((player, index) => player.score > before.players[index].score)) playScoreSound();
      versusRef.current = after;
      setVersus(after);
    } else if (isAIBattle) {
      const before = aiBattleRef.current;
      const after = advanceAIBattle(before, Math.random, boostRef.current.one);
      after.players.forEach((player, index) => {
        if (player.snake[0].x !== before.players[index].snake[0].x || player.snake[0].y !== before.players[index].snake[0].y) {
          aiBattleHistory.current[index] = appendHeadHistory(aiBattleHistory.current[index] ?? [...before.players[index].snake], before.players[index].snake[0], player.snake[0], player.snake.length);
        }
      });
      if (after.players.some((player, index) => player.score > before.players[index].score)) playScoreSound();
      aiBattleRef.current = after;
      setAIBattle(after);
    } else {
      const before = classicRef.current;
      const after = advanceClassic(before, Math.random, boostRef.current.one);
      if (after.snake[0].x !== before.snake[0].x || after.snake[0].y !== before.snake[0].y) {
        classicHistory.current = appendHeadHistory(classicHistory.current, before.snake[0], after.snake[0], after.snake.length);
      }
      if (after.score > before.score) playScoreSound();
      classicRef.current = after;
      setClassic(after);
    }
  };
  const animationProgress = useSnakeAnimation(currentStatus === "playing", localStepMs, tick);
  const renderedClassic = interpolateSnake(classicHistory.current, classic.snake, animationProgress);
  const renderedVersus = versus.players.map((player, index) => interpolateSnake(versusHistory.current[index], player.snake, animationProgress));
  const renderedAIBattle = aiBattle.players.map((player, index) => interpolateSnake(aiBattleHistory.current[index] ?? player.snake, player.snake, animationProgress));
  useEffect(() => {
    if (isVersus || classic.status !== "gameover" || recordedRef.current) return;
    recordedRef.current = true;
    setHighScores(recordClassicHighScore({ score: classic.score, difficulty: classic.difficulty, date: new Date().toISOString() }));
  }, [classic, isVersus]);

  const updateClassic = (next: ClassicState) => { classicRef.current = next; setClassic(next); };
  const updateVersus = (next: VersusState) => { versusRef.current = next; setVersus(next); };
  const updateAIBattle = (next: AIBattleState) => { aiBattleRef.current = next; setAIBattle(next); };
  const changePreferences = (next: SnakePreferences) => {
    onPreferences(next);
    if (next.difficulty !== preferences.difficulty) {
      const updated = { ...classicRef.current, difficulty: next.difficulty };
      classicRef.current = updated;
      setClassic(updated);
    }
    if (next.aiDifficulty !== preferences.aiDifficulty) {
      updateAIBattle({ ...aiBattleRef.current, difficulty: next.aiDifficulty });
    }
  };
  const start = () => {
    sound.prime();
    if (isVersus) updateVersus({ ...versusRef.current, status: "playing" });
    else if (isAIBattle) updateAIBattle({ ...aiBattleRef.current, status: "playing" });
    else updateClassic({ ...classicRef.current, status: "playing" });
    boardRef.current?.focus();
  };
  const restart = () => {
    recordedRef.current = false;
    sound.prime();
    boostRef.current = { one: false, two: false };
    setBoostState({ one: false, two: false });
    if (isVersus) {
      const restarted = createVersusState(Math.random, arena);
      versusHistory.current = restarted.players.map((player) => [...player.snake]);
      updateVersus(restarted);
    } else if (isAIBattle) {
      const restarted = createAIBattleState(preferences.aiDifficulty, Math.random, arena);
      aiBattleHistory.current = restarted.players.map((player) => [...player.snake]);
      updateAIBattle(restarted);
    } else {
      const restarted = createClassicState(preferences.difficulty, Math.random, arena);
      classicHistory.current = [...restarted.snake];
      updateClassic(restarted);
    }
    boardRef.current?.focus();
  };
  const steer = (direction: Direction, player: VersusPlayer["id"] = "one") => {
    sound.prime();
    if (isVersus) {
      const current = versusRef.current;
      const started = current.status === "ready" ? { ...current, status: "playing" as const } : current;
      updateVersus(setVersusDirection(started, player, direction));
    } else if (isAIBattle) {
      const current = aiBattleRef.current;
      const started = current.status === "ready" ? { ...current, status: "playing" as const } : current;
      updateAIBattle(setAIBattleDirection(started, direction));
    } else {
      const current = classicRef.current;
      const started = current.status === "ready" ? { ...current, status: "playing" as const } : current;
      updateClassic(setClassicDirection(started, direction));
    }
  };
  const pauseToggle = () => {
    boostRef.current = { one: false, two: false };
    setBoostState({ one: false, two: false });
    if (isVersus) {
      const next = { ...versusRef.current, status: versusRef.current.status === "playing" ? "paused" as const : "playing" as const };
      updateVersus(next);
    } else if (isAIBattle) {
      const next = { ...aiBattleRef.current, status: aiBattleRef.current.status === "playing" ? "paused" as const : "playing" as const };
      updateAIBattle(next);
    } else {
      const next = { ...classicRef.current, status: classicRef.current.status === "playing" ? "paused" as const : "playing" as const };
      updateClassic(next);
    }
    boardRef.current?.focus();
  };
  const holdBoost = (player: VersusPlayer["id"], active: boolean) => {
    const enabled = active && currentStatus === "playing";
    boostRef.current = { ...boostRef.current, [player]: enabled };
    setBoostState((current) => ({ ...current, [player]: enabled }));
  };
  useEffect(() => {
    const releaseBoost = () => {
      boostRef.current = { one: false, two: false };
      setBoostState({ one: false, two: false });
    };
    const releaseOnVisibility = () => { if (document.hidden) releaseBoost(); };
    window.addEventListener("blur", releaseBoost);
    document.addEventListener("visibilitychange", releaseOnVisibility);
    return () => {
      window.removeEventListener("blur", releaseBoost);
      document.removeEventListener("visibilitychange", releaseOnVisibility);
    };
  }, []);
  useEffect(() => {
    if (currentStatus !== "playing") {
      boostRef.current = { one: false, two: false };
      setBoostState({ one: false, two: false });
    }
  }, [currentStatus]);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, summary") && target !== boardRef.current) return;
    if (event.key === " " || event.key === "Escape") {
      if (currentStatus === "playing" || currentStatus === "paused") {
        event.preventDefault();
        pauseToggle();
      }
      return;
    }
    if (event.key === "Shift" || event.code === "ShiftRight") {
      holdBoost(isVersus && event.code === "ShiftRight" ? "two" : "one", true);
      return;
    }
    const direction = DIR_KEYS[event.key];
    if (!direction) return;
    const player: VersusPlayer["id"] = isVersus && event.key.startsWith("Arrow") ? "two" : "one";
    event.preventDefault();
    steer(direction, player);
  };
  const handleKeyUp = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Shift" || event.code === "ShiftRight") holdBoost(isVersus && event.code === "ShiftRight" ? "two" : "one", false);
  };
  const isPlaying = currentStatus === "playing";
  const head = isVersus
    ? {
        x: Math.round((versus.players[0].snake[0].x + versus.players[1].snake[0].x) / 2),
        y: Math.round((versus.players[0].snake[0].y + versus.players[1].snake[0].y) / 2),
      }
    : isAIBattle
      ? renderedAIBattle[0]?.[0] ?? aiBattle.players[0].snake[0]
    : renderedClassic[0] ?? classic.snake[0];
  const activeBoard = isVersus ? versus.board : isAIBattle ? aiBattle.board : classic.board;
  const camera = clampCamera(head, activeBoard.columns, activeBoard.rows, viewport);
  const score = isVersus ? versus.players.reduce((sum, player) => sum + player.score, 0) : isAIBattle ? aiBattle.players[0].score : classic.score;
  const length = isVersus ? versus.players.reduce((sum, player) => sum + player.snake.length, 0) : isAIBattle ? aiBattle.players[0].snake.length : classic.snake.length;
  const style = {
    "--snake-accent": accentColor,
    "--snake-viewport-columns": camera.columns,
    "--snake-viewport-rows": camera.rows,
    "--snake-board-ratio": camera.columns / camera.rows,
    "--snake-move-duration": `${Math.max(75, localStepMs * 0.78)}ms`,
  } as CSSProperties;
  const snacks = isVersus
    ? versus.players.filter((player) => player.alive).map((player) => {
        const playerIndex = versus.players.indexOf(player);
        return player.snake.map((point, index) => <Cell key={`${player.id}-${index}`} point={renderedVersus[playerIndex][index] ?? point} camera={camera} color={player.color} className={index === 0 ? `snake__head snake-local__head snake-local__head--${player.id}` : `snake__segment snake-local__segment ${index === player.snake.length - 1 ? "snake-local__tail" : ""}`}>{index === 0 && <ClassicSnakeHead direction={player.direction} />}</Cell>);
      })
    : isAIBattle
      ? aiBattle.players.filter((player) => player.alive).map((player) => {
          const playerIndex = aiBattle.players.indexOf(player);
          return player.snake.map((point, index) => <Cell key={`${player.id}-${index}`} point={renderedAIBattle[playerIndex][index] ?? point} camera={camera} color={player.color} className={`snake-local__segment snake-ai__segment ${index === 0 ? "snake__head snake-local__head snake-ai__head" : ""} ${index === player.snake.length - 1 ? "snake-local__tail" : ""}`}>{index === 0 && <ClassicSnakeHead direction={player.direction} />}</Cell>);
        })
    : classic.snake.map((point, index) => <Cell key={`classic-${index}`} point={renderedClassic[index] ?? point} camera={camera} className={index === 0 ? "snake__head snake-local__head" : `snake__segment snake-local__segment ${index === classic.snake.length - 1 ? "snake-local__tail" : ""}`}>{index === 0 && <ClassicSnakeHead direction={classic.direction} />}</Cell>);
  const food = isVersus ? versus.food : isAIBattle ? aiBattle.food : classic.food;
  const winnerName = isVersus
    ? versus.winner === "draw" ? "It’s a draw!" : versus.players.find((player) => player.id === versus.winner)?.name ?? "Round over"
    : aiBattle.players.find((player) => player.id === aiBattle.winner)?.name ?? "Round over";

  return (
    <main className={`snake snake--theme-${theme} snake-arcade snake-arcade--game snake-local snake-local--${mode} ${preferences.effects ? "" : "snake-local--effects-off"}`} style={style} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      <header className="snake-arcade__topbar">
        <div className="snake-arcade__wordmark"><button type="button" aria-label="Back to game selection" onClick={onMenu}><ChevronLeft size={18} /></button><span>{isVersus ? "⚔" : isAIBattle ? "⌁" : "◉"}</span><div><strong>{isVersus ? "VS SNAKE" : isAIBattle ? "AI BATTLE" : "CLASSIC SNAKE"}</strong><small>{isVersus ? "Local head-to-head" : isAIBattle ? `${aiBattle.difficulty} hunting pack` : `${DIFFICULTIES[classic.difficulty].label} run`}</small></div></div>
        <div className="snake-arcade__top-actions">
          <PreferenceControls value={preferences} onChange={changePreferences} />
          <button type="button" className="snake-arcade__quiet" onClick={onFullscreen}>{isMaximized ? "Restore" : "Maximize"}</button>
        </div>
      </header>
      <div className={`snake-arcade__hud ${isVersus ? "snake-arcade__hud--versus" : ""} ${isAIBattle ? "snake-arcade__hud--ai" : ""}`}>
        {isVersus ? (
          <>
            <div className="snake-arcade__versus-score"><i style={{ background: playerOne!.color }} /><span>Player 1 · WASD</span><strong>{playerOne!.score}</strong></div>
            <span className="snake-arcade__versus-mid">VS</span>
            <div className="snake-arcade__versus-score"><i style={{ background: playerTwo!.color }} /><span>Player 2 · Arrows</span><strong>{playerTwo!.score}</strong></div>
          </>
        ) : isAIBattle ? (
          <>
            <div><small>SCORE</small><strong>{aiBattle.players[0].score}</strong></div>
            <div className="snake-arcade__ai-count"><small>SNAKES LEFT</small><strong>{aiBattle.players.filter((player) => player.alive).length}</strong></div>
            <div className="snake-arcade__ai-count"><small>ELIMINATED</small><strong>{aiBattle.players.filter((player) => player.bot && !player.alive).length}</strong></div>
            <div className="snake-arcade__best"><small>AI LEVEL</small><strong>{aiBattle.difficulty.toUpperCase()}</strong></div>
          </>
        ) : (
          <>
            <div><small>SCORE</small><strong>{classic.score}</strong></div>
            <div className="snake-arcade__best"><small>PERSONAL BEST</small><strong>{highScores[0]?.score ?? 0}</strong></div>
            <div className="snake-arcade__length"><small>LENGTH</small><strong>{classic.snake.length}</strong></div>
          </>
        )}
        <div className={`snake-arcade__status snake-arcade__status--${currentStatus}`}><i />{currentStatus === "playing" ? "In play" : currentStatus === "paused" ? "Paused" : currentStatus === "gameover" ? "Game over" : currentStatus === "won" ? "Board cleared" : "Ready"}</div>
      </div>
      <section ref={stageRef} className="snake-arcade__stage">
        <div
          ref={boardRef}
          className="snake-arcade__board snake__board"
          style={{ width: viewport.width || undefined, height: viewport.height || undefined }}
          tabIndex={0}
          role="application"
          aria-label={isVersus ? "Two-player Snake. Player one uses WASD, player two uses arrow keys." : isAIBattle ? "AI Battle. Use arrow keys or WASD to outlast the computer-controlled snakes." : "Classic Snake. Use arrow keys or WASD to steer."}
          onPointerDown={(event) => { boardRef.current?.focus(); swipeStart.current = { x: event.clientX, y: event.clientY }; }}
          onPointerUp={(event) => {
            if (isVersus) return;
            const startPoint = swipeStart.current;
            swipeStart.current = null;
            if (!startPoint) return;
            const dx = event.clientX - startPoint.x;
            const dy = event.clientY - startPoint.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
          }}
          onPointerCancel={() => { swipeStart.current = null; }}
        >
          <div className="snake__grid" aria-hidden="true">
            {snacks}
            {food && <Cell point={food} camera={camera} className="snake__food snake__food--classic"><span /></Cell>}
          </div>
          {currentStatus !== "playing" && (
            <section className="snake__overlay snake-arcade__overlay" aria-live="polite">
              {currentStatus === "ready" ? <>
                <span className="snake__overlay-icon">{isVersus ? "⚔" : isAIBattle ? "⌁" : "◉"}</span>
                <h2>{isVersus ? "Two players. One board." : isAIBattle ? "Outlast the hunting pack." : "A clean run starts here."}</h2>
                <p>{isVersus ? "Player 1: WASD · Player 2: arrow keys. A wall, either snake, or your own tail ends the round. Simultaneous crashes are a draw." : isAIBattle ? `${aiBattle.difficulty[0].toUpperCase() + aiBattle.difficulty.slice(1)} AI · four bots pursue your predicted route and compete for food. Survive longer than every bot to win.` : "Collect the food to grow. The walls and your own body end the run."}</p>
                <button type="button" className="snake__primary" onClick={start}>Start run</button>
              </> : currentStatus === "paused" ? <>
                <span className="snake__overlay-icon">Ⅱ</span><h2>Paused</h2><p>The board is still. Resume whenever you’re ready.</p><button type="button" className="snake__primary" onClick={pauseToggle}>Resume</button>
              </> : currentStatus === "gameover" ? <>
                <span className="snake__overlay-icon">{isVersus ? (versus.winner === "draw" ? "＝" : "♛") : isAIBattle && aiBattle.winner === "human" ? "♛" : isAIBattle && aiBattle.winner === null ? "＝" : "×"}</span>
                <h2>{isVersus ? winnerName : isAIBattle ? aiBattle.winner === "human" ? "You outlasted the pack!" : aiBattle.winner ? "The bots got you" : "Everybody crashed!" : "Run complete"}</h2>
                <p>{isVersus ? "The other player’s score and survival decide the winner. Both crashed together? That’s a draw." : isAIBattle ? `Score ${aiBattle.players[0].score} · ${aiBattle.players.filter((player) => !player.alive).length} snakes eliminated · ${aiBattle.difficulty} difficulty` : `Score ${classic.score} · ${DIFFICULTIES[classic.difficulty].label} difficulty`}</p>
                <button type="button" className="snake__primary" onClick={restart}>Play again</button>
              </> : <>
                <span className="snake__overlay-icon">✦</span><h2>Board cleared!</h2><p>You filled every available cell. That was a perfect run.</p><button type="button" className="snake__primary" onClick={restart}>Play again</button>
              </>}
            </section>
          )}
        </div>
      </section>
      <footer className="snake-arcade__bottom">
        <DirectionPad disabled={!isPlaying} onMove={(direction) => steer(direction)} />
        <div className="snake-arcade__footnote">{isVersus ? <><span>P1: <b>W A S D / left Shift</b></span><span>P2: <b>arrows / right Shift</b></span></> : <><span>Steer: <b>Arrow keys / WASD</b></span><span>Hold BOOST: two food for one segment</span></>}</div>
        <div className="snake-arcade__actions">
          {isVersus ? (["one", "two"] as const).map((player) => <button key={player} type="button" className={`snake-arcade__boost ${boostState[player] ? "is-active" : ""}`} aria-pressed={boostState[player]} title="Hold: two food pickups add one segment; score is unchanged." disabled={!isPlaying}
            onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); holdBoost(player, true); }}
            onPointerUp={() => holdBoost(player, false)} onPointerCancel={() => holdBoost(player, false)}
            onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); holdBoost(player, true); } }}
            onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") holdBoost(player, false); }}>{player === "one" ? "P1 BOOST" : "P2 BOOST"}</button>)
            : <button type="button" className={`snake-arcade__boost ${boostState.one ? "is-active" : ""}`} aria-pressed={boostState.one} title="Hold: two food pickups add one segment; score is unchanged." disabled={!isPlaying}
              onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); holdBoost("one", true); }}
              onPointerUp={() => holdBoost("one", false)} onPointerCancel={() => holdBoost("one", false)}
              onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); holdBoost("one", true); } }}
              onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") holdBoost("one", false); }}>BOOST</button>}
          {isPlaying || currentStatus === "paused" ? <button type="button" onClick={pauseToggle}>{isPlaying ? "Pause" : "Resume"}</button> : currentStatus === "ready" ? <button type="button" onClick={start}>Start</button> : null}
          <button type="button" onClick={restart}>Restart</button>
        </div>
      </footer>
      {!isVersus && currentStatus === "gameover" && (
        <div className="snake-arcade__scores" aria-label="Local high scores">
          <strong>HIGH SCORES</strong>          {highScores.map((entry, index) => <span key={`${entry.date}-${index}`}>{index + 1}. {entry.score} <small>{DIFFICULTIES[entry.difficulty].label}</small></span>)}
        </div>
      )}
      <span className="snake-arcade__screenreader" aria-live="polite">Score {score}, length {length}</span>
    </main>
  );
}
