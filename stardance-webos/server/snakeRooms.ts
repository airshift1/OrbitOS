import { randomBytes, randomUUID } from "node:crypto";
import type { Direction, Point } from "../src/apps/Snake/engine.js";
import { addFoodGrowth } from "../src/apps/Snake/motion.js";
import type { JoinResult, MultiplayerStatus, PublicRoom, RoomSnapshot, RoomVisibility } from "../src/apps/Snake/multiplayerTypes.js";

export const WORLD_COLUMNS = 60;
export const WORLD_ROWS = 40;
export const ROOM_CAPACITY = 8;
export const WINNING_SCORE = 67;
export const DISCONNECT_GRACE_MS = 45_000;
export const ROOM_TTL_MS = 3 * 60_000;

interface Player {
  id: string;
  name: string;
  color: string;
  segments: Point[];
  direction: Direction;
  nextDirection: Direction | null;
  score: number;
  growthProgress: number;
  boosting: boolean;
  online: boolean;
  alive: boolean;
  ready: boolean;
  reconnectToken: string;
  disconnectedAt: number | null;
}

interface Room {
  code: string;
  visibility: RoomVisibility;
  createdAt: number;
  lastActivityAt: number;
  nextMoveAt: number;
  hostId: string;
  status: MultiplayerStatus;
  players: Player[];
  food: Point;
  specialFood: Point | null;
  totalCollected: number;
  celebrationEndsAt: number | null;
  winnerId: string | null;
}

const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];
const VECTOR: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};
const PLAYER_COLORS = ["#a783e6", "#35a9ce", "#ed7199", "#56ab78", "#e6a53d", "#787be0", "#d57bc2", "#d16e5c"];
const SPAWNS: Array<{ x: number; y: number; direction: Direction }> = [
  { x: 30, y: 20, direction: "left" },
  { x: 40, y: 23, direction: "right" },
  { x: 30, y: 28, direction: "down" },
  { x: 40, y: 12, direction: "up" },
  { x: 20, y: 10, direction: "left" },
  { x: 48, y: 30, direction: "right" },
  { x: 12, y: 30, direction: "left" },
  { x: 48, y: 10, direction: "right" },
];

export function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && DIRECTIONS.includes(value as Direction);
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function validRoomCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9]{6}$/.test(value);
}

function sanitizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = Array.from(value.trim())
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .slice(0, 20)
    .join("");
  return name.length > 0 ? name : null;
}

