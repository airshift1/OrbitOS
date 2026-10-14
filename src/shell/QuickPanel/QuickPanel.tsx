import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSystemStore } from "../../stores/useSystemStore";
import { useNotificationStore, type NotifKind } from "../../stores/useNotificationStore";
import { launchApp } from "../../lib/launch";
import { timeAgo, cx } from "../../lib/helpers";
import { playSound } from "../../lib/sound";
import { Button, EmptyState, Switch } from "../../ui";
import "./QuickPanel.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

const KIND_LABEL: Record<NotifKind, string> = { info: "Info", success: "Done", warning: "Warning", error: "Error" };

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <li className="qp__toggle">
      <span className="qp__toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </li>
  );
}

/** Quick settings and the notification list. */
export function QuickPanel({ open, onClose }: Props) {
  const s = useSystemStore();
  const items = useNotificationStore((n) => n.items);
  const remove = useNotificationStore((n) => n.remove);
  const clear = useNotificationStore((n) => n.clear);
  const markAllRead = useNotificationStore((n) => n.markAllRead);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(markAllRead, 700);
    const refresh = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(refresh);
    };
  }, [open, markAllRead]);

  if (!open) return null;

  return (
    <>
      <div className="quickpanel-scrim" onMouseDown={onClose} />
      <div className="quickpanel" role="dialog" aria-label="Quick settings and notifications">
        <section className="qp__section" aria-label="Quick settings">
          <ul className="qp__toggles">
            <ToggleRow label="Wi-Fi" hint="Simulated" checked={s.wifi} onChange={s.setWifi} />
            <ToggleRow label="Bluetooth" hint="Simulated" checked={s.bluetooth} onChange={s.setBluetooth} />
            <ToggleRow label="Do not disturb" hint="No pop-ups or alert sounds" checked={s.doNotDisturb} onChange={s.setDoNotDisturb} />
            <ToggleRow label="Light theme" checked={s.theme === "light"} onChange={(v) => s.setTheme(v ? "light" : "orbit")} />
            <ToggleRow label="Night light" checked={s.nightMode} onChange={s.setNightMode} />
            <ToggleRow label="Sound" checked={s.soundEnabled} onChange={() => s.toggleSound()} />
          </ul>
        </section>

        <section className="qp__section qp__sliders" aria-label="Volume and brightness">
          <label className="qp__slider">
            <span>Volume</span>
            <input type="range" className="range" min={0} max={100} value={s.volume} onChange={(e) => s.setVolume(Number(e.target.value))} onPointerUp={() => playSound("click")} />
            <output>{s.volume}</output>
          </label>
          <label className="qp__slider">
            <span>Brightness</span>
            <input type="range" className="range" min={20} max={100} value={s.brightness} onChange={(e) => s.setBrightness(Number(e.target.value))} />
            <output>{s.brightness}</output>
          </label>
        </section>

        <section className="qp__section" aria-label="Notifications">
          <div className="qp__head">
            <h2 className="eyebrow">Notifications{items.length > 0 ? ` · ${items.length}` : ""}</h2>
            {items.length > 0 && (
              <Button variant="quiet" size="sm" onClick={clear}>
                Clear all
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState title="Nothing new">Notifications from apps show up here.</EmptyState>
          ) : (
            <ul className="rows">
              {items.map((n) => (
                <li key={n.id} className={cx("qp__item", !n.read && "qp__item--unread")}>
                  <button
                    type="button"
                    className="qp__item-main"
                    onClick={() => {
                      if (n.appId) {
                        onClose();
                        launchApp(n.appId);
                      }
                      remove(n.id);
                    }}
                  >
                    <span className="qp__item-text">
                      <strong>{n.title}</strong>
                      {n.body && <small>{n.body}</small>}
                      <em>
                        {KIND_LABEL[n.kind]} · {timeAgo(n.time)}
                      </em>
                    </span>
                  </button>
                  <button type="button" className="qp__item-x" aria-label={`Dismiss ${n.title}`} onClick={() => remove(n.id)}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
