# Snake multiplayer server

This Node.js service provides authoritative room state over WebSockets. It is separate from OrbitOS's static Vercel frontend; deployment of this service and configuration of the frontend are required before multiplayer is available to visitors.

New rooms use a server-controlled **120 × 80** world. Online arena dimensions are not client-selectable: the server validates all movement, collisions, food, growth, and scores against this fixed room size.

## Run OrbitOS and the server on Windows

Open two PowerShell windows in the `stardance-webos` project directory. Install dependencies once:

```powershell
npm install
```

In the first window, allow the Vite origins you will use and start the multiplayer service. For same-device testing:

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

## Play on the same local network

The server already listens on `0.0.0.0`, so it accepts connections through the host's network interface. For a LAN match, both devices must be on the same trusted private network; do not enable router port forwarding.

1. On the host PC, find its private IPv4 address with `ipconfig` (for example, `192.168.1.25`). Do not use `127.0.0.1` or `localhost` on the second device.
2. In the server PowerShell window, allow the exact Vite origins, replacing the example address with the host's IPv4:

   ```powershell
   $env:ALLOWED_ORIGINS = "http://192.168.1.25:5173,http://localhost:5173,http://127.0.0.1:5173"
   npm run multiplayer:server
   ```

3. In the frontend PowerShell window, point the client at the host's server address and expose Vite on the LAN:

   ```powershell
   $env:VITE_SNAKE_SERVER_URL = "http://192.168.1.25:8080"
   npm run dev -- --host 0.0.0.0
   ```

4. Open `http://192.168.1.25:5173` on both devices, create/join a room code, and allow Node.js/Vite through Windows Firewall only on the **Private** network if Windows asks. If inbound connections are blocked, check the host's Private-network firewall rules for TCP ports 5173 and 8080; do not disable the firewall or expose these ports on a public network.

This documents the LAN path; it does not certify that a particular network, firewall, or two-device setup has been tested. OrbitOS's static Vercel deployment does not host this service.

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