export class SnakeRoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly connections = new Map<string, { roomCode: string; playerId: string }>();
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(now = Date.now, random = Math.random) {
    this.now = now;
    this.random = random;
  }

  createRoom(connectionId: string, rawName: unknown, visibility: unknown): JoinResult | null {
    const name = sanitizeName(rawName);
    if (!name || (visibility !== "public" && visibility !== "private") || this.rooms.size >= 100) return null;
    const code = this.makeRoomCode();
    const room: Room = {
      code,
      visibility,
      createdAt: this.now(),
      lastActivityAt: this.now(),
      nextMoveAt: this.now() + 240,
      hostId: "",
      status: "waiting",
      players: [],
      food: { x: 0, y: 0 },
      specialFood: null,
      totalCollected: 0,
      celebrationEndsAt: null,
      winnerId: null,
    };
    const player = this.makePlayer(name, room.players.length, true);
    room.hostId = player.id;
    room.players.push(player);
    room.food = this.spawnFood(room);
    this.rooms.set(code, room);
    this.connections.set(connectionId, { roomCode: code, playerId: player.id });
    return this.joinResult(room, player);
  }

  joinRoom(connectionId: string, rawCode: unknown, rawName: unknown, reconnectToken?: unknown): JoinResult | null {
    if (!validRoomCode(rawCode)) return null;
    const room = this.rooms.get(rawCode);
    if (!room) return null;

    if (typeof reconnectToken === "string") {
      const existing = room.players.find((player) => player.reconnectToken === reconnectToken);
      if (existing && room.status !== "gameover") {
        const name = sanitizeName(rawName);
        if (name) existing.name = name;
        for (const [previousConnection, membership] of this.connections) {
          if (membership.roomCode === room.code && membership.playerId === existing.id) {
            this.connections.delete(previousConnection);
          }
        }
        existing.online = true;
        existing.disconnectedAt = null;
        this.connections.set(connectionId, { roomCode: room.code, playerId: existing.id });
        room.lastActivityAt = this.now();
        return this.joinResult(room, existing);
      }
    }

    const name = sanitizeName(rawName);
    if (!name || room.status !== "waiting" || room.players.length >= ROOM_CAPACITY) return null;
    const player = this.makePlayer(name, room.players.length, false);
    room.players.push(player);
    room.lastActivityAt = this.now();
    this.connections.set(connectionId, { roomCode: room.code, playerId: player.id });
    return this.joinResult(room, player);
  }

  listPublicRooms(): PublicRoom[] {
    return [...this.rooms.values()]
      .filter((room) => room.visibility === "public" && room.status === "waiting")
      .map((room) => ({ code: room.code, players: room.players.filter((player) => player.online).length, capacity: ROOM_CAPACITY, status: room.status }));
  }

  startRoom(connectionId: string): boolean {
    const membership = this.connections.get(connectionId);
    const room = membership && this.rooms.get(membership.roomCode);
    const onlinePlayers = room?.players.filter((player) => player.online) ?? [];
    if (!room || membership.playerId !== room.hostId || room.status !== "waiting" || onlinePlayers.length < 2 || onlinePlayers.some((player) => !player.ready)) return false;
    room.status = "playing";
    room.nextMoveAt = this.now() + 240;
    room.lastActivityAt = this.now();
    return true;
  }

  rematch(connectionId: string): boolean {
    const membership = this.connections.get(connectionId);
    const room = membership && this.rooms.get(membership.roomCode);
    if (!room || membership.playerId !== room.hostId || room.status !== "gameover" || room.players.filter((player) => player.online).length < 2) return false;
    room.players.forEach((player, index) => {
      const spawn = SPAWNS[index];
      const delta = VECTOR[spawn.direction];
      player.segments = [0, 1, 2].map((offset) => ({ x: spawn.x - delta.x * offset, y: spawn.y - delta.y * offset }));
      player.direction = spawn.direction;
      player.nextDirection = null;
      player.score = 0;
      player.growthProgress = 0;
      player.boosting = false;
      player.alive = player.online;
      player.ready = player.id === room.hostId;
    });
    room.status = "waiting";
    room.winnerId = null;
    room.totalCollected = 0;
    room.celebrationEndsAt = null;
    room.food = { x: -1, y: -1 };
    room.specialFood = null;
    room.food = this.spawnFood(room);
    room.lastActivityAt = this.now();
    return true;
  }

  setDirection(connectionId: string, direction: unknown): boolean {
    const membership = this.connections.get(connectionId);
    const room = membership && this.rooms.get(membership.roomCode);
    const player = room?.players.find(({ id }) => id === membership?.playerId);
    if (!player || room?.status !== "playing" || !player.alive || !player.online || !isDirection(direction)) return false;
    const current = player.nextDirection ?? player.direction;
    if (direction === current || OPPOSITE[current] === direction || (player.nextDirection !== null && direction === player.direction)) return false;
    player.nextDirection = direction;
    return true;
  }

  setBoost(connectionId: string, active: unknown): boolean {
    if (typeof active !== "boolean") return false;
    const membership = this.connections.get(connectionId);
    const room = membership && this.rooms.get(membership.roomCode);
    const player = room?.players.find(({ id }) => id === membership?.playerId);
    if (!player || !player.online || (active && (room?.status !== "playing" || !player.alive))) return false;
    player.boosting = active;
    return true;
  }

  setReady(connectionId: string, ready: unknown): boolean {
    if (typeof ready !== "boolean") return false;
    const membership = this.connections.get(connectionId);
    const room = membership && this.rooms.get(membership.roomCode);
    const player = room?.players.find(({ id }) => id === membership?.playerId);
    if (!room || room.status !== "waiting" || !player?.online) return false;
    player.ready = ready;
    room.lastActivityAt = this.now();
    return true;
  }

  leave(connectionId: string): string | null {
    const membership = this.connections.get(connectionId);
    if (!membership) return null;
    const room = this.rooms.get(membership.roomCode);
    this.connections.delete(connectionId);
    if (!room) return null;
    room.players = room.players.filter(({ id }) => id !== membership.playerId);
    if (room.hostId === membership.playerId && room.players.length > 0) {
      room.hostId = room.players.find((player) => player.online)?.id ?? room.players[0].id;
    }
    if (room.players.length === 0) this.rooms.delete(room.code);
    return room.code;
  }

  disconnect(connectionId: string): string | null {
    const membership = this.connections.get(connectionId);
    if (!membership) return null;
    this.connections.delete(connectionId);
    const room = this.rooms.get(membership.roomCode);
    const player = room?.players.find(({ id }) => id === membership.playerId);
    if (!room || !player) return null;
    player.online = false;
    player.disconnectedAt = this.now();
    player.boosting = false;
    room.lastActivityAt = this.now();
    if (room.status === "waiting" && room.hostId === player.id) {
      room.hostId = room.players.find((candidate) => candidate.online)?.id ?? player.id;
    }
    return room.code;
  }

  roomForConnection(connectionId: string): string | null {
    return this.connections.get(connectionId)?.roomCode ?? null;
  }

  snapshot(roomCode: string): RoomSnapshot | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      code: room.code,
      visibility: room.visibility,
      status: room.status,
      hostId: room.hostId,
      players: room.players.map(({ id, name, color, segments, direction, score, boosting, online, alive, ready }) => ({
        id, name, color, segments: segments.map(({ x, y }) => ({ x, y })), direction, score, boosting, online, alive, ready,
      })),
      food: { ...room.food },
      specialFood: room.specialFood ? { ...room.specialFood } : null,
      winnerId: room.winnerId,
      columns: WORLD_COLUMNS,
      rows: WORLD_ROWS,
    };
  }

  tick(): string[] {
    const changed: string[] = [];
    const now = this.now();
    for (const [code, room] of this.rooms) {
      let didChange = false;
      for (const player of room.players) {
        if (!player.online && player.disconnectedAt !== null && now - player.disconnectedAt >= DISCONNECT_GRACE_MS && player.alive) {
          player.alive = false;
          didChange = true;
        }
      }
      const allDisconnected = room.players.every((player) => !player.online);
      if (
        room.players.length === 0 ||
        (allDisconnected && now - room.lastActivityAt >= DISCONNECT_GRACE_MS) ||
        (room.status !== "playing" && now - room.createdAt >= ROOM_TTL_MS)
      ) {
        this.rooms.delete(code);
        changed.push(code);
        continue;
      }
      if (room.status === "playing" && now >= room.nextMoveAt) {
        this.advanceRoom(room);
        const fastestScore = Math.max(0, ...room.players.map((player) => player.score));
        room.nextMoveAt = now + Math.max(125, 240 - fastestScore * 1.5);
        didChange = true;
      } else if (room.status === "celebrating" && room.celebrationEndsAt !== null && now >= room.celebrationEndsAt) {
        room.status = "playing";
        room.celebrationEndsAt = null;
        room.nextMoveAt = now + 240;
        didChange = true;
      }
      if (didChange) {
        room.lastActivityAt = now;
        changed.push(code);
      }
    }
    return changed;
  }

  private advanceRoom(room: Room): void {
    const activePlayers = room.players.filter((player) => player.alive && player.online);
    if (activePlayers.length === 0) {
      room.status = "gameover";
      return;
    }

    const moves = activePlayers.map((player) => {
      const direction = player.nextDirection ?? player.direction;
      const vector = VECTOR[direction];
      return { player, direction, head: { x: player.segments[0].x + vector.x, y: player.segments[0].y + vector.y } };
    });
    const eaten = new Set<string>();
    const collisions = new Set<string>();
    for (const move of moves) {
      const { player, head } = move;
      const bodyCollision = activePlayers.some((other) => {
        const otherHead = moves.find((candidate) => candidate.player.id === other.id)?.head;
        const otherCollects = otherHead !== undefined &&
          (samePoint(otherHead, room.food) || (room.specialFood !== null && samePoint(otherHead, room.specialFood)));
        const otherWillGrow = otherCollects && addFoodGrowth(other.growthProgress, other.boosting).grow;
        const body = otherWillGrow ? other.segments : other.segments.slice(0, -1);
        return body.some((segment) => samePoint(segment, head));
      });
      const sameHead = moves.filter((other) => samePoint(other.head, head)).length > 1;
      const headSwap = moves.some((other) => other.player.id !== player.id && samePoint(other.head, player.segments[0]) && samePoint(head, other.player.segments[0]));
      if (head.x < 0 || head.x >= WORLD_COLUMNS || head.y < 0 || head.y >= WORLD_ROWS || bodyCollision || sameHead || headSwap) {
        collisions.add(player.id);
      }
    }

    for (const move of moves) {
      const { player, direction, head } = move;
      const collecting = samePoint(head, room.food) || (room.specialFood !== null && samePoint(head, room.specialFood));
      const growth = collecting ? addFoodGrowth(player.growthProgress, player.boosting) : { grow: false, progress: player.growthProgress };
      if (collisions.has(player.id)) {
        player.alive = false;
        continue;
      }
      player.direction = direction;
      player.nextDirection = null;
      player.segments = [head, ...player.segments];
      if (collecting) {
        eaten.add(player.id);
        player.score += 1;
        room.totalCollected += 1;
        player.growthProgress = growth.progress;
        if (!growth.grow) player.segments.pop();
        if (player.score >= WINNING_SCORE) {
          room.winnerId = player.id;
          room.status = "gameover";
        }
      } else {
        player.segments.pop();
      }
    }

    if (room.status === "gameover") return;
    const alive = room.players.filter((player) => player.alive && player.online);
    if (alive.length <= 1 && room.players.length > 1) {
      room.winnerId = alive[0]?.id ?? null;
      room.status = "gameover";
      return;
    }

    if (eaten.size > 0) {
      const ateSpecial = room.specialFood !== null && [...eaten].some((id) => {
        const player = room.players.find(({ id: playerId }) => playerId === id);
        return player && samePoint(moves.find((move) => move.player.id === id)!.head, room.specialFood!);
      });
      if (ateSpecial) room.specialFood = null;
      room.food = this.spawnFood(room);
      if (ateSpecial) {
        room.status = "celebrating";
        room.celebrationEndsAt = this.now() + 3000;
      } else if (room.totalCollected > 0 && room.totalCollected % 25 === 0) {
        room.specialFood = this.spawnFood(room);
      }
    }
  }

  private spawnFood(room: Room): Point {
    const occupied = new Set(room.players.flatMap(({ segments }) => segments.map(({ x, y }) => `${x},${y}`)));
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const point = { x: Math.floor(this.random() * WORLD_COLUMNS), y: Math.floor(this.random() * WORLD_ROWS) };
      if (!occupied.has(`${point.x},${point.y}`) && !samePoint(point, room.food) && !(room.specialFood && samePoint(point, room.specialFood))) return point;
    }
    for (let y = 0; y < WORLD_ROWS; y += 1) {
      for (let x = 0; x < WORLD_COLUMNS; x += 1) {
        const point = { x, y };
        if (!occupied.has(`${x},${y}`) && !samePoint(point, room.food) && !(room.specialFood && samePoint(point, room.specialFood))) return point;
      }
    }
    return { x: 0, y: 0 };
  }

  private makePlayer(name: string, index: number, ready: boolean): Player {
    const spawn = SPAWNS[index];
    const delta = VECTOR[spawn.direction];
    return {
      id: randomUUID(),
      name,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      segments: [0, 1, 2].map((offset) => ({ x: spawn.x - delta.x * offset, y: spawn.y - delta.y * offset })),
      direction: spawn.direction,
      nextDirection: null,
      score: 0,
      growthProgress: 0,
      boosting: false,
      online: true,
      alive: true,
      ready,
      reconnectToken: randomBytes(24).toString("base64url"),
      disconnectedAt: null,
    };
  }

  private joinResult(room: Room, player: Player): JoinResult {
    return { roomCode: room.code, playerId: player.id, reconnectToken: player.reconnectToken, snapshot: this.snapshot(room.code)! };
  }

  private makeRoomCode(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("Unable to allocate a unique room code");
  }
}
