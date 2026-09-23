import { useState, useRef, useEffect } from "react";
import type { AppProps, AppId, ThemeName, WindowStyle } from "../../types";
import { useFileSystemStore } from "../../stores/useFileSystemStore";
import { useSystemStore } from "../../stores/useSystemStore";
import { useWindowStore } from "../../stores/useWindowStore";
import { notify } from "../../stores/useNotificationStore";
import { appRegistry } from "../registry";
import { launchApp } from "../../lib/launch";
import { playSound } from "../../lib/sound";
import { lockOS, restartOS } from "../../lib/power";
import { WORKSPACE_COUNT } from "../../lib/workspaces";
import "./Terminal.css";

interface Line {
  text: string;
  kind: "in" | "out" | "err";
}

const WELCOME = "OrbitOS Terminal v1.1  —  type 'help' to get started\n";

const THEME_NAMES: ThemeName[] = ["orbit", "dark", "midnight", "light"];
const STYLE_NAMES: WindowStyle[] = ["orbit", "classic", "traffic", "linux", "yk2000", "aero"];

const NEOFETCH_LOGO = [
  "  ██████╗ ██████╗ ██████╗ ██╗████████╗",
  " ██╔═══██╗██╔══██╗██╔══██╗██║╚══██╔══╝",
  " ██║   ██║██████╔╝██████╔╝██║   ██║   ",
  " ██║   ██║██╔══██╗██╔══██╗██║   ██║   ",
  " ╚██████╔╝██║  ██║██████╔╝██║   ██║   ",
  "  ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ",
];

