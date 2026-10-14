import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Crosshair, DoorOpen, Eye, MousePointer2, RotateCcw, Volume2 } from "lucide-react";
import type { AppProps } from "../../types";
import { OrbitDepthsAvatar } from "./OrbitDepthsAvatar";
import "./OrbitDepths.css";

const MAP = [
  "111111111111",
  "100000000001",
  "101110110101",
  "100010000001",
  "101010101101",
  "100000100001",
  "101101000101",
  "100001010001",
  "101000010101",
  "100110000001",
  "100000110001",
  "111111111111",
];
const FOV = Math.PI / 3;
const EXIT = { x: 10.5, y: 10.5 };
const ENEMY_SPAWNS = [
  { x: 3.5, y: 1.5 }, { x: 8.5, y: 3.5 }, { x: 5.5, y: 8.5 },
  { x: 8.5, y: 10.5 }, { x: 2.5, y: 5.5 }, { x: 9.5, y: 3.5 },
  { x: 2.5, y: 10.5 }, { x: 5.5, y: 5.5 },
];

type GameMode = "ready" | "running" | "won" | "over";
interface Player { x: number; y: number; angle: number; pitch: number; jump: number; jumpVelocity: number; health: number }
interface Enemy { x: number; y: number; alive: boolean; cooldown: number; phase: number; alert: boolean; muzzle: number }
interface Door { x: number; y: number; open: boolean; exit?: boolean }
interface RayHit { distance: number; side: number; door: boolean }
interface Shot { until: number; angle: number; pitch: number; hit: boolean }
interface EnemyProjectile { x: number; y: number; vx: number; vy: number; life: number }

function makePlayer(): Player {
  return { x: 1.5, y: 1.5, angle: 0, pitch: 0, jump: 0, jumpVelocity: 0, health: 100 };
}

function makeEnemies(level: number): Enemy[] {
  const count = Math.min(ENEMY_SPAWNS.length, 3 + level);
  return ENEMY_SPAWNS.slice(0, count).map((enemy, index) => ({ ...enemy, alive: true, cooldown: 0.5 + index * 0.13, phase: index * 2.1, alert: false, muzzle: 0 }));
}

function makeDoors(level: number): Door[] {
  const doors: Door[] = [{ x: 5, y: 1, open: false }, { x: 10, y: 10, open: false, exit: true }];
  if (level >= 2) doors.push({ x: 1, y: 5, open: false });
  if (level >= 3) doors.push({ x: 6, y: 9, open: false });
  return doors;
}

function wallAt(x: number, y: number, doors: Door[]): boolean {
  const mapX = Math.floor(x);
  const mapY = Math.floor(y);
  const closedDoor = doors.some((door) => !door.open && door.x === mapX && door.y === mapY);
  const row = MAP[mapY];
  return closedDoor || !row || row[mapX] !== "0";
}

function castRay(player: Player, angle: number, doors: Door[]): RayHit {
  const rayX = Math.cos(angle);
  const rayY = Math.sin(angle);
  let mapX = Math.floor(player.x);
  let mapY = Math.floor(player.y);
  const deltaX = Math.abs(1 / (rayX || 0.0001));
  const deltaY = Math.abs(1 / (rayY || 0.0001));
  const stepX = rayX < 0 ? -1 : 1;
  const stepY = rayY < 0 ? -1 : 1;
  let sideX = (rayX < 0 ? player.x - mapX : mapX + 1 - player.x) * deltaX;
  let sideY = (rayY < 0 ? player.y - mapY : mapY + 1 - player.y) * deltaY;
  let side = 0;

  for (let step = 0; step < 48; step++) {
    if (sideX < sideY) {
      sideX += deltaX;
      mapX += stepX;
      side = 0;
    } else {
      sideY += deltaY;
      mapY += stepY;
      side = 1;
    }
    const door = doors.some((item) => !item.open && item.x === mapX && item.y === mapY);
    if (door || MAP[mapY]?.[mapX] !== "0") {
      const distance = side === 0 ? sideX - deltaX : sideY - deltaY;
      return { distance: Math.max(0.08, distance * Math.cos(angle - player.angle)), side, door };
    }
  }
  return { distance: 16, side: 0, door: false };
}

