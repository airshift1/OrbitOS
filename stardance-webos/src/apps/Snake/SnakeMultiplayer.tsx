import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { Direction, Point } from "./engine";
import { VIEWPORT_COLUMNS, VIEWPORT_ROWS } from "./engine";
import type { PlayerSnapshot, PublicRoom, RoomSnapshot } from "./multiplayerTypes";
import { getSnakeWebSocketUrl } from "./multiplayerConnection";
import { useWindowStore } from "../../stores/useWindowStore";
import { ClassicSnakeHead, Cupcake, UnicornHead } from "./SnakeArt";
import type { UnicornSkin } from "./unicornSkins.js";
import { appendHeadHistory, interpolateSnake } from "./motion";
import { useSnakeSnapshotInterpolation } from "./useSnakeAnimation";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";
type PendingAction =
  | { type: "create"; name: string; visibility: "public" | "private" }
  | { type: "join"; roomCode: string; name: string; reconnectToken?: string };

const ROOM_KEY = "orbitos-snake-room";
const TOKEN_KEY = "orbitos-snake-token";
const PLAYER_KEY = "orbitos-snake-player";
const NAME_KEY = "orbitos-snake-name";
const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowRight: "right", d: "right", D: "right",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
};

function pointStyle(point: Point, camera: Point): CSSProperties {
  return {
    left: `${((point.x - camera.x) / VIEWPORT_COLUMNS) * 100}%`,
    top: `${((point.y - camera.y) / VIEWPORT_ROWS) * 100}%`,
    width: `${100 / VIEWPORT_COLUMNS}%`,
    height: `${100 / VIEWPORT_ROWS}%`,
  };
}

