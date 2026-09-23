import { X } from "lucide-react";
import { useNotificationStore } from "../../stores/useNotificationStore";
import { launchApp } from "../../lib/launch";
import "./QuickPanel.css";

/** Transient notification pop-ups (top-right). Suppressed by Do Not Disturb. */
export function ToastStack() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismiss = useNotificationStore((s) => s.dismissToast);
  const remove = useNotificationStore((s) => s.remove);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        return (
          <div key={t.id} className={`toast toast--${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
            <button
              type="button"
              className="toast__main"
              onClick={() => {
                dismiss(t.id);
                if (t.appId) {
                  remove(t.id);
                  launchApp(t.appId);
                }
              }}
            >
              <span className="toast__text">
                <strong>{t.title}</strong>
                {t.body && <small>{t.body}</small>}
              </span>
            </button>
            <button type="button" className="toast__x" aria-label={`Dismiss ${t.title}`} onClick={() => dismiss(t.id)}>
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
