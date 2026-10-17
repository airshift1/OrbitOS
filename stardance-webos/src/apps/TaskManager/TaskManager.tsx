import { useEffect, useMemo, useState } from "react";
import type { AppProps } from "../../types";
import { useSystemStore } from "../../stores/useSystemStore";
import "./TaskManager.css";

type TaskItem = {
  id: string;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  focused: boolean;
  killable: boolean;
};

const INITIAL_TASKS: TaskItem[] = [
  { id: "desktop", name: "Desktop Shell", status: "active", cpu: 24, memory: 30, focused: true, killable: false },
  { id: "browser", name: "Orbit Browser", status: "active", cpu: 18, memory: 17, focused: true, killable: true },
  { id: "notes", name: "Notes", status: "idle", cpu: 4, memory: 7, focused: false, killable: true },
  { id: "terminal", name: "Terminal", status: "running", cpu: 9, memory: 12, focused: false, killable: true },
  { id: "system", name: "Theme Engine", status: "background", cpu: 6, memory: 11, focused: false, killable: false },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function sparkline(points: number[]) {
  if (points.length === 0) return "";
  const max = Math.max(...points, 1);
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - (point / max) * 100;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function TaskManager({ windowId }: AppProps) {
  const accentColor = useSystemStore((s) => s.accentColor);
  const theme = useSystemStore((s) => s.theme);

  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [cpuUsage, setCpuUsage] = useState(42);
  const [memUsage, setMemUsage] = useState(63);
  const [network, setNetwork] = useState({ up: 28, down: 61 });
  const [tab, setTab] = useState<"apps" | "performance">("apps");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCpuUsage((value) => clamp(value + (Math.random() > 0.5 ? 1 : -1) * 5, 10, 95));
      setMemUsage((value) => clamp(value + (Math.random() > 0.5 ? 1 : -1) * 4, 18, 88));
      setNetwork((value) => ({
        up: clamp(value.up + (Math.random() > 0.5 ? 5 : -4), 10, 90),
        down: clamp(value.down + (Math.random() > 0.5 ? 6 : -3), 15, 100),
      }));
      setTasks((current) =>
        current.map((task) => ({
          ...task,
          cpu: clamp(task.cpu + (Math.random() > 0.6 ? 7 : -4), 1, 72),
          memory: clamp(task.memory + (Math.random() > 0.65 ? 5 : -3), 1, 52),
        })),
      );
    }, 1600);

    return () => window.clearInterval(interval);
  }, [windowId]);

  const totalCpu = useMemo(() => tasks.reduce((sum, task) => sum + task.cpu, 0), [tasks]);
  const totalMemory = useMemo(() => tasks.reduce((sum, task) => sum + task.memory, 0), [tasks]);
  const running = tasks.filter((task) => task.killable).length;
  const active = tasks.filter((task) => task.focused).length;

  const cpuHistory = useMemo(() => Array.from({ length: 12 }, (_, index) => clamp(cpuUsage - (index * 5) + (index % 3) * 2, 0, 100)), [cpuUsage]);
  const memoryHistory = useMemo(() => Array.from({ length: 12 }, (_, index) => clamp(memUsage - (index * 4) + (index % 2) * 3, 0, 100)), [memUsage]);

  const endAll = () => {
    setTasks((current) => current.filter((task) => !task.killable));
  };

  const handleKill = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  return (
    <div className="tm">
      <div className="tm__stats">
        <div className="tm__stat">
          <span>CPU</span>
          <strong>{cpuUsage}%</strong>
        </div>
        <div className="tm__stat">
          <span>Memory</span>
          <strong>{memUsage}%</strong>
        </div>
        <div className="tm__stat">
          <span>Active</span>
          <strong>{active}</strong>
        </div>
        <div className="tm__stat">
          <span>Theme</span>
          <strong>{theme}</strong>
        </div>
      </div>

      <div className="tm__tabs" role="tablist" aria-label="Performance tabs">
        <button className={`tm__tab ${tab === "apps" ? "tm__tab--on" : ""}`} type="button" onClick={() => setTab("apps")}>
          Apps
        </button>
        <button className={`tm__tab ${tab === "performance" ? "tm__tab--on" : ""}`} type="button" onClick={() => setTab("performance")}>
          Performance
        </button>
        <span className="tm__net">
          <span>{network.down}↓</span>
          <span>{network.up}↑</span>
        </span>
      </div>

      {tab === "apps" ? (
        <>
          <div className="tm__header">
            <span>Running tasks</span>
            <button className="tm__endall" type="button" onClick={endAll} disabled={running === 0}>
              End all
            </button>
          </div>

          <div className="tm__list">
            {tasks.map((task) => (
              <div key={task.id} className={`tm__row ${task.focused ? "tm__row--focused" : ""}`}>
                <div className="tm__row-icon" style={{ color: accentColor }}>●</div>
                <div className="tm__row-info">
                  <div className="tm__row-title">{task.name}</div>
                  <div className="tm__row-sub">
                    {task.status} · {task.cpu}% CPU · {task.memory}% RAM
                  </div>
                </div>
                <button
                  type="button"
                  className="tm__row-btn tm__row-btn--danger"
                  onClick={() => handleKill(task.id)}
                  disabled={!task.killable}
                  aria-label={`Stop ${task.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="tm__perf">
          <div className="tm__cards">
            <div className="tm__card">
              <div className="tm__card-head">
                <span>CPU load</span>
                <strong>{cpuUsage}%</strong>
              </div>
              <svg className="tm__spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="CPU usage over time">
                <path d={sparkline(cpuHistory)} fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />
              </svg>
              <small>{totalCpu}% combined app load</small>
            </div>

            <div className="tm__card">
              <div className="tm__card-head">
                <span>Memory</span>
                <strong>{memUsage}%</strong>
              </div>
              <svg className="tm__spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Memory usage over time">
                <path d={sparkline(memoryHistory)} fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />
              </svg>
              <small>{totalMemory}% used by active tasks</small>
            </div>

            <div className="tm__card">
              <div className="tm__card-head">
                <span>Network</span>
                <strong>{network.down}Mbps</strong>
              </div>
              <div className="tm__bar">
                <div style={{ width: `${network.down}%`, background: accentColor }} />
              </div>
              <small>Downlink {network.down} Mbps · Uplink {network.up} Mbps</small>
            </div>

            <div className="tm__card">
              <div className="tm__card-head">
                <span>System</span>
                <strong>{tasks.length}</strong>
              </div>
              <div className="tm__bar">
                <div style={{ width: `${Math.min(100, (tasks.length / 8) * 100)}%`, background: accentColor }} />
              </div>
              <small>{running} running processes · {active} focused</small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
