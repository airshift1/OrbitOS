import { useEffect, useRef, useState } from "react";
import { Eye, X, Wifi, WifiOff } from "lucide-react";
import type { AppProps } from "../../types";
import { useWindowStore } from "../../stores/useWindowStore";
import { useSystemStore } from "../../stores/useSystemStore";
import { useFileSystemStore } from "../../stores/useFileSystemStore";
import { getApp } from "../registry";
import { getIcon } from "../../lib/icons";
import { formatBytes, clamp, cx } from "../../lib/helpers";
import "./TaskManager.css";

/**
 * System Monitor = WebOS-main's Task Manager (Processes tab) + OrbitOS's
 * System Monitor (Performance tab). The OrbitOS mock-up used random numbers;
 * here every gauge is measured from the browser:
 *   - Main thread : share of the last second spent in long tasks (PerformanceObserver)
 *   - Frame rate  : requestAnimationFrame cadence
 *   - JS memory   : performance.memory (Chromium only)
 *   - Storage     : navigator.storage.estimate() + the size of the virtual file system
 */

const HISTORY = 48;

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

interface Sample {
  busy: number;
  fps: number;
  heapMB: number | null;
}

interface PerfSnapshot {
  history: Sample[];
  heapLimitMB: number | null;
  storageUsed: number | null;
  storageQuota: number | null;
  longTasksSupported: boolean;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function usePerformance(): PerfSnapshot {
  const [snap, setSnap] = useState<PerfSnapshot>({
    history: [],
    heapLimitMB: null,
    storageUsed: null,
    storageQuota: null,
    longTasksSupported: false,
  });
  const frames = useRef(0);
  const longMs = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      frames.current++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let observer: PerformanceObserver | null = null;
    let supported = false;
    try {
      if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
        supported = true;
        observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longMs.current += e.duration;
        });
        observer.observe({ entryTypes: ["longtask"] });
      }
    } catch {
      supported = false;
    }

    let last = performance.now();
    const id = setInterval(async () => {
      const now = performance.now();
      const dt = Math.max(1, now - last);
      last = now;
      const fps = Math.min(120, Math.round((frames.current * 1000) / dt));
      frames.current = 0;
      const busy = supported
        ? clamp(Math.round((longMs.current / dt) * 100), 0, 100)
        : // no Long Tasks API: infer load from dropped frames
          clamp(Math.round(((60 - Math.min(60, fps)) / 60) * 100), 0, 100);
      longMs.current = 0;

      const mem = (performance as Performance & { memory?: MemoryInfo }).memory;
      let storageUsed: number | null = null;
      let storageQuota: number | null = null;
      try {
        const est = await navigator.storage?.estimate?.();
        storageUsed = est?.usage ?? null;
        storageQuota = est?.quota ?? null;
      } catch {
        /* unavailable */
      }

      setSnap((prev) => ({
        history: [
          ...prev.history.slice(-(HISTORY - 1)),
          { busy, fps, heapMB: mem ? mem.usedJSHeapSize / 1048576 : null },
        ],
        heapLimitMB: mem ? mem.jsHeapSizeLimit / 1048576 : null,
        storageUsed,
        storageQuota,
        longTasksSupported: supported,
      }));
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
      observer?.disconnect();
    };
  }, []);

  return snap;
}

