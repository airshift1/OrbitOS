# Snake multiplayer server

This Node.js service provides authoritative room state over WebSockets. It is separate from OrbitOS's static Vercel frontend; deployment of this service and configuration of the frontend are required before multiplayer is available to visitors.

## Run OrbitOS and the server on Windows

Open two PowerShell windows in the `stardance-webos` project directory. Install dependencies once:

```powershell
npm install
```

In the first window, allow the local Vite origin and start the multiplayer service:

```powershell
$env:ALLOWED_ORIGINS = "http://localhost:5173"
npm run multiplayer:server
```

By default, the WebSocket endpoint is `ws://localhost:8080/ws`; health checks use `http://localhost:8080/health`. `PORT` can override the server port.

In the second window, configure the frontend endpoint and start OrbitOS:

```powershell
$env:VITE_SNAKE_SERVER_URL = "http://localhost:8080"
npm run dev
```

Open the Vite URL printed by the command (normally `http://localhost:5173`) and select **Snake → Online Multiplayer**. The `VITE_SNAKE_SERVER_URL` setting is read when Vite starts/builds, so restart Vite after changing it. `http://` is correct for local development; the client uses `ws://` for its socket connection.

## Test with two browser clients

1. Open the Vite URL in two independent browser windows or profiles. Do not use two tabs sharing a session if you want separate player identities.
2. In the first window, open Snake → Online Multiplayer, enter a name, create a public or private room, and wait for the lobby.
3. In the second window, join the public room from the room list, or enter the private room code. Use a distinct player name.
4. Mark both players ready. The room host starts the match when the lobby shows at least two connected, ready players.
5. Use each client's arrow keys or WASD to move. Confirm positions, food, scores, collision/game-over, and rematch state are reflected in both windows.
6. Close a client and confirm its connection status changes; reopen it in the same browser session to exercise the reconnect token and grace period.

The server's `/health` endpoint confirms process availability, not that a public multiplayer deployment or two-client gameplay has been validated.

## Connecting friends outside your network

Friends outside your home network need a publicly reachable server that supports long-lived Node.js processes and WebSocket upgrades, deployed with HTTPS/WSS and an exact origin allowlist. The Vercel frontend is static and cannot host this persistent WebSocket process. Do not expose your personal PC by opening router ports or disabling firewall protections. Use a properly secured persistent hosting service, or a reputable secure tunnel configured with TLS and access controls; a local `ws://localhost` server is not internet-accessible.

Deploy `server/Dockerfile` to a suitable persistent host. Configure:

- `PORT`: listener port (the default is `8080`; the platform must route its public HTTPS/WSS traffic to this port).
- `ALLOWED_ORIGINS`: comma-separated exact browser origins, such as `https://orbit-os-drab.vercel.app`. This is required in production; do not use `*`.
- `NODE_ENV=production`.

Set the Vercel frontend build variable `VITE_SNAKE_SERVER_URL` to the service's public HTTPS origin, for example `https://snake.example.net`. Vite converts it to `wss://snake.example.net/ws`. This endpoint is public configuration, not a secret; never put backend credentials in `VITE_*` variables. The Vercel Content Security Policy permits WSS connections; narrow that source to the deployed host if the project later moves to generated deployment-specific headers.

The service keeps rooms in memory, so a server restart ends active rooms. Public-room discovery, room codes, the eight-player cap, disconnect grace, input validation, movement, food, collisions, scoring, readiness, and rematches are server-controlled. Use a single server instance unless shared room storage and coordinated game ticks are added.

Multiplayer should only be described as live after the server is deployed and room creation, joining, movement synchronization, disconnect/reconnect, and collision handling have been exercised in two independent browser sessions.
