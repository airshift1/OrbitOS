import type { Direction } from "../src/apps/Snake/engine.js";

export type ClientMessage =
  | { type: "rooms" }
  | { type: "create"; name: string; visibility: "public" | "private" }
  | { type: "join"; roomCode: string; name: string; reconnectToken?: string }
  | { type: "start" }
  | { type: "rematch" }
  | { type: "direction"; direction: Direction }
  | { type: "boost"; active: boolean }
  | { type: "ready"; ready: boolean }
  | { type: "leave" };

export type ProtocolResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; code: string; message: string };

const DIRECTIONS = new Set<Direction>(["up", "right", "down", "left"]);
const ROOM_CODE = /^[A-Z0-9]{6}$/;

function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && DIRECTIONS.has(value as Direction);
}

function isRoomCode(value: unknown): value is string {
  return typeof value === "string" && ROOM_CODE.test(value);
}

function validName(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    Array.from(value.trim()).length <= 20 &&
    Array.from(value.trim()).every((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    });
}

export function parseClientMessage(raw: string): ProtocolResult {
  if (raw.length > 4096) return { ok: false, code: "message_too_large", message: "The message is too large." };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid_json", message: "The message was not valid JSON." };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_message", message: "The message format is invalid." };
  }
  const request = value as Record<string, unknown>;
  switch (request.type) {
    case "rooms": return { ok: true, message: { type: "rooms" } };
    case "create":
      if (!validName(request.name) || (request.visibility !== "public" && request.visibility !== "private")) break;
      return { ok: true, message: { type: "create", name: request.name.trim(), visibility: request.visibility } };
    case "join":
      if (!isRoomCode(request.roomCode) || !validName(request.name)) break;
      if (request.reconnectToken !== undefined && (typeof request.reconnectToken !== "string" || request.reconnectToken.length > 128)) break;
      return {
        ok: true,
        message: {
          type: "join",
          roomCode: request.roomCode,
          name: request.name.trim(),
          ...(typeof request.reconnectToken === "string" ? { reconnectToken: request.reconnectToken } : {}),
        },
      };
    case "start": return { ok: true, message: { type: "start" } };
    case "rematch": return { ok: true, message: { type: "rematch" } };
    case "leave": return { ok: true, message: { type: "leave" } };
    case "direction":
      if (!isDirection(request.direction)) break;
      return { ok: true, message: { type: "direction", direction: request.direction } };
    case "boost":
      if (typeof request.active !== "boolean") break;
      return { ok: true, message: { type: "boost", active: request.active } };
    case "ready":
      if (typeof request.ready !== "boolean") break;
      return { ok: true, message: { type: "ready", ready: request.ready } };
  }
  return { ok: false, code: "invalid_message", message: "The message action or its fields are invalid." };
}
