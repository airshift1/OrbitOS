import { useWindowStore } from "../../stores/useWindowStore";
import { WORKSPACE_INDICES } from "../../lib/workspaces";
import { cx } from "../../lib/helpers";

/** Virtual-desktop pills. A dot marks desktops that hold windows. */
export function WorkspaceSwitcher() {
  const active = useWindowStore((s) => s.activeWorkspace);
  const windows = useWindowStore((s) => s.windows);
  const switchWorkspace = useWindowStore((s) => s.switchWorkspace);

  return (
    <div className="ws-switcher" role="tablist" aria-label="Virtual desktops">
      {WORKSPACE_INDICES.map((i) => {
        const count = windows.filter((w) => w.workspace === i).length;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={cx("ws-switcher__pill", i === active && "ws-switcher__pill--active", count > 0 && "ws-switcher__pill--busy")}
            title={`Desktop ${i + 1}${count ? ` · ${count} window${count > 1 ? "s" : ""}` : ""}  (Ctrl+Alt+${i + 1})`}
            onClick={() => switchWorkspace(i)}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
