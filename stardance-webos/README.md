Orbit is a web-based OS that i built for my Ai ella. becausei didnt have enough ram memory to run her on my laptop so i was going to make a OS that kaes up barly any to run.

but after i started stardance i decided to mkae this project under WebOS. right now this OS contains TAskbar,settings system.files,thems,mulitple workspaces login and create a account. next thing im working on is making a webbrowser called Orbit
that allows me to go to anysite and download file/folders.
 i built orbit in react,javasript and vite. i worked on the desing,features,structer, and testing

 i used ai for coding assistans debugging finding probloms reviewing code and helping with some difficult parts.

 the webos is at https://orbit-os-drab.vercel.app/
 
 this is js the wbeversion the downlodable part is not ready yet. but this is to show how  it will work"minus the BIOS and more detailed setting"

 CREDITS 

 i used refrenced some open sorce projects while building. i included there credits and licenses so the people who helped give me this idea are credidted properly 

 WebOS by Martin-R-D
@maomaolabs/core
@projectstorm/react-workspaces

## Snake

Launch **Snake** from the App Launcher or System Apps and select a mode:

- **Classic** is traditional solo Snake. Choose a difficulty, collect food to grow, and avoid walls and your tail. Keyboard, swipe, and on-screen controls are supported. The local top-five high-score table is separate from Unicorn Dreams.
- **Unicorn Dreams** keeps its pastel unicorn, cupcake milestones, three-second celebrations at 25 and 50 cupcakes, and 67-cupcake victory.
- **VS Snake** is local two-player play on one keyboard: Player 1 uses WASD and Player 2 uses the arrow keys.
- **AI Battle** is a local run against four computer-controlled snakes. Bots navigate around bodies, pursue projected player positions, and compete for food. Choose Easy, Normal, Hard, or Expert in Settings.
- **Online Multiplayer** connects to the optional authoritative WebSocket server. It is not live on the public Vercel site until that service is deployed and `VITE_SNAKE_SERVER_URL` is configured in the frontend build environment.

The game supports pausing, restarting, responsive windows, sound and visual-effect settings, and a full-screen option. Snake settings include Wide (80 × 60), Vast (120 × 80), and Colossal (160 × 100) arenas; arena changes apply when starting or restarting a run. The camera keeps a readable 24 × 16-cell viewport and follows the snakes, so larger worlds do not shrink individual tiles. The game window uses OrbitOS's existing window manager and resizes with its available work area.

The default local and online world is **120 × 80 cells**. Multiplayer remains server-authoritative and optional; it requires a separately hosted WebSocket server. See [server/README.md](./server/README.md) for setup. Online play is not available on the public site until that service is deployed and `VITE_SNAKE_SERVER_URL` is configured in the frontend build environment.

The original **Dino Run**, **Orbit Blast**, **Orbit Depths**, **2048**, and **Sandtrix** games are also available from the App Launcher and System Apps. **Mortal Kombat Mobile** opens its game listing; the native mobile game itself does not run inside OrbitOS.

## Orbit Store

Open **Orbit Store** from the App Launcher to browse bundled OrbitOS apps and a small static catalog of external projects. Search, category filters, details, and sorting work locally. Bundled apps can be added to or removed from your OrbitOS library; they remain part of the build. Core apps cannot be removed.

External web apps and browser games (Excalidraw, Scratch, and HexGL) open their official websites in a new browser tab. Native software (Blender, GIMP, and Godot Engine) opens the publisher's official download page. OrbitOS does not download or run installers, and external software is never marked installed just because a link was opened. The browser may send normal network requests to a publisher only after you choose to visit its site. The catalog is maintained in the frontend source; there is no remote catalog, update service, or backend.

Catalog publisher, license, project, and official download links are included where verified. Listings without a separately verified source omit that link or label the license as unspecified. Artwork is illustrative, not a product screenshot.

## Desktop customization

Open **Settings** from the desktop or App Launcher. Appearance, wallpaper, desktop shortcuts, Dock & Taskbar, windows, icons, accessibility, and reset preferences are grouped into separate sections and apply across the desktop and open windows.

Uploaded wallpaper images (PNG, JPEG, WebP, or GIF; up to 8 MB) are stored in this browser's IndexedDB, while preference values are stored in the session-scoped OrbitOS settings record. Clearing browser storage removes these local images and preferences. The icon picker offers built-in OrbitOS symbols; importing arbitrary icon files and wallpaper slideshows are not currently supported. Dock placement supports bottom, left, and right positions, with windows and snap layouts reflowing to the available work area.

Wallpaper uploads require a supported extension, matching browser MIME type, matching PNG/JPEG/WebP/GIF file signature, successful browser decoding, and no more than 32 megapixels. PHP/JSP-family suffixes are rejected even in double-extension names. This is client-side validation only; OrbitOS has no file-upload server.

The **Local Assistant** in Orbit Store connects directly from the browser to an Ollama server on `localhost` or `127.0.0.1`. Configure the model and port in the app; Ollama must be running, the model must already be available locally, and its CORS configuration must allow the OrbitOS origin. The connection is constrained by the app's Content Security Policy to loopback hosts. Chat messages are not proxied or stored by OrbitOS, and no hosted assistant/model is provided.

## Local development and checks

From the `stardance-webos` directory, install dependencies and start the frontend:

```powershell
npm install
npm run dev
```

Vite prints the local URL (normally `http://localhost:5173`). Run the project's TypeScript check, automated tests, and production build with:

```powershell
npx tsc -b
npx vitest run
npx vite build
```

For the Windows multiplayer-server and two-browser setup, hosting requirements, and secure options for playing with friends outside your home network, see [server/README.md](./server/README.md).