function angleDifference(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function drawArmoredEnemy(context: CanvasRenderingContext2D, x: number, y: number, size: number, phase: number, muzzle: number, colors: { armor: string; dark: string; accent: string; visor: string; gun: string }) {
  const bob = Math.sin(phase) * size * 0.025;
  const top = y - size * 0.53 + bob;
  const width = size * 0.72;
  context.save();

  context.fillStyle = colors.dark;
  context.fillRect(x - width * 0.29, top + size * 0.72, width * 0.2, size * 0.3);
  context.fillRect(x + width * 0.09, top + size * 0.72, width * 0.2, size * 0.3);
  context.fillRect(x - width * 0.34, top + size * 0.37, width * 0.68, size * 0.42);

  context.fillStyle = colors.armor;
  context.beginPath();
  context.moveTo(x - width * 0.52, top + size * 0.38);
  context.lineTo(x - width * 0.42, top + size * 0.21);
  context.lineTo(x - width * 0.18, top + size * 0.29);
  context.lineTo(x - width * 0.2, top + size * 0.52);
  context.lineTo(x - width * 0.44, top + size * 0.57);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(x + width * 0.52, top + size * 0.38);
  context.lineTo(x + width * 0.42, top + size * 0.21);
  context.lineTo(x + width * 0.18, top + size * 0.29);
  context.lineTo(x + width * 0.2, top + size * 0.52);
  context.lineTo(x + width * 0.44, top + size * 0.57);
  context.closePath();
  context.fill();

  context.fillStyle = colors.accent;
  context.beginPath();
  context.moveTo(x - width * 0.22, top + size * 0.42);
  context.lineTo(x, top + size * 0.36);
  context.lineTo(x + width * 0.22, top + size * 0.42);
  context.lineTo(x + width * 0.17, top + size * 0.65);
  context.lineTo(x, top + size * 0.71);
  context.lineTo(x - width * 0.17, top + size * 0.65);
  context.closePath();
  context.fill();

  context.fillStyle = colors.armor;
  context.beginPath();
  context.ellipse(x, top + size * 0.2, width * 0.2, size * 0.2, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colors.visor;
  context.fillRect(x - width * 0.14, top + size * 0.18, width * 0.28, size * 0.045);

  context.fillStyle = colors.dark;
  context.fillRect(x + width * 0.2, top + size * 0.48, width * 0.56, size * 0.07);
  context.fillStyle = colors.gun;
  context.fillRect(x + width * 0.58, top + size * 0.45, width * 0.3, size * 0.035);
  context.fillStyle = colors.dark;
  context.fillRect(x + width * 0.42, top + size * 0.54, width * 0.06, size * 0.16);

  if (muzzle > 0) {
    context.globalAlpha = Math.min(1, muzzle * 10);
    context.fillStyle = colors.gun;
    context.beginPath();
    context.arc(x + width * 0.92, top + size * 0.47, size * 0.09, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function OrbitDepths(_props: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player>(makePlayer());
  const enemiesRef = useRef<Enemy[]>(makeEnemies(1));
  const doorsRef = useRef<Door[]>(makeDoors(1));
  const projectilesRef = useRef<EnemyProjectile[]>([]);
  const keysRef = useRef(new Set<string>());
  const modeRef = useRef<GameMode>("ready");
  const levelRef = useRef(1);
  const viewRef = useRef<"first" | "third">("first");
  const shotRef = useRef<Shot | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [mode, setMode] = useState<GameMode>("ready");
  const [level, setLevel] = useState(1);
  const [hostilesLeft, setHostilesLeft] = useState(4);
  const [health, setHealth] = useState(100);
  const [view, setView] = useState<"first" | "third">("first");
  const [mouseLocked, setMouseLocked] = useState(false);
  const [message, setMessage] = useState("Clear the hostiles, open the exit door, and reach the green marker.");

  function setGameMode(next: GameMode) {
    modeRef.current = next;
    setMode(next);
    if (next !== "running" && document.pointerLockElement === canvasRef.current) document.exitPointerLock();
  }

  function playSound(kind: "shot" | "hit" | "door" | "damage" | "level") {
    try {
      const audio = audioRef.current ?? new AudioContext();
      audioRef.current = audio;
      if (audio.state === "suspended") void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const config = {
        shot: { start: 180, end: 58, duration: 0.11, type: "sawtooth" as OscillatorType, volume: 0.08 },
        hit: { start: 540, end: 180, duration: 0.16, type: "square" as OscillatorType, volume: 0.055 },
        door: { start: 130, end: 310, duration: 0.28, type: "triangle" as OscillatorType, volume: 0.07 },
        damage: { start: 120, end: 48, duration: 0.3, type: "sawtooth" as OscillatorType, volume: 0.1 },
        level: { start: 280, end: 780, duration: 0.34, type: "sine" as OscillatorType, volume: 0.065 },
      }[kind];
      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.start, now);
      oscillator.frequency.exponentialRampToValueAtTime(config.end, now + config.duration);
      gain.gain.setValueAtTime(config.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + config.duration);
    } catch {
      // Sound is optional when browser audio is unavailable.
    }
  }

  function startLevel(nextLevel: number) {
    levelRef.current = nextLevel;
    playerRef.current = makePlayer();
    enemiesRef.current = makeEnemies(nextLevel);
    doorsRef.current = makeDoors(nextLevel);
    projectilesRef.current = [];
    keysRef.current.clear();
    shotRef.current = null;
    setLevel(nextLevel);
    setHostilesLeft(enemiesRef.current.length);
    setHealth(100);
    setMessage(`Level ${nextLevel}: clear ${enemiesRef.current.length} hostiles and find the exit.`);
    setGameMode("running");
    canvasRef.current?.focus();
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        const requestLock = canvas.requestPointerLock as unknown as () => void | Promise<void>;
        const result = requestLock.call(canvas);
        if (result) void Promise.resolve(result).catch(() => {});
      } catch {
        // Mouse movement also works without pointer lock.
      }
    }
    playSound("level");
  }

  function interact() {
    if (modeRef.current !== "running") return;
    const player = playerRef.current;
    const door = doorsRef.current
      .filter((item) => !item.open)
      .sort((a, b) => Math.hypot(a.x + 0.5 - player.x, a.y + 0.5 - player.y) - Math.hypot(b.x + 0.5 - player.x, b.y + 0.5 - player.y))[0];
    if (!door || Math.hypot(door.x + 0.5 - player.x, door.y + 0.5 - player.y) > 1.5) {
      setMessage("Move close to a door and press E to open it.");
      return;
    }
    if (door.exit && enemiesRef.current.some((enemy) => enemy.alive)) {
      setMessage("The exit is sealed. Clear every hostile first.");
      return;
    }
    door.open = true;
    playSound("door");
    setMessage(door.exit ? "Exit door open. Move through it to enter the next level." : "Door opened.");
  }

  function fire() {
    if (modeRef.current !== "running") return;
    const player = playerRef.current;
    const now = performance.now();
    let nearest: Enemy | null = null;
    let nearestDistance = Infinity;
    for (const enemy of enemiesRef.current) {
      if (!enemy.alive) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      const relativeAngle = angleDifference(Math.atan2(dy, dx), player.angle);
      const wall = castRay(player, player.angle + relativeAngle, doorsRef.current).distance;
      if (distance < 8 && Math.abs(relativeAngle) < 0.13 && Math.abs(player.pitch) < 0.42 && distance < wall + 0.2 && distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    shotRef.current = { until: now + 190, angle: nearest ? angleDifference(Math.atan2(nearest.y - player.y, nearest.x - player.x), player.angle) : 0, pitch: player.pitch, hit: Boolean(nearest) };
    playSound(nearest ? "hit" : "shot");
    if (nearest) {
      nearest.alive = false;
      const remaining = enemiesRef.current.filter((enemy) => enemy.alive).length;
      setHostilesLeft(remaining);
      setMessage(remaining ? `${remaining} hostile${remaining === 1 ? "" : "s"} remain.` : "Area clear. Find and open the green exit door.");
    } else {
      setMessage("Shot fired. Aim at a hostile and try again.");
    }
  }

  function jump() {
    const player = playerRef.current;
    if (modeRef.current === "running" && player.jump <= 0) player.jumpVelocity = 3.9;
  }

  function toggleView() {
    const next = viewRef.current === "first" ? "third" : "first";
    viewRef.current = next;
    setView(next);
  }

  function toggleMouseLock() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
      return;
    }
    try {
      const requestLock = canvas.requestPointerLock as unknown as () => void | Promise<void>;
      const result = requestLock.call(canvas);
      if (result) void Promise.resolve(result).catch(() => setMessage("Mouse lock was denied. Mouse look still works over the game."));
    } catch {
      setMessage("Mouse lock is unavailable. Mouse look still works over the game.");
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();
    if (event.code === "Space") { event.preventDefault(); jump(); return; }
    if (key === "e") { event.preventDefault(); interact(); return; }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
      event.preventDefault();
      keysRef.current.add(key);
    }
  }

  function handleKeyUp(event: ReactKeyboardEvent<HTMLDivElement>) {
    keysRef.current.delete(event.key.toLowerCase());
  }

  function nudgePlayer(forward: number, strafe: number) {
    if (modeRef.current !== "running") return;
    const player = playerRef.current;
    const doors = doorsRef.current;
    const dx = Math.cos(player.angle) * forward * 0.42 - Math.sin(player.angle) * strafe * 0.42;
    const dy = Math.sin(player.angle) * forward * 0.42 + Math.cos(player.angle) * strafe * 0.42;
    if (!wallAt(player.x + dx + Math.sign(dx) * 0.16, player.y, doors)) player.x += dx;
    if (!wallAt(player.x, player.y + dy + Math.sign(dy) * 0.16, doors)) player.y += dy;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (modeRef.current !== "running") return;
    const player = playerRef.current;
    player.angle += event.movementX * 0.0028;
    player.pitch = clamp(player.pitch - event.movementY * 0.0022, -0.7, 0.7);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    canvasRef.current?.focus();
    fire();
  }

  useEffect(() => {
    const updateLockState = () => setMouseLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener("pointerlockchange", updateLockState);
    return () => document.removeEventListener("pointerlockchange", updateLockState);
  }, []);

  useEffect(() => {
    const isGameFocused = () => stageRef.current?.contains(document.activeElement) || document.pointerLockElement === canvasRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (modeRef.current !== "running" || !isGameFocused()) return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
        keysRef.current.add(key);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvasValue = canvasRef.current;
    if (!canvasValue) return;
    const contextValue = canvasValue.getContext("2d");
    if (!contextValue) return;
    const canvas: HTMLCanvasElement = canvasValue;
    const context: CanvasRenderingContext2D = contextValue;
    const root = getComputedStyle(document.documentElement);
    const colors = {
      sky: root.getPropertyValue("--color-surface").trim(),
      floor: root.getPropertyValue("--color-surface-2").trim(),
      wall: root.getPropertyValue("--color-accent").trim(),
      door: root.getPropertyValue("--color-warning").trim(),
      enemy: root.getPropertyValue("--color-danger").trim(),
      exit: root.getPropertyValue("--color-success").trim(),
      text: root.getPropertyValue("--color-text-dim").trim(),
      armor: root.getPropertyValue("--color-text").trim(),
      dark: root.getPropertyValue("--color-bg").trim(),
      accent: root.getPropertyValue("--color-accent").trim(),
    };
    let frame = 0;
    let previous = 0;
    let width = 0;
    let height = 0;

    function draw(time: number) {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (bounds.width !== width || bounds.height !== height || canvas.width !== Math.round(bounds.width * ratio)) {
        width = bounds.width;
        height = bounds.height;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }

      const dt = previous ? Math.min((time - previous) / 1000, 0.045) : 0;
      previous = time;
      const player = playerRef.current;
      const doors = doorsRef.current;
      const enemies = enemiesRef.current;
      const currentLevel = levelRef.current;

      if (modeRef.current === "running") {
        const keys = keysRef.current;
        const turn = (keys.has("arrowleft") ? -1 : 0) + (keys.has("arrowright") ? 1 : 0);
        const look = (keys.has("arrowup") ? -1 : 0) + (keys.has("arrowdown") ? 1 : 0);
        player.angle += turn * 2.25 * dt;
        player.pitch = clamp(player.pitch + look * 0.9 * dt, -0.7, 0.7);

        const forward = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
        const strafe = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
        const moveSpeed = keys.has("shift") ? 4 : 2.65;
        const dx = (Math.cos(player.angle) * forward - Math.sin(player.angle) * strafe) * moveSpeed * dt;
        const dy = (Math.sin(player.angle) * forward + Math.cos(player.angle) * strafe) * moveSpeed * dt;
        if (!wallAt(player.x + dx + Math.sign(dx) * 0.17, player.y, doors)) player.x += dx;
        if (!wallAt(player.x, player.y + dy + Math.sign(dy) * 0.17, doors)) player.y += dy;

        player.jumpVelocity -= 9.2 * dt;
        player.jump = Math.max(0, player.jump + player.jumpVelocity * dt);
        if (player.jump === 0) player.jumpVelocity = 0;

        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          enemy.cooldown -= dt;
          enemy.muzzle = Math.max(0, enemy.muzzle - dt);
          enemy.phase += dt * (3 + currentLevel * 0.35);
          const toPlayerX = player.x - enemy.x;
          const toPlayerY = player.y - enemy.y;
          const distance = Math.hypot(toPlayerX, toPlayerY);
          const seeRange = 6.5 + currentLevel * 1.7;
          const visible = distance < seeRange && castRay(player, Math.atan2(toPlayerY, toPlayerX), doors).distance + 0.3 >= distance;
          if (visible) enemy.alert = true;

          if (enemy.alert && distance > 0.86) {
            const speed = 0.38 + Math.min(currentLevel, 6) * 0.105;
            const moveX = (toPlayerX / Math.max(distance, 0.01)) * speed * dt;
            const moveY = (toPlayerY / Math.max(distance, 0.01)) * speed * dt;
            if (!wallAt(enemy.x + moveX + Math.sign(moveX) * 0.18, enemy.y, doors)) enemy.x += moveX;
            else if (!wallAt(enemy.x, enemy.y + moveY + Math.sign(moveY) * 0.18, doors)) enemy.y += moveY;
          }
          if (enemy.alert && distance < seeRange && enemy.cooldown <= 0) {
            enemy.cooldown = Math.max(0.62, 1.65 - currentLevel * 0.11);
            enemy.muzzle = 0.14;
            const speed = 3.7 + Math.min(currentLevel, 6) * 0.28;
            const safeDistance = Math.max(distance, 0.01);
            projectilesRef.current.push({ x: enemy.x, y: enemy.y, vx: toPlayerX / safeDistance * speed, vy: toPlayerY / safeDistance * speed, life: 3.2 });
          }
        }

        const activeProjectiles: EnemyProjectile[] = [];
        let tookDamage = false;
        for (const projectile of projectilesRef.current) {
          const x = projectile.x + projectile.vx * dt;
          const y = projectile.y + projectile.vy * dt;
          projectile.life -= dt;
          if (projectile.life <= 0 || wallAt(x, y, doors)) continue;
          if (!tookDamage && player.jump < 0.55 && Math.hypot(x - player.x, y - player.y) < 0.26) {
            tookDamage = true;
            player.health = Math.max(0, player.health - Math.min(24, 8 + currentLevel * 2));
            setHealth(player.health);
            playSound("damage");
            setMessage(player.health > 0 ? "Hostile strike. Keep moving." : "You were overrun. Start the level again.");
            if (player.health === 0) setGameMode("over");
            continue;
          }
          projectile.x = x;
          projectile.y = y;
          activeProjectiles.push(projectile);
        }
        projectilesRef.current = activeProjectiles;

        const exitDoor = doors.find((door) => door.exit);
        if (exitDoor?.open && Math.hypot(player.x - EXIT.x, player.y - EXIT.y) < 0.72) {
          setMessage(`Level ${currentLevel} complete. Next level has faster, more alert hostiles.`);
          setGameMode("won");
          playSound("level");
        }
      }

      let camera = player;
      if (viewRef.current === "third") {
        const cameraX = player.x - Math.cos(player.angle) * 1.18;
        const cameraY = player.y - Math.sin(player.angle) * 1.18;
        if (!wallAt(cameraX, cameraY, doors)) camera = { ...player, x: cameraX, y: cameraY };
      }
      const horizon = clamp(height / 2 + player.pitch * height * 0.42 + player.jump * 32, height * 0.18, height * 0.82);
      const sky = context.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, colors.sky);
      sky.addColorStop(1, colors.floor);
      context.fillStyle = sky;
      context.fillRect(0, 0, width, horizon);
      const floor = context.createLinearGradient(0, horizon, 0, height);
      floor.addColorStop(0, colors.floor);
      floor.addColorStop(1, colors.sky);
      context.fillStyle = floor;
      context.fillRect(0, horizon, width, height - horizon);

      context.save();
      context.globalAlpha = 0.11;
      context.strokeStyle = colors.text;
      context.lineWidth = 1;
      for (let line = 1; line <= 9; line++) {
        const depth = line / 9;
        const y = horizon + (height - horizon) * depth * depth;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      for (let line = -6; line <= 6; line++) {
        context.beginPath();
        context.moveTo(width / 2, horizon);
        context.lineTo(width / 2 + line * width * 0.12, height);
        context.stroke();
      }
      context.globalAlpha = 0.24;
      for (let light = 0; light < 5; light++) {
        const x = width * (light + 1) / 6;
        context.fillStyle = light % 2 ? colors.exit : colors.door;
        context.fillRect(x - 10, Math.max(4, horizon * 0.08), 20, 3);
      }
      context.restore();

      for (let star = 0; star < 26; star++) {
        const x = (star * 103 + width / 2 - player.angle * 95) % width;
        const wrappedX = (x + width) % width;
        const y = 10 + ((star * 41) % Math.max(18, horizon - 30));
        context.globalAlpha = 0.2 + (star % 3) * 0.12;
        context.fillStyle = colors.text;
        context.fillRect(wrappedX, y, 1.5, 1.5);
      }
      context.globalAlpha = 1;

      const columnWidth = 2;
      const depth: number[] = [];
      for (let screenX = 0; screenX < width; screenX += columnWidth) {
        const angle = player.angle + (screenX / width - 0.5) * FOV;
        const hit = castRay(camera, angle, doors);
        depth[Math.floor(screenX / columnWidth)] = hit.distance;
        const wallHeight = Math.min(height * 1.7, height / hit.distance);
        const top = horizon - wallHeight / 2;
        const shade = Math.max(0.12, 1 - hit.distance / 10) * (hit.side ? 0.63 : 1);
        context.globalAlpha = shade;
        context.fillStyle = hit.door ? colors.door : colors.dark;
        context.fillRect(screenX, top, columnWidth + 1, wallHeight);
        if (hit.door) {
          context.globalAlpha = shade * 0.58;
          context.fillStyle = colors.text;
          const doorSeam = Math.floor((screenX + hit.side * 8) % 18);
          if (doorSeam < 2 || doorSeam > 15) context.fillRect(screenX, top, 1, wallHeight);
          if (doorSeam === 8) context.fillRect(screenX, top + wallHeight * 0.48, columnWidth, 3);
        } else {
          const panelWidth = Math.max(44, width / 12);
          const panelPosition = (screenX + Math.floor(hit.distance * 6) + hit.side * 17) % panelWidth;
          context.globalAlpha = shade * 0.42;
          context.fillStyle = colors.door;
          if (panelPosition > 4 && panelPosition < panelWidth - 4) {
            context.fillRect(screenX, top + wallHeight * 0.09, columnWidth + 1, wallHeight * 0.82);
          }
          context.globalAlpha = shade * 0.48;
          context.fillStyle = colors.text;
          if (panelPosition < 2 || panelPosition > panelWidth - 3) context.fillRect(screenX, top, 1, wallHeight);
          context.fillStyle = colors.door;
          if (panelPosition < 2) {
            context.fillRect(screenX, top + wallHeight * 0.16, columnWidth, Math.max(1, wallHeight * 0.012));
            context.fillRect(screenX, top + wallHeight * 0.82, columnWidth, Math.max(1, wallHeight * 0.012));
          }
        }
      }
      context.globalAlpha = 1;

      const visibleEnemies = enemies
        .filter((enemy) => enemy.alive)
        .map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - camera.x, enemy.y - camera.y), angle: angleDifference(Math.atan2(enemy.y - camera.y, enemy.x - camera.x), camera.angle) }))
        .filter(({ angle }) => Math.abs(angle) < FOV / 2)
        .sort((a, b) => b.distance - a.distance);
      for (const { enemy, distance, angle } of visibleEnemies) {
        const screenX = width / 2 + (angle / FOV) * width;
        if ((depth[Math.floor(screenX / columnWidth)] ?? 0) < distance) continue;
        const size = Math.min(height * 0.8, height / distance * 0.4);
        const centerY = horizon + size * 0.1 + Math.sin(enemy.phase) * 3;
        const glow = context.createRadialGradient(screenX, centerY, 2, screenX, centerY, size * 0.6);
        glow.addColorStop(0, colors.enemy);
        glow.addColorStop(1, "transparent");
        context.globalAlpha = Math.max(0.25, 0.75 - distance / 15);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(screenX, centerY, size * 0.6, 0, Math.PI * 2);
        context.fill();
        drawArmoredEnemy(context, screenX, centerY, size, enemy.phase, enemy.muzzle, { armor: colors.armor, dark: colors.dark, accent: colors.enemy, visor: colors.exit, gun: colors.door });
        context.globalAlpha = 1;
      }

      for (const projectile of projectilesRef.current) {
        const distance = Math.hypot(projectile.x - camera.x, projectile.y - camera.y);
        const angle = angleDifference(Math.atan2(projectile.y - camera.y, projectile.x - camera.x), camera.angle);
        if (Math.abs(angle) >= FOV / 2) continue;
        const screenX = width / 2 + (angle / FOV) * width;
        if ((depth[Math.floor(screenX / columnWidth)] ?? 0) < distance) continue;
        const size = Math.max(3, Math.min(13, height / Math.max(distance, 0.1) * 0.045));
        const screenY = horizon + size * 1.5;
        context.save();
        context.shadowBlur = 14;
        context.shadowColor = colors.enemy;
        context.fillStyle = colors.enemy;
        context.beginPath();
        context.arc(screenX, screenY, size, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      const shot = shotRef.current;
      if (shot && shot.until > time) {
        const targetX = width / 2 + (shot.angle / FOV) * width;
        const targetY = horizon - shot.pitch * height * 0.28;
        context.save();
        context.globalAlpha = Math.min(1, (shot.until - time) / 95);
        context.strokeStyle = shot.hit ? colors.exit : colors.door;
        context.lineWidth = shot.hit ? 4 : 2;
        context.shadowBlur = 12;
        context.shadowColor = context.strokeStyle;
        context.beginPath();
        context.moveTo(width / 2, height * 0.88);
        context.lineTo(targetX, targetY);
        context.stroke();
        context.restore();
      } else {
        shotRef.current = null;
      }

      if (viewRef.current !== "third") {
        context.fillStyle = colors.dark;
        context.beginPath();
        context.moveTo(width / 2 - 35, height);
        context.lineTo(width / 2 - 23, height * 0.84);
        context.lineTo(width / 2 + 23, height * 0.84);
        context.lineTo(width / 2 + 35, height);
        context.closePath();
        context.fill();
        context.fillStyle = colors.door;
        context.fillRect(width / 2 - 10, height * 0.84, 20, height * 0.16);
        context.fillStyle = colors.wall;
        context.fillRect(width / 2 - 3, height * 0.88, 6, height * 0.11);
      }

      context.strokeStyle = colors.text;
      context.globalAlpha = shot && shot.until > time ? 1 : 0.7;
      context.lineWidth = shot && shot.until > time ? 2 : 1;
      context.beginPath();
      context.moveTo(width / 2 - 7, horizon);
      context.lineTo(width / 2 + 7, horizon);
      context.moveTo(width / 2, horizon - 7);
      context.lineTo(width / 2, horizon + 7);
      context.stroke();
      context.globalAlpha = 1;

      const mini = Math.min(8, width / 18);
      const mapWidth = MAP[0].length * mini;
      const mapX = width - mapWidth - 10;
      const mapY = 10;
      context.globalAlpha = 0.76;
      context.fillStyle = colors.sky;
      context.fillRect(mapX - 4, mapY - 4, mapWidth + 8, MAP.length * mini + 8);
      MAP.forEach((row, y) => [...row].forEach((cell, x) => {
        context.fillStyle = cell === "1" ? colors.wall : colors.floor;
        context.fillRect(mapX + x * mini, mapY + y * mini, mini - 1, mini - 1);
      }));
      for (const door of doors) {
        context.fillStyle = door.open ? colors.exit : colors.door;
        context.fillRect(mapX + door.x * mini, mapY + door.y * mini, mini - 1, mini - 1);
      }
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        context.fillStyle = colors.enemy;
        context.fillRect(mapX + enemy.x * mini - 2, mapY + enemy.y * mini - 2, 4, 4);
      }
      context.fillStyle = colors.text;
      context.beginPath();
      context.arc(mapX + player.x * mini, mapY + player.y * mini, 3, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = colors.text;
      context.beginPath();
      context.moveTo(mapX + player.x * mini, mapY + player.y * mini);
      context.lineTo(mapX + (player.x + Math.cos(player.angle) * 0.8) * mini, mapY + (player.y + Math.sin(player.angle) * 0.8) * mini);
      context.stroke();
      context.globalAlpha = 1;

      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  const overlayTitle = mode === "won" ? `Level ${level} cleared` : mode === "over" ? "Mission failed" : "Orbit Depths";

  return (
    <main className="orbit-depths">
      <header className="orbit-depths__header">
        <div><span className="orbit-depths__eyebrow">ORBIT ARCADE · ORIGINAL</span><h2>Orbit Depths</h2></div>
        <div className="orbit-depths__stats" aria-live="polite">
          <div><span>Level</span><strong>{level}</strong></div>
          <div><span>Hostiles</span><strong>{hostilesLeft}</strong></div>
          <div><span>Health</span><strong>{health}%</strong></div>
        </div>
      </header>
      <div className="orbit-depths__tools">
        <button type="button" onClick={toggleView} aria-pressed={view === "third"} title="Switch camera perspective">
          <Eye size={14} /> {view === "third" ? "Third person" : "First person"}
        </button>
        <button type="button" onClick={toggleMouseLock} aria-pressed={mouseLocked} title="Lock or release the mouse">
          <MousePointer2 size={14} /> {mouseLocked ? "Unlock mouse" : "Lock mouse"}
        </button>
      </div>
      <p className="orbit-depths__message" aria-live="polite">{message}</p>
      <div ref={stageRef} className={`orbit-depths__stage ${mode === "running" ? "orbit-depths__stage--running" : ""}`} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onPointerMove={handlePointerMove} onPointerDown={handlePointerDown}>
        <canvas ref={canvasRef} tabIndex={0} className="orbit-depths__canvas" aria-label="Orbit Depths. Mouse to look, WASD to move, left click to fire, Space to jump, E to open doors." />
        {view === "third" && <OrbitDepthsAvatar player={playerRef} visible />}
        {mode !== "running" && <div className="orbit-depths__overlay">
          <Crosshair size={28} aria-hidden="true" />
          <strong>{overlayTitle}</strong>
          <span>{mode === "won" ? "Your next level has smarter, faster hostiles." : mode === "over" ? "Jump and keep moving when hostiles close in." : "Move with WASD. Look with the mouse. Clear hostiles, open doors, and reach the exit."}</span>
          <button type="button" onClick={() => startLevel(mode === "won" ? level + 1 : level)}>
            <RotateCcw size={14} />{mode === "won" ? "Next level" : mode === "over" ? "Retry level" : "Enter maze"}
          </button>
        </div>}
      </div>
      <footer className="orbit-depths__controls">
        <div className="orbit-depths__keys">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span>
          <span><kbd>Mouse</kbd> Look</span>
          <span><kbd>Left click</kbd> Fire</span>
          <span><kbd>Space</kbd> Jump</span>
          <span><kbd>E</kbd> Open door</span>
        </div>
        <div className="orbit-depths__touch">
          <button type="button" onClick={() => nudgePlayer(1, 0)} aria-label="Move forward">↑</button>
          <button type="button" onClick={() => nudgePlayer(0, -1)} aria-label="Strafe left">←</button>
          <button type="button" onClick={() => nudgePlayer(-1, 0)} aria-label="Move backward">↓</button>
          <button type="button" onClick={() => nudgePlayer(0, 1)} aria-label="Strafe right">→</button>
          <button className="orbit-depths__fire" type="button" onClick={fire} aria-label="Fire"><Crosshair size={16} /></button>
          <button className="orbit-depths__jump" type="button" onClick={jump} aria-label="Jump">Jump</button>
          <button className="orbit-depths__door" type="button" onClick={interact} aria-label="Open nearby door"><DoorOpen size={15} /></button>
        </div>
        <span className="orbit-depths__sound" title="Game sounds enabled"><Volume2 size={14} aria-label="Game sounds" /></span>
      </footer>
    </main>
  );
}