function storedValue(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function saveStoredRoom(roomCode: string, token: string, playerId: string, playerName: string): void {
  try {
    window.sessionStorage.setItem(ROOM_KEY, roomCode);
    window.sessionStorage.setItem(TOKEN_KEY, token);
    window.sessionStorage.setItem(PLAYER_KEY, playerId);
    window.sessionStorage.setItem(NAME_KEY, playerName);
  } catch {
    return;
  }
}

function clearStoredRoom(): void {
  try {
    window.sessionStorage.removeItem(ROOM_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(PLAYER_KEY);
    window.sessionStorage.removeItem(NAME_KEY);
  } catch {
    return;
  }
}

function useSnakeRoom() {
  const endpoint = getSnakeWebSocketUrl(import.meta.env.VITE_SNAKE_SERVER_URL ?? "");
  const socketRef = useRef<WebSocket | null>(null);
  const liveSockets = useRef(new Set<WebSocket>());
  const [closedSocketSet] = useState(() => new WeakSet<WebSocket>());
  const connectRef = useRef<() => void>(() => {});
  const pendingRef = useRef<PendingAction | null>(null);
  const requestedName = useRef("");
  const reconnectTimers = useRef(new Set<number>());
  const retryDelay = useRef(500);
  const closedByUser = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(endpoint ? "connecting" : "offline");
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [selfId, setSelfId] = useState(storedValue(PLAYER_KEY));
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [error, setError] = useState("");

  const connect = useCallback(() => {
    if (!endpoint || closedByUser.current) return;
    const existing = socketRef.current;
    if (existing && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(endpoint);
    } catch {
      setConnectionStatus("offline");
      setError("Could not open the multiplayer connection.");
      return;
    }
    socketRef.current = socket;
    liveSockets.current.add(socket);
    socket.onopen = () => {
      if (closedSocketSet.has(socket)) return;
      retryDelay.current = 500;
      setConnectionStatus("connected");
      setError("");
      const pending = pendingRef.current;
      if (pending) {
        socket.send(JSON.stringify(pending));
        pendingRef.current = null;
      } else {
        const roomCode = storedValue(ROOM_KEY);
        const token = storedValue(TOKEN_KEY);
        if (roomCode && token) {
          socket.send(JSON.stringify({ type: "join", roomCode, name: storedValue(NAME_KEY) || "Player", reconnectToken: token }));
        } else socket.send(JSON.stringify({ type: "rooms" }));
      }
    };
    socket.onmessage = (event) => {
      if (closedSocketSet.has(socket)) return;
      let message: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(String(event.data));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
        message = parsed as Record<string, unknown>;
      } catch {
        setError("The multiplayer server sent an unreadable message.");
        return;
      }
      if (message.type === "joined" && typeof message.roomCode === "string" && typeof message.playerId === "string" && typeof message.reconnectToken === "string") {
        const joinedSnapshot = message.snapshot as RoomSnapshot;
        setSelfId(message.playerId);
        setSnapshot(joinedSnapshot);
        saveStoredRoom(message.roomCode, message.reconnectToken, message.playerId, requestedName.current || storedValue(NAME_KEY) || "Player");
        requestedName.current = "";
      } else if (message.type === "state" && message.snapshot && typeof message.snapshot === "object") {
        setSnapshot(message.snapshot as RoomSnapshot);
      } else if (message.type === "rooms" && Array.isArray(message.rooms)) {
        setRooms(message.rooms as PublicRoom[]);
      } else if (message.type === "left" || message.type === "room-closed") {
        clearStoredRoom();
        setSnapshot(null);
        setSelfId("");
        socket.send(JSON.stringify({ type: "rooms" }));
        if (message.type === "room-closed") setError("That room has closed.");
      } else if (message.type === "error" && typeof message.message === "string") {
        setError(message.message);
        if (message.code === "join_failed" && storedValue(ROOM_KEY)) {
          clearStoredRoom();
          setSnapshot(null);
          setSelfId("");
        }
      }
    };
    socket.onerror = () => {
      if (closedSocketSet.has(socket)) return;
      setError("The multiplayer server could not be reached.");
    };
    socket.onclose = () => {
      liveSockets.current.delete(socket);
      if (closedSocketSet.has(socket)) {
        if (socketRef.current === socket) socketRef.current = null;
        return;
      }
      if (socketRef.current === socket) socketRef.current = null;
      if (closedByUser.current) return;
      const hasRoom = Boolean(storedValue(ROOM_KEY) && storedValue(TOKEN_KEY));
      setConnectionStatus(hasRoom ? "reconnecting" : "offline");
      if (hasRoom) {
        const timer = window.setTimeout(() => {
          reconnectTimers.current.delete(timer);
          connectRef.current();
        }, retryDelay.current);
        reconnectTimers.current.add(timer);
        retryDelay.current = Math.min(8000, retryDelay.current * 2);
      }
    };
  }, [closedSocketSet, endpoint]);

  useEffect(() => {
    const sockets = liveSockets.current;
    const timers = reconnectTimers.current;
    closedByUser.current = false;
    connectRef.current = connect;
    const initialConnection = window.setTimeout(connect, 0);
    return () => {
      closedByUser.current = true;
      window.clearTimeout(initialConnection);
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      for (const socket of sockets) {
        closedSocketSet.add(socket);
        socket.close(1000, "App closed");
      }
      sockets.clear();
    };
  }, [connect, closedSocketSet]);

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const begin = useCallback((action: PendingAction) => {
    setError("");
    pendingRef.current = action;
    requestedName.current = action.name;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(action));
      pendingRef.current = null;
    } else {
      setConnectionStatus("connecting");
      connect();
    }
  }, [connect]);

  const leave = useCallback(() => {
    closedByUser.current = false;
    if (!send({ type: "leave" })) {
      clearStoredRoom();
      setSnapshot(null);
      setSelfId("");
      return;
    }
  }, [send]);

  const reconnect = useCallback(() => {
    setError("");
    setConnectionStatus("connecting");
    closedByUser.current = false;
    if (socketRef.current) {
      closedSocketSet.add(socketRef.current);
      socketRef.current.close();
    }
    socketRef.current = null;
    connect();
  }, [connect, setError, closedSocketSet]);

  return { endpoint, connectionStatus, snapshot, selfId, rooms, error, setError, send, begin, leave, reconnect };
}

