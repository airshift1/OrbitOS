import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { SnakeRoomManager } from "./snakeRooms.js";
import { parseClientMessage } from "./multiplayerProtocol.js";

const port = Number(process.env.PORT ?? 8080);
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  throw new Error("ALLOWED_ORIGINS must be set before starting the multiplayer server in production.");
}
const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);
const rooms = new SnakeRoomManager();
const clients = new Map<string, WebSocket>();
const counters = new Map<string, { startedAt: number; count: number }>();
let connectionCounter = 0;

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ status: "ok", service: "orbitos-snake-multiplayer" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

const socketServer = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });

server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin;
  if (
    request.url !== "/ws" ||
    (origin !== undefined && !allowedOrigins.has(origin)) ||
    (origin === undefined && process.env.NODE_ENV === "production")
  ) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  socketServer.handleUpgrade(request, socket, head, (websocket) => socketServer.emit("connection", websocket, request));
});

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sendRoom(roomCode: string): void {
  const snapshot = rooms.snapshot(roomCode);
  for (const [id, socket] of clients) {
    if (rooms.roomForConnection(id) !== roomCode) continue;
    if (snapshot) send(socket, { type: "state", snapshot });
    else send(socket, { type: "room-closed" });
  }
}

socketServer.on("connection", (socket) => {
  const connectionId = `client-${connectionCounter++}`;
  clients.set(connectionId, socket);
  markAlive(socket, true);
  socket.on("pong", () => markAlive(socket, true));
  socket.on("message", (data) => {
    const counter = counters.get(connectionId);
    const now = Date.now();
    if (counter && now - counter.startedAt < 1000 && counter.count >= 30) {
      send(socket, { type: "error", code: "rate_limited", message: "Too many actions; please slow down." });
      return;
    }
    if (!counter || now - counter.startedAt >= 1000) counters.set(connectionId, { startedAt: now, count: 1 });
    else counter.count += 1;

    const parsed = parseClientMessage(data.toString());
    if (!parsed.ok) {
      send(socket, { type: "error", code: parsed.code, message: parsed.message });
      return;
    }

    const request = parsed.message;
    if (request.type === "rooms") {
      send(socket, { type: "rooms", rooms: rooms.listPublicRooms() });
    } else if (request.type === "create") {
      const result = rooms.createRoom(connectionId, request.name, request.visibility);
      if (!result) send(socket, { type: "error", code: "create_failed", message: "Could not create that room. Check your name and try again." });
      else {
        send(socket, { type: "joined", ...result });
        sendRoom(result.roomCode);
      }
    } else if (request.type === "join") {
      const result = rooms.joinRoom(connectionId, request.roomCode, request.name, request.reconnectToken);
      if (!result) send(socket, { type: "error", code: "join_failed", message: "That room is unavailable or full." });
      else {
        send(socket, { type: "joined", ...result });
        sendRoom(result.roomCode);
      }
    } else if (request.type === "start") {
      const roomCode = rooms.roomForConnection(connectionId);
      if (!roomCode || !rooms.startRoom(connectionId)) {
        send(socket, { type: "error", code: "start_failed", message: "Only the host can start a room with at least two connected players." });
      } else sendRoom(roomCode);
    } else if (request.type === "rematch") {
      const roomCode = rooms.roomForConnection(connectionId);
      if (!roomCode || !rooms.rematch(connectionId)) {
        send(socket, { type: "error", code: "rematch_failed", message: "The host can start a rematch when at least two players are connected." });
      } else sendRoom(roomCode);
    } else if (request.type === "direction") {
      const roomCode = rooms.roomForConnection(connectionId);
      if (!rooms.setDirection(connectionId, request.direction)) {
        send(socket, { type: "error", code: "invalid_direction", message: "That turn is not valid right now." });
      } else if (roomCode) sendRoom(roomCode);
    } else if (request.type === "boost") {
      const roomCode = rooms.roomForConnection(connectionId);
      if (!rooms.setBoost(connectionId, request.active)) {
        send(socket, { type: "error", code: "boost_failed", message: "Boost can only be held during an active game." });
      } else if (roomCode) sendRoom(roomCode);
    } else if (request.type === "ready") {
      const roomCode = rooms.roomForConnection(connectionId);
      if (!roomCode || !rooms.setReady(connectionId, request.ready)) {
        send(socket, { type: "error", code: "ready_failed", message: "Readiness can only change while you are in a waiting room." });
      } else sendRoom(roomCode);
    } else if (request.type === "leave") {
      const roomCode = rooms.leave(connectionId);
      if (roomCode) sendRoom(roomCode);
      send(socket, { type: "left" });
    } else {
      send(socket, { type: "error", code: "unknown_action", message: "That action is not supported." });
    }
  });

  socket.on("close", () => {
    clients.delete(connectionId);
    counters.delete(connectionId);
    const roomCode = rooms.disconnect(connectionId);
    if (roomCode) sendRoom(roomCode);
  });
  socket.on("error", (error) => {
    console.error("Snake multiplayer socket error:", error.message);
  });
});

const gameLoop = setInterval(() => {
  for (const roomCode of rooms.tick()) sendRoom(roomCode);
}, 40);

const roomListRefresh = setInterval(() => {
  const message = { type: "rooms", rooms: rooms.listPublicRooms() };
  for (const socket of clients.values()) send(socket, message);
}, 3000);

const heartbeat = setInterval(() => {
  for (const socket of socketServer.clients) {
    if (!aliveFor(socket)) {
      socket.terminate();
      continue;
    }
    markAlive(socket, false);
    socket.ping();
  }
}, 25_000);

function aliveFor(socket: WebSocket): boolean {
  return (socket as WebSocket & { heartbeatAlive?: boolean }).heartbeatAlive !== false;
}

function markAlive(socket: WebSocket, value: boolean): void {
  (socket as WebSocket & { heartbeatAlive?: boolean }).heartbeatAlive = value;
}

server.listen(port, "0.0.0.0", () => {
  console.info(`OrbitOS Snake multiplayer server listening on port ${port}`);
});

function shutdown(): void {
  clearInterval(heartbeat);
  clearInterval(gameLoop);
  clearInterval(roomListRefresh);
  for (const socket of socketServer.clients) socket.close(1001, "Server shutting down");
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
