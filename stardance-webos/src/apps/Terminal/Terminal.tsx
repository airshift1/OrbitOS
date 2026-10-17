import { useEffect, useRef, useState } from "react";
import type { AppId, AppProps } from "../../types";
import { useFileSystemStore } from "../../stores/useFileSystemStore";
import { useSystemStore } from "../../stores/useSystemStore";
import { launchApp } from "../../lib/launch";
import { playSound } from "../../lib/sound";
import "./Terminal.css";

interface Line {
  text: string;
  kind: "in" | "out" | "err";
}

const WELCOME = "OrbitOS Terminal v1.1    type 'help' to get started\n";

const NEOFETCH_LOGO = [
  "     .-''''-.      ",
  "   .'  _  _  '.    ",
  "  /   (o) (o)  \\  ",
  "  |   .--. .-. |  ",
  "  |  /    Y    \\ | ",
  "  |  \\  ___  / / | ",
  "  |   '.__.'  /  | ",
  "   '._.___._.'   ",
  "      /|\\        ",
  "     / | \\       ",
  "       / \\\\       ",
  "      /   \\\\      ",
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
  const [lines, setLines] = useState<Line[]>([{ text: WELCOME, kind: "out" }]);
  const [input, setInput] = useState("");
  const [cwdId, setCwdId] = useState(rootId);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyPos, setHistoryPos] = useState(-1);

  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [windowId]);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight, behavior: "auto" });
  }, [lines]);

  const prompt = `${username}@orbit:${getPath(cwdId)}$`;

  const pushLines = (items: Line[]) => {
    setLines((prev) => [...prev, ...items]);
  };

  const runCommand = (raw: string) => {
    const trimmed = raw.trim();
    const newLines: Line[] = [{ text: trimmed ? `${prompt} ${trimmed}` : prompt, kind: "in" }];

    if (!trimmed) {
      pushLines(newLines);
      setInput("");
      return;
    }

    if (trimmed === "clear") {
      setLines([{ text: WELCOME, kind: "out" }]);
      setInput("");
      setHistoryPos(-1);
      return;
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const writeOut = (text: string) => {
      newLines.push({ text, kind: "out" });
    };

    const writeErr = (text: string) => {
      newLines.push({ text, kind: "err" });
      playSound("error");
    };

    switch (command) {
      case "help": {
        writeOut("Available commands:");
        writeOut("  help      Show this message");
        writeOut("  whoami    Print current user");
        writeOut("  date      Print current date and time");
        writeOut("  echo      Print text");
        writeOut("  pwd       Print working directory");
        writeOut("  ls        List directory contents");
        writeOut("  cd        Change directory");
        writeOut("  cat       Print file contents");
        writeOut("  mkdir     Create a folder");
        writeOut("  touch     Create an empty file");
        writeOut("  rm        Remove a file or folder");
        writeOut("  open      Launch an app (for example: open calculator)");
        writeOut("  neofetch  Show system info");
        writeOut("  theme     Show or set theme (orbit, dark, midnight, light)");
        break;
      }
      case "whoami":
        writeOut(username);
        break;
      case "date":
        writeOut(new Date().toString());
        break;
      case "echo":
        writeOut(args.join(" ") || "");
        break;
      case "pwd":
        writeOut(getPath(cwdId));
        break;
      case "ls": {
        const children = getChildren(cwdId).map((node) => `${node.type === "folder" ? "[dir]" : "[file]"} ${node.name}`);
        if (children.length === 0) {
          writeOut("(empty)");
        } else {
          writeOut(children.join("\n"));
        }
        break;
      }
      case "cd": {
        if (args.length === 0) {
          setCwdId(rootId);
          break;
        }
        const target = args[0];
        if (target === "/") {
          setCwdId(rootId);
          break;
        }
        const raw = target.replace(/^\/+|\/+$/g, "");
        if (!raw || raw === ".") {
          break;
        }
        if (raw === "..") {
          const current = getNode(cwdId);
          const parentId = current?.parentId ?? rootId;
          setCwdId(parentId);
          break;
        }
        const match = getChildren(cwdId).find((node) => node.name === raw && node.type === "folder");
        if (!match) {
          writeErr(`cd: ${raw}: No such directory`);
          break;
        }
        setCwdId(match.id);
        break;
      }
      case "cat": {
        const fileName = args[0];
        if (!fileName) {
          writeErr("cat: missing file name");
          break;
        }
        const file = getChildren(cwdId).find((node) => node.name === fileName && node.type === "file");
        if (!file) {
          const node = getNode(fileName);
          if (node && node.type === "file") {
            writeOut(node.content ?? "");
            break;
          }
          writeErr(`cat: ${fileName}: No such file`);
          break;
        }
        writeOut(file.content ?? "");
        break;
      }
      case "mkdir": {
        const name = args[0];
        if (!name) {
          writeErr("mkdir: missing directory name");
          break;
        }
        const created = createNode(cwdId, name, "folder");
        if (!created) {
          writeErr(`mkdir: cannot create ${name}`);
        } else {
          writeOut(`created ${name}`);
        }
        break;
      }
      case "touch": {
        const name = args[0];
        if (!name) {
          writeErr("touch: missing file name");
          break;
        }
        const created = createNode(cwdId, name, "file");
        if (!created) {
          writeErr(`touch: cannot create ${name}`);
        } else {
          writeOut(`created ${name}`);
        }
        break;
      }
      case "rm": {
        const name = args[0];
        if (!name) {
          writeErr("rm: missing target");
          break;
        }
        const target = getChildren(cwdId).find((node) => node.name === name);
        if (!target) {
          writeErr(`rm: ${name}: No such file or directory`);
          break;
        }
        deleteNode(target.id);
        writeOut(`removed ${name}`);
        break;
      }
      case "open": {
        const appId = (args[0] || "").toLowerCase();
        const appNames = new Map<string, AppId>([
          ["calculator", "calculator"],
          ["browser", "browser"],
          ["settings", "settings"],
          ["terminal", "terminal"],
          ["notes", "notes"],
          ["clock", "clock"],
          ["theme", "theme-studio"],
          ["launcher", "launcher"],
          ["monitor", "task-manager"],
          ["file", "file-explorer"],
          ["explorer", "file-explorer"],
          ["welcome", "welcome"],
          ["snake", "snake"],
          ["dino-run", "dino-run"],
          ["orbit-blast", "orbit-blast"],
          ["orbit-depths", "orbit-depths"],
          ["2048", "2048"],
          ["sandtrix", "sandtrix"],
          ["mortal-kombat-mobile", "mortal-kombat-mobile"],
        ]);
        const resolved = appNames.get(appId);
        if (!resolved) {
          writeErr(`open: ${appId || "<missing>"}: unknown app`);
          break;
        }
        launchApp(resolved);
        writeOut(`Launching ${resolved}`);
        break;
      }
      case "neofetch": {
        writeOut(NEOFETCH_LOGO.join("\n"));
        writeOut(`User: ${username}`);
        writeOut(`Theme: ${theme}`);
        writeOut(`Workspace: ${windowId || "desktop"}`);
        writeOut("OS: OrbitOS (browser edition)");
        break;
      }
      case "theme": {
        if (args.length === 0) {
          writeOut(`Current theme: ${theme}`);
          break;
        }
        const requested = args[0].toLowerCase();
        const valid = ["orbit", "dark", "midnight", "light"] as const;
        if (!valid.includes(requested as (typeof valid)[number])) {
          writeErr(`theme: ${requested}: unknown theme`);
          break;
        }
        useSystemStore.getState().setTheme(requested as typeof valid[number]);
        writeOut(`Theme set to ${requested}`);
        break;
      }
      default:
        writeErr(`Command not found: ${command}`);
        break;
    }

    setLines((prev) => [...prev, ...newLines]);
    setInput("");
    setCmdHistory((prev) => [...prev, trimmed]);
    setHistoryPos(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand(input);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const currentPos = historyPos;
      setHistoryPos((prev) => {
        const next = Math.min(prev + 1, cmdHistory.length - 1);
        if (next < 0 || cmdHistory.length === 0) {
          return prev;
        }
        setInput(cmdHistory[cmdHistory.length - 1 - next]);
        return next;
      });
      if (currentPos === historyPos && cmdHistory.length === 0) {
        setInput("");
      }
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHistoryPos((prev) => {
        if (prev <= 0) {
          setInput("");
          return -1;
        }
        const next = prev - 1;
        setInput(cmdHistory[cmdHistory.length - 1 - next]);
        return next;
      });
    }
  };

  return (
    <div className="term" role="textbox" aria-label="OrbitOS terminal" onClick={() => inputRef.current?.focus()}>
      <div className="term__out" ref={outRef}>
        {lines.map((line, index) => (
          <div key={`${line.kind}-${index}`} className={line.kind === "in" ? "term__line--in" : line.kind === "err" ? "term__line--err" : ""}>
            {line.text || " "}
          </div>
        ))}
      </div>
      <div className="term__prompt-row">
        <span className="term__prompt">{prompt}</span>
        <input
          ref={inputRef}
          className="term__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          aria-label="Command input"
        />
      </div>
    </div>
  );
}
