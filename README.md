# OrbitOS

This is my browser-based desktop project. I built it as a small React + TypeScript app with a desktop shell, a taskbar, floating windows, and a few built-in tools that feel like a stripped-down operating system.

I wanted something that looked like a desktop environment without needing a backend or a full native app. The project runs in the browser, keeps its state in local storage, and is meant mostly as a demo / personal portfolio-style interface.

## What is in it

- A desktop shell with draggable and resizable windows
- Minimizing, maximizing, and window layering
- Snap-to-edge window layout and a few window styles
- Virtual desktops and quick app switching
- A taskbar, start menu, notifications, and quick settings panel
- Spotlight search for apps and files
- Built-in apps including:
  - Welcome
  - File Explorer
  - Notes
  - Text Editor
  - Terminal
  - Calculator
  - Clock
  - Paint
  - Browser
  - Workspaces
  - System Monitor
  - App Launcher
  - Theme Studio
  - Settings
  - About page
- Browser-local account/guest flow for the web version
- Local persistence for settings, notes, and filesystem state

## Running it locally

The app lives in the `stardance-webos` folder, so I run it from there:

```bash
cd stardance-webos
npm install
npm run dev
```

To run the test suite and production build:

```bash
cd stardance-webos
npm test
npm run build
```

## Demo

The public demo is here:

https://orbit-os-drab.vercel.app/

## Security notes

This is a client-side app and there is no backend database or server-side auth layer. The project includes browser-local storage, guest/local account handling, and secure header settings for deployment. I did not remove the app's CSP/headers while making this public demo.

## AI usage declaration

I used AI tools occasionally for syntax help, debugging ideas, and quick code explanations while building this project. The final design decisions, code review, validation, and project direction were done by me. Any AI-assisted output was checked before it stayed in the codebase.

## Credits

This project uses the following libraries and tools:

- React
- TypeScript
- Vite
- Zustand
- @projectstorm/react-workspaces
- Lucide React
- Font Awesome
- Google/Adobe font packages via @fontsource

I also drew from earlier webOS-style projects and design references while rebuilding the shell and UI. The final code was reworked and adapted into this project rather than being copied as-is.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
