import type { Direction, Point } from "./engine.js";

export type RoomVisibility = "public" | "private";
export type MultiplayerStatus = "waiting" | "playing" | "celebrating" | "gameover";

export interface PlayerSnapshot {
  id: string;
  name: string;
  color: string;
  segments: Point[];
  direction: Direction;
  score: number;
  boosting: boolean;
  online: boolean;
  alive: boolean;
  ready: boolean;
}

export interface RoomSnapshot {
  code: string;
  visibility: RoomVisibility;
  status: MultiplayerStatus;
  hostId: string;
  players: PlayerSnapshot[];
  food: Point;
  specialFood: Point | null;
  winnerId: string | null;
  columns: number;
  rows: number;
}

export interface PublicRoom {
  code: string;
  players: number;
  capacity: number;
  status: MultiplayerStatus;
}

export interface JoinResult {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  snapshot: RoomSnapshot;
}