function Sparkline({ values, max, color }: { values: number[]; max: number; color: string }) {
  const W = 120;
  const H = 34;
  if (values.length < 2) return <svg className="tm__spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" />;
  const step = W / (HISTORY - 1);
  const offset = (HISTORY - values.length) * step;
  const pts = values.map((v, i) => `${(offset + i * step).toFixed(1)},${(H - 2 - (clamp(v, 0, max) / max) * (H - 4)).toFixed(1)}`);
  const line = pts.join(" ");
  return (
    <svg className="tm__spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`${offset},${H} ${line} ${W},${H}`} fill={color} opacity="0.14" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface CardProps {
  label: string;
  value: string;
  sub: string;
  values?: number[];
  max?: number;
  color: string;
  bar?: number;
}

function Card({ label, value, sub, values, max = 100, color, bar }: CardProps) {
  return (
    <div className="tm__card">
      <div className="tm__card-head">
        <span>{label}</span>
        <strong style={{ color }}>{value}</strong>
      </div>
      {values && <Sparkline values={values} max={max} color={color} />}
      {bar !== undefined && (
        <div className="tm__bar">
          <div style={{ width: `${clamp(bar, 0, 100)}%`, background: color }} />
        </div>
      )}
      <small>{sub}</small>
    </div>
  );
}

type NetInfo = { effectiveType?: string; downlink?: number };

export function TaskManager({ windowId }: AppProps) {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore((s) => s.focusedId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const theme = useSystemStore((s) => s.theme);
  const wifi = useSystemStore((s) => s.wifi);
  const nodes = useFileSystemStore((s) => s.nodes);

  const [tab, setTab] = useState<"performance" | "processes">("performance");
  const [uptime, setUptime] = useState(performance.now());
  const perf = usePerformance();

  useEffect(() => {
    const id = setInterval(() => setUptime(performance.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function closeAll() {
    // close everything except the monitor itself
    for (const win of windows) {
      if (win.id !== windowId) closeWindow(win.id);
    }
  }

  const latest = perf.history[perf.history.length - 1];
  const vfsBytes = Object.values(nodes).reduce((n, node) => n + (node.content?.length ?? 0) + node.name.length, 0);
  const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
  const online = navigator.onLine;

  const heapSeries = perf.history.map((h) => h.heapMB ?? 0);
  const heapMax = perf.heapLimitMB ? Math.max(64, Math.max(...heapSeries, 1) * 1.4) : 100;

  return (
    <div className="tm">
      <div className="tm__tabs" role="tablist">
        {(["performance", "processes"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={cx("tm__tab", tab === t && "tm__tab--on")}
            onClick={() => setTab(t)}
          >
            {t === "performance" ? "Performance" : `Processes (${windows.length})`}
          </button>
        ))}
        <span className="tm__net" title="Network status (reported by your browser)">
          {online && wifi ? <Wifi size={13} /> : <WifiOff size={13} />}
          {online && wifi ? "Online" : "Offline"}
          {conn?.effectiveType ? ` · ${conn.effectiveType}` : ""}
          {conn?.downlink ? ` · ${conn.downlink} Mbps` : ""}
        </span>
      </div>

      {tab === "performance" ? (
        <div className="tm__perf">
          <div className="tm__stats">
            <div className="tm__stat">
              <span>Uptime</span>
              <strong>{formatUptime(uptime)}</strong>
            </div>
            <div className="tm__stat">
              <span>Windows</span>
              <strong>{windows.length}</strong>
            </div>
            <div className="tm__stat">
              <span>Theme</span>
              <strong style={{ textTransform: "capitalize" }}>{theme}</strong>
            </div>
            <div className="tm__stat">
              <span>Files</span>
              <strong>{Object.keys(nodes).length}</strong>
            </div>
          </div>

          <div className="tm__cards">
            <Card
              label="Main thread"
              value={latest ? `${latest.busy}%` : "—"}
              sub={perf.longTasksSupported ? "Time spent in long tasks" : "Estimated from dropped frames"}
              values={perf.history.map((h) => h.busy)}
              color="var(--color-accent-text)"
            />
            <Card
              label="Frame rate"
              value={latest ? `${latest.fps} fps` : "—"}
              sub="requestAnimationFrame cadence"
              values={perf.history.map((h) => h.fps)}
              max={75}
              color="var(--color-text)"
            />
            {perf.heapLimitMB !== null ? (
              <Card
                label="JS memory"
                value={latest?.heapMB != null ? `${latest.heapMB.toFixed(0)} MB` : "—"}
                sub={`of ${perf.heapLimitMB.toFixed(0)} MB heap limit`}
                values={heapSeries}
                max={heapMax}
                color="var(--color-text-dim)"
              />
            ) : (
              <Card label="JS memory" value="n/a" sub="Not exposed by this browser" color="var(--color-text-dim)" bar={0} />
            )}
            <Card
              label="Storage"
              value={formatBytes(vfsBytes)}
              sub={
                perf.storageUsed !== null && perf.storageQuota
                  ? `Virtual disk · site uses ${formatBytes(perf.storageUsed)} of ${formatBytes(perf.storageQuota)}`
                  : "Virtual disk (files & notes)"
              }
              bar={perf.storageUsed !== null && perf.storageQuota ? (perf.storageUsed / perf.storageQuota) * 100 : Math.min(100, vfsBytes / 50_000)}
              color="var(--color-accent-text)"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="tm__header">
            <span>Running tasks</span>
            <button className="tm__endall" onClick={closeAll} disabled={windows.length <= 1}>
              End all tasks
            </button>
          </div>

          <div className="tm__list">
            {windows.map((win) => {
              const AppIcon = getIcon(win.icon);
              const isSelf = win.id === windowId;
              return (
                <div key={win.id} className={`tm__row ${win.id === focusedId ? "tm__row--focused" : ""}`}>
                  <AppIcon size={16} className="tm__row-icon" />
                  <div className="tm__row-info">
                    <div className="tm__row-title">{win.title}</div>
                    <div className="tm__row-sub">
                      {getApp(win.appId).name} · {win.isMinimized ? "Minimized" : "Running"} · Desktop {win.workspace + 1}
                    </div>
                  </div>
                  <button className="tm__row-btn" onClick={() => focusWindow(win.id)} title="Focus">
                    <Eye size={14} />
                  </button>
                  <button
                    className="tm__row-btn tm__row-btn--danger"
                    onClick={() => closeWindow(win.id)}
                    disabled={isSelf}
                    title={isSelf ? "That's me!" : "End task"}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