export function Terminal({ windowId }: AppProps) {
  const getChildren = useFileSystemStore((s) => s.getChildren);
  const getNode = useFileSystemStore((s) => s.getNode);
  const getPath = useFileSystemStore((s) => s.getPath);
  const createNode = useFileSystemStore((s) => s.createNode);
  const deleteNode = useFileSystemStore((s) => s.deleteNode);
  const rootId = useFileSystemStore((s) => s.rootId);
  const username = useSystemStore((s) => s.username);
  const theme = useSystemStore((s) => s.theme);
  const windowStyle = useSystemStore((s) => s.windowStyle);
  const activeWorkspace = useWindowStore((s) => s.activeWorkspace);

  const [lines, setLines] = useState<Line[]>([{ text: WELCOME, kind: "out" }]);
  const [input, setInput] = useState("");
  const [cwdId, setCwdId] = useState(rootId);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyPos, setHistoryPos] = useState(-1);

  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    outRef.current?.scrollTo(0, outRef.current.scrollHeight);
  }, [lines]);

  function prompt() {
    return `${username}@orbit:${getPath(cwdId)}$ `;
  }

  function runCommand(raw: string) {
    const trimmed = raw.trim();
    const newLines: Line[] = [{ text: prompt() + trimmed, kind: "in" }];

    if (!trimmed) {
      setLines((prev) => [...prev, ...newLines]);
      return;
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    const argStr = args.join(" ");

    function out(text: string) { newLines.push({ text, kind: "out" }); }
    function err(text: string) { newLines.push({ text, kind: "err" }); playSound("error"); }

    switch (cmd) {
      case "help":
        out("Available commands:");
        out("  help      Show this message");
        out("  whoami    Print current user");
        out("  date      Print current date/time");
        out("  echo      Print text");
        out("  clear     Clear terminal");
        out("  pwd       Print working directory");
        out("  ls        List directory contents");
        out("  cd        Change directory");
        out("  cat       Print file contents");
        out("  mkdir     Create a folder");
        out("  touch     Create an empty file");
        out("  rm        Remove a file or folder");
        out("  open      Launch an app (e.g. open calculator)");
        out("  neofetch  System info");
        out("  theme     Show / set the theme (orbit, dark, midnight, light)");
        out("  style     Show / set the window style (orbit, classic, traffic, linux, yk2000, aero)");
        out("  ws        Show / switch virtual desktop (ws 2)");
        out("  ps        List open windows");
        out("  kill      Close a window by its ps number (kill 3)");
        out("  notify    Send yourself a notification");
        out("  lock      Lock the screen");
        out("  restart   Close everything and reboot");
        break;

      case "theme": {
        const st = useSystemStore.getState();
        if (!argStr) { out(`theme: ${st.theme}  (available: ${THEME_NAMES.join(", ")})`); break; }
        const t = THEME_NAMES.find((n) => n === argStr.toLowerCase());
        if (!t) { err(`theme: unknown theme '${argStr}' (try: ${THEME_NAMES.join(", ")})`); break; }
        st.setTheme(t);
        out(`Theme set to ${t}`);
        break;
      }

      case "style": {
        const st = useSystemStore.getState();
        if (!argStr) { out(`style: ${st.windowStyle}  (available: ${STYLE_NAMES.join(", ")})`); break; }
        const w = STYLE_NAMES.find((n) => n === argStr.toLowerCase());
        if (!w) { err(`style: unknown style '${argStr}' (try: ${STYLE_NAMES.join(", ")})`); break; }
        st.setWindowStyle(w);
        out(`Window style set to ${w}`);
        break;
      }

      case "ws": {
        const ws = useWindowStore.getState();
        if (!argStr) { out(`Desktop ${ws.activeWorkspace + 1} of ${WORKSPACE_COUNT}`); break; }
        const n = Number(argStr);
        if (!Number.isInteger(n) || n < 1 || n > WORKSPACE_COUNT) { err(`ws: expected a number from 1 to ${WORKSPACE_COUNT}`); break; }
        ws.switchWorkspace(n - 1);
        out(`Switched to desktop ${n}`);
        break;
      }

      case "ps": {
        const list = useWindowStore.getState().windows;
        if (list.length === 0) { out("No windows open."); break; }
        list.forEach((w, i) => {
          out(`${String(i + 1).padStart(3)}  desk ${w.workspace + 1}  ${w.isMinimized ? "min " : "run "}  ${w.title}`);
        });
        break;
      }

      case "kill": {
        const list = useWindowStore.getState().windows;
        const n = Number(argStr);
        if (!Number.isInteger(n) || n < 1 || n > list.length) { err("kill: expected a window number from 'ps'"); break; }
        const target = list[n - 1];
        if (target.id === windowId) { err("kill: refusing to close this terminal"); break; }
        useWindowStore.getState().closeWindow(target.id);
        out(`Closed “${target.title}”`);
        break;
      }

      case "notify": {
        if (!argStr) { err("notify: missing message (try: notify build finished)"); break; }
        notify({ title: "Terminal", body: argStr, kind: "info", appId: "terminal" });
        out("Notification sent.");
        break;
      }

      case "lock":
        lockOS();
        break;

      case "restart":
        restartOS();
        break;

      case "open": {
        if (!argStr) { err("open: missing app name (try: open calculator)"); break; }
        const query = argStr.toLowerCase().replace(/\s+/g, "-");
        const app = Object.values(appRegistry).find(
          (a) => a.id === query || a.name.toLowerCase() === argStr.toLowerCase(),
        );
        if (!app) { err(`open: no app named '${argStr}'`); break; }
        launchApp(app.id as AppId);
        out(`Launching ${app.name}…`);
        break;
      }

      case "whoami":
        out(username);
        break;

      case "date":
        out(new Date().toString());
        break;

      case "echo":
        out(argStr);
        break;

      case "clear":
        setLines([]);
        setInput("");
        setCmdHistory((prev) => [...prev, trimmed]);
        setHistoryPos(-1);
        return;

      case "pwd":
        out(getPath(cwdId));
        break;

      case "ls": {
        const children = getChildren(cwdId);
        if (children.length === 0) {
          out("(empty)");
        } else {
          out(children.map((n) => n.name + (n.type === "folder" ? "/" : "")).join("  "));
        }
        break;
      }

      case "cd": {
        if (args.length === 0 || argStr === "/" || argStr === "~") {
          setCwdId(rootId);
        } else if (argStr === "..") {
          const current = getNode(cwdId);
          if (current?.parentId) setCwdId(current.parentId);
        } else {
          const children = getChildren(cwdId);
          const target = children.find((n) => n.name === argStr && n.type === "folder");
          if (target) {
            setCwdId(target.id);
          } else {
            err(`cd: no such directory: ${argStr}`);
          }
        }
        break;
      }

      case "cat": {
        if (!argStr) { err("cat: missing file name"); break; }
        const children = getChildren(cwdId);
        const file = children.find((n) => n.name === argStr);
        if (!file) { err(`cat: no such file: ${argStr}`); break; }
        if (file.type === "folder") { err(`cat: ${argStr}: Is a directory`); break; }
        out(file.content ?? "");
        break;
      }

      case "mkdir": {
        if (!argStr) { err("mkdir: missing folder name"); break; }
        createNode(cwdId, argStr, "folder");
        break;
      }

      case "touch": {
        if (!argStr) { err("touch: missing file name"); break; }
        createNode(cwdId, argStr, "file", "");
        break;
      }

      case "rm": {
        if (!argStr) { err("rm: missing name"); break; }
        const children = getChildren(cwdId);
        const target = children.find((n) => n.name === argStr);
        if (!target) { err(`rm: no such file or directory: ${argStr}`); break; }
        deleteNode(target.id);
        break;
      }

      case "neofetch": {
        const info = [
          `  User:   ${username}`,
          `  OS:     OrbitOS v1.0 (Stardance)`,
          `  Theme:  ${theme}`,
          `  Style:  ${windowStyle}`,
          `  Shell:  orbitsh 1.1`,
          `  Uptime: ${Math.floor(performance.now() / 60000)}m`,
          `  Desks:  ${activeWorkspace + 1}/${WORKSPACE_COUNT}`,
        ];
        for (let i = 0; i < Math.max(NEOFETCH_LOGO.length, info.length); i++) {
          const logo = NEOFETCH_LOGO[i] ?? "                              ";
          const detail = info[i] ?? "";
          out(logo + "  " + detail);
        }
        break;
      }

      default:
        err(`command not found: ${cmd}`);
    }

    setLines((prev) => [...prev, ...newLines]);
    setCmdHistory((prev) => [...prev, trimmed]);
    setHistoryPos(-1);
  }

  const COMMANDS = ["help", "whoami", "date", "echo", "clear", "pwd", "ls", "cd", "cat", "mkdir", "touch", "rm", "open", "neofetch", "theme", "style", "ws", "ps", "kill", "notify", "lock", "restart"];

  function handleTab() {
    const parts = input.split(/\s+/);

    if (parts.length <= 1) {
      const prefix = parts[0].toLowerCase();
      const matches = COMMANDS.filter((c) => c.startsWith(prefix));
      if (matches.length === 1) {
        setInput(matches[0] + " ");
      } else if (matches.length > 1) {
        setLines((prev) => [...prev, { text: matches.join("  "), kind: "out" }]);
      }
      return;
    }

    const partial = parts[parts.length - 1].toLowerCase();
    const children = getChildren(cwdId);
    const matches = children.filter((n) => n.name.toLowerCase().startsWith(partial));

    if (matches.length === 1) {
      const completed = matches[0].name;
      parts[parts.length - 1] = completed;
      setInput(parts.join(" "));
    } else if (matches.length > 1) {
      const names = matches.map((n) => n.name);
      setLines((prev) => [...prev, { text: names.join("  "), kind: "out" }]);

      let common = matches[0].name;
      for (const m of matches) {
        while (common && !m.name.toLowerCase().startsWith(common.toLowerCase())) {
          common = common.slice(0, -1);
        }
      }
      if (common.length > partial.length) {
        parts[parts.length - 1] = common;
        setInput(parts.join(" "));
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      handleTab();
    } else if (e.key === "Enter") {
      runCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const next = historyPos === -1 ? cmdHistory.length - 1 : Math.max(0, historyPos - 1);
      setHistoryPos(next);
      setInput(cmdHistory[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyPos === -1) return;
      const next = historyPos + 1;
      if (next >= cmdHistory.length) {
        setHistoryPos(-1);
        setInput("");
      } else {
        setHistoryPos(next);
        setInput(cmdHistory[next]);
      }
    }
  }

  return (
    <div className="term" onClick={() => inputRef.current?.focus()}>
      <div className="term__out" ref={outRef}>
        {lines.map((line, i) => (
          <div key={i} className={`term__line--${line.kind}`}>{line.text}</div>
        ))}
      </div>
      <div className="term__prompt-row">
        <span className="term__prompt">{prompt()}</span>
        <input
          ref={inputRef}
          className="term__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}