export function SnakeMultiplayer({
  visualMode,
  unicornSkin,
  accentColor,
  theme,
  windowId,
  onVisualModeChange,
  onExit,
}: {
  visualMode: "classic" | "unicorn";
  unicornSkin: UnicornSkin;
  accentColor: string;
  theme: string;
  windowId: string;
  onVisualModeChange: (mode: "classic" | "unicorn") => void;
  onExit: () => void;
}) {
  const room = useSnakeRoom();
  const windowState = useWindowStore((state) => state.windows.find((item) => item.id === windowId));
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);
  const [name, setName] = useState(() => storedValue(NAME_KEY) || "Player");
  const [roomCode, setRoomCode] = useState("");
  const swipeStart = useRef<Point | null>(null);
  const headHistory = useRef<Record<string, Point[]>>({});
  const previousSnapshot = useRef<RoomSnapshot | null>(null);
  const [boosting, setBoosting] = useState(false);
  const self = room.snapshot?.players.find((player) => player.id === room.selfId);
  const send = room.send;
  const onlinePlayers = room.snapshot?.players.filter((player) => player.online) ?? [];
  const readyCount = onlinePlayers.filter((player) => player.ready).length;
  const focusHead = self?.segments[0] ?? room.snapshot?.players.find((player) => player.online)?.segments[0] ?? { x: 30, y: 20 };
  const camera = useMemo(() => ({
    x: Math.max(0, Math.min((room.snapshot?.columns ?? 60) - VIEWPORT_COLUMNS, focusHead.x - Math.floor(VIEWPORT_COLUMNS / 2))),
    y: Math.max(0, Math.min((room.snapshot?.rows ?? 40) - VIEWPORT_ROWS, focusHead.y - Math.floor(VIEWPORT_ROWS / 2))),
  }), [focusHead.x, focusHead.y, room.snapshot?.columns, room.snapshot?.rows]);
  const isHost = self?.id === room.snapshot?.hostId;
  const isPlaying = room.snapshot?.status === "playing" && room.connectionStatus === "connected";
  const stepMs = Math.max(125, 240 - Math.max(0, ...(room.snapshot?.players.map((player) => player.score) ?? [])) * 1.5);
  const animationProgress = useSnakeSnapshotInterpolation(isPlaying, stepMs, room.snapshot);
  const rootStyle = {
    "--snake-accent": accentColor,
  } as CSSProperties;

  const steer = useCallback((next: Direction) => {
    if (!isPlaying) return;
    send({ type: "direction", direction: next });
  }, [isPlaying, send]);
  const setBoost = (active: boolean) => {
    const enabled = active && isPlaying;
    setBoosting(enabled);
    send({ type: "boost", active: enabled });
  };

  useEffect(() => {
    const current = room.snapshot;
    const previous = previousSnapshot.current;
    if (!current) {
      headHistory.current = {};
      previousSnapshot.current = null;
      return;
    }
    const nextHistory: Record<string, Point[]> = {};
    for (const player of current.players) {
      const before = previous?.players.find((candidate) => candidate.id === player.id);
      const path = headHistory.current[player.id] ?? [...player.segments];
      nextHistory[player.id] = before && player.segments[0] &&
        (before.segments[0]?.x !== player.segments[0].x || before.segments[0]?.y !== player.segments[0].y)
        ? appendHeadHistory(path, before.segments[0], player.segments[0], player.segments.length)
        : path;
    }
    headHistory.current = nextHistory;
    previousSnapshot.current = current;
  }, [room.snapshot]);

  useEffect(() => {
    if (isPlaying) return;
    if (boosting) setBoost(false);
  }, [boosting, isPlaying]);

  useEffect(() => {
    const release = () => setBoost(false);
    const onVisibility = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibility);
      send({ type: "boost", active: false });
    };
  }, [send]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === "Shift") { setBoost(true); return; }
    const next = DIRECTION_KEYS[event.key];
    if (!next) return;
    event.preventDefault();
    steer(next);
  };
  const handleKeyUp = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Shift") setBoost(false);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  };

  const requestCreate = (visibility: "public" | "private") => {
    room.begin({ type: "create", name, visibility });
  };
  const requestJoin = (code: string) => {
    room.begin({ type: "join", roomCode: code.trim().toUpperCase(), name });
  };
  const copyRoomCode = async () => {
    if (!room.snapshot) return;
    try {
      await navigator.clipboard.writeText(room.snapshot.code);
    } catch {
      room.setError("Clipboard access is unavailable. Share the room code shown on screen.");
    }
  };

  return (
    <main className={`snake snake--${visualMode} snake--theme-${theme} snake-multi`} style={rootStyle} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      <header className="snake__header snake-multi__header">
        <div className="snake__brand">
          <span className="snake__brand-mark" aria-hidden="true">✦</span>
          <div><h1>Snake Multiplayer</h1><p>Shared rooms, server-run game state</p></div>
        </div>
        <div className="snake-multi__header-actions">
          <div className="snake__mode" role="group" aria-label="Snake visual mode">
            <button type="button" aria-pressed={visualMode === "classic"} onClick={() => onVisualModeChange("classic")}>Classic</button>
            <button type="button" aria-pressed={visualMode === "unicorn"} onClick={() => onVisualModeChange("unicorn")}>Unicorn</button>
          </div>
          <span className={`snake-multi__connection snake-multi__connection--${room.connectionStatus}`} aria-live="polite">
            <i /> {room.connectionStatus === "connected" ? "Connected" : room.connectionStatus === "reconnecting" ? "Reconnecting…" : room.connectionStatus === "connecting" ? "Connecting…" : "Offline"}
          </span>
          <button type="button" className="snake-multi__quiet" onClick={() => toggleMaximize(windowId)}>{windowState?.isMaximized ? "Restore window" : "Full screen"}</button>
          <button type="button" className="snake-multi__quiet" onClick={onExit}>Solo game</button>
        </div>
      </header>

      {room.error && <p className="snake-multi__error" role="alert">{room.error}</p>}
      {!room.endpoint ? (
        <section className="snake-multi__unconfigured">
          <span className="snake__overlay-icon">⌁</span>
          <h2>Online play needs a server</h2>
          <p>The multiplayer service is separate from OrbitOS’s static Vercel site. Configure <code>VITE_SNAKE_SERVER_URL</code> after deploying the WebSocket server. Solo play remains available.</p>
          <button type="button" className="snake__primary" onClick={onExit}>Return to solo game</button>
        </section>
      ) : (
        <div className="snake-multi__layout">
          <section className="snake-multi__game">
            <div className="snake-multi__scorebar">
              <strong>{room.snapshot ? `${room.snapshot.players.length} / 8 players` : "Join a room to play"}</strong>
              <span>{room.snapshot ? `${room.snapshot.columns} × ${room.snapshot.rows} world` : "60 × 40 world"}</span>
            </div>
            <div
              className="snake__board snake-multi__board"
              tabIndex={0}
              role="application"
              aria-label="Multiplayer Snake board. Use arrow keys or WASD to steer."
              onPointerDown={(event) => { event.currentTarget.focus(); swipeStart.current = { x: event.clientX, y: event.clientY }; }}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { swipeStart.current = null; }}
            >
              <div
                className="snake__world-edge"
                style={{
                  left: `${(-camera.x / VIEWPORT_COLUMNS) * 100}%`,
                  top: `${(-camera.y / VIEWPORT_ROWS) * 100}%`,
                  width: `${((room.snapshot?.columns ?? 60) / VIEWPORT_COLUMNS) * 100}%`,
                  height: `${((room.snapshot?.rows ?? 40) / VIEWPORT_ROWS) * 100}%`,
                }}
                aria-hidden="true"
              />
              <div className="snake__grid snake-multi__grid" aria-hidden="true">
                {room.snapshot?.players.map((player) => (
                  <PlayerSnake key={player.id} player={player} segments={interpolateSnake(headHistory.current[player.id] ?? player.segments, player.segments, animationProgress)} selfId={room.selfId} camera={camera} visualMode={visualMode} unicornSkin={unicornSkin} />
                ))}
                {room.snapshot?.food && <Food point={room.snapshot.food} camera={camera} visualMode={visualMode} />}
                {room.snapshot?.specialFood && <Food point={room.snapshot.specialFood} camera={camera} visualMode={visualMode} special />}
              </div>
              {(!room.snapshot || room.snapshot.status === "waiting" || room.snapshot.status === "celebrating" || room.snapshot.status === "gameover" || room.connectionStatus !== "connected") && (
                <div className="snake-multi__overlay" aria-live="polite">
                  {!room.snapshot ? (
                    <>
                      <span className="snake__overlay-icon">♡</span>
                      <h2>Find your room</h2>
                      <p>Create a room or join another player. The server stays in charge of movement, food, and scores.</p>
                    </>
                  ) : room.connectionStatus !== "connected" ? (
                    <>
                      <span className="snake__overlay-icon">⌁</span>
                      <h2>{room.connectionStatus === "reconnecting" ? "Reconnecting…" : "Connection lost"}</h2>
                      <p>Movement is paused until the authoritative game server is back.</p>
                    </>
                  ) : room.snapshot.status === "waiting" ? (
                    <>
                      <span className="snake__overlay-icon">✦</span>
                      <h2>Waiting for players</h2>
                      <p>{room.snapshot.visibility === "private" ? `Share room code ${room.snapshot.code}` : "A public room is open to join."} {onlinePlayers.length} connected · {readyCount} ready.</p>
                    </>
                  ) : room.snapshot.status === "celebrating" ? (
                    <>
                      <span className="snake__celebration-cupcake"><Cupcake special /></span>
                      <h2>Shared celebration!</h2>
                      <p>The special cupcake brings three seconds of magic for everyone.</p>
                      <span className="snake__countdown">✨ Back to the race soon ✨</span>
                    </>
                  ) : (
                    <>
                      <span className="snake__overlay-icon">✦</span>
                      <h2>{room.snapshot!.winnerId ? `${room.snapshot!.players.find((player) => player.id === room.snapshot!.winnerId)?.name ?? "A player"} wins!` : "Round complete"}</h2>
                      <p>Scores are final. {isHost ? "Start a rematch together or leave the room." : "Wait for the host to start a rematch."}</p>
                      {isHost && <button type="button" className="snake__primary" onClick={() => room.send({ type: "rematch" })}>Rematch</button>}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="snake-multi__controls" role="group" aria-label="Touch direction controls">
              {(["up", "left", "down", "right"] as const).map((value) => (
                <button key={value} type="button" className={`snake__direction snake__direction--${value}`} aria-label={`Move ${value}`} disabled={!isPlaying} onClick={() => steer(value)}>
                  {value === "up" ? "↑" : value === "right" ? "→" : value === "down" ? "↓" : "←"}
                </button>
              ))}
              <span>Arrow keys / WASD · swipe on touch</span>
              <button type="button" className={`snake-arcade__boost ${boosting ? "is-active" : ""}`} aria-pressed={boosting} disabled={!isPlaying} title="Hold: two pickups add one segment. The server keeps score unchanged." onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setBoost(true); }} onPointerUp={() => setBoost(false)} onPointerCancel={() => setBoost(false)} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); setBoost(true); } }} onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") setBoost(false); }}>BOOST</button>
            </div>
          </section>
          <aside className="snake-multi__sidebar">
            {room.snapshot ? (
              <>
                <div className="snake-multi__room-title">
                  <div><span>Room</span><strong>{room.snapshot.code}</strong></div>
                  <button type="button" className="snake-multi__quiet" onClick={copyRoomCode}>Copy code</button>
                </div>
                <div className="snake-multi__player-list">
                  {room.snapshot.players.map((player) => (
                    <div className={`snake-multi__player ${player.id === room.selfId ? "snake-multi__player--self" : ""}`} key={player.id}>
                      <i style={{ background: player.color }} />
                      <span>{player.name}{player.id === room.snapshot!.hostId ? " · host" : ""}{player.id === room.selfId ? " · you" : ""}</span>
                      <strong>{player.score}</strong>
                      <small>{!player.online ? "Away" : !player.alive ? "Out" : room.snapshot!.status === "playing" ? "Playing" : player.ready ? "Ready" : "Not ready"}</small>
                    </div>
                  ))}
                </div>
                <div className="snake-multi__sidebar-actions">
                  {room.snapshot.status === "waiting" && self && <button type="button" onClick={() => room.send({ type: "ready", ready: !self.ready })}>{self.ready ? "Ready ✓ · click to unready" : "I’m ready"}</button>}
                  {isHost && room.snapshot.status === "waiting" && <button type="button" disabled={onlinePlayers.length < 2 || readyCount !== onlinePlayers.length} onClick={() => room.send({ type: "start" })}>Start with {onlinePlayers.length} players</button>}
                  <button type="button" className="snake-multi__quiet" onClick={room.leave}>Leave room</button>
                </div>
              </>
            ) : (
              <>
                <label className="snake-multi__field">Player name<input value={name} maxLength={20} onChange={(event) => setName(event.target.value)} /></label>
                <div className="snake-multi__create">
                  <button type="button" disabled={room.connectionStatus !== "connected" || !name.trim()} onClick={() => requestCreate("public")}>Create public room</button>
                  <button type="button" disabled={room.connectionStatus !== "connected" || !name.trim()} onClick={() => requestCreate("private")}>Create private room</button>
                </div>
                <label className="snake-multi__field">Join by room code
                  <span className="snake-multi__join-input"><input value={roomCode} maxLength={6} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABC123" /><button type="button" disabled={room.connectionStatus !== "connected" || roomCode.trim().length !== 6 || !name.trim()} onClick={() => requestJoin(roomCode)}>Join</button></span>
                </label>
                <div className="snake-multi__public">
                  <strong>Public rooms</strong>
                  {room.rooms.length === 0 ? <p>No public rooms waiting yet.</p> : room.rooms.map((publicRoom) => (
                    <button type="button" key={publicRoom.code} disabled={publicRoom.players >= publicRoom.capacity || room.connectionStatus !== "connected" || !name.trim()} onClick={() => requestJoin(publicRoom.code)}>
                      <span>{publicRoom.code}</span><small>{publicRoom.players}/{publicRoom.capacity}</small>
                    </button>
                  ))}
                </div>
                {room.connectionStatus !== "connected" && <button type="button" className="snake-multi__quiet" onClick={room.reconnect}>Retry connection</button>}
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

function PlayerSnake({
  player,
  segments,
  selfId,
  camera,
  visualMode,
  unicornSkin,
}: {
  player: PlayerSnapshot;
  segments: Point[];
  selfId: string;
  camera: Point;
  visualMode: "classic" | "unicorn";
  unicornSkin: UnicornSkin;
}) {
  return (
    <>
      {segments.slice(1).map((segment, index) => (
        <div className={`snake__segment snake-multi__segment ${visualMode === "unicorn" && player.id === selfId ? "snake__segment--unicorn" : ""}`} key={`${player.id}-${index}`} style={{ ...pointStyle(segment, camera), "--player-color": player.color } as CSSProperties} />
      ))}
      {segments[0] && (
        <div className="snake__head snake-multi__head" style={pointStyle(segments[0], camera)}>
          {visualMode === "unicorn" && player.id === selfId
            ? <UnicornHead direction={player.direction} skin={unicornSkin} />
            : <span className="snake-multi__player-head" style={{ "--local-snake-color": player.color } as CSSProperties}><ClassicSnakeHead direction={player.direction} /></span>}
        </div>
      )}
    </>
  );
}

function Food({ point, camera, visualMode, special = false }: { point: Point; camera: Point; visualMode: "classic" | "unicorn"; special?: boolean }) {
  return (
    <div className={`snake__food ${visualMode === "unicorn" ? "" : "snake__food--classic"} ${special ? "snake__food--special" : ""}`} style={pointStyle(point, camera)} aria-label={special ? "Special cupcake" : "Food"}>
      {visualMode === "unicorn" ? <Cupcake special={special} /> : <span>{special ? "★" : null}</span>}
    </div>
  );
}
