import { useMemo, useState } from "react";
import { Pin, PinOff, Search } from "lucide-react";
import type { AppCategory, AppProps } from "../../types";
import { appList } from "../registry";
import { useSystemStore } from "../../stores/useSystemStore";
import { launchApp } from "../../lib/launch";
import { AppIcon } from "../../shell/AppIcon";
import { Button, EmptyState, Segmented } from "../../ui";
import "./Launcher.css";

type Filter = "All" | AppCategory;
const CATEGORIES: { value: Filter; label: string }[] = ["All", "System", "Productivity", "Internet", "Media", "Tools"].map((c) => ({ value: c as Filter, label: c }));

/** Every installed app, filterable, with a pin toggle for the taskbar. */
export function Launcher(_props: AppProps) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Filter>("All");
  const pinnedApps = useSystemStore((s) => s.pinnedApps);
  const pinApp = useSystemStore((s) => s.pinApp);
  const unpinApp = useSystemStore((s) => s.unpinApp);

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appList.filter((a) => (cat === "All" || a.category === cat) && (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)));
  }, [query, cat]);

  return (
    <div className="launcher">
      <div className="launcher__top">
        <label className="launcher__search">
          <Search size={15} aria-hidden="true" />
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter apps" aria-label="Filter apps" />
        </label>
        <Segmented label="Category" value={cat} onChange={setCat} options={CATEGORIES} />
      </div>

      {apps.length === 0 ? (
        <EmptyState title="No matches">Nothing in “{query}” for this category.</EmptyState>
      ) : (
        <ul className="rows launcher__list">
          {apps.map((a) => {
            const pinned = pinnedApps.includes(a.id);
            return (
              <li key={a.id} className="launcher__row">
                <button type="button" className="launcher__open" onClick={() => launchApp(a.id)}>
                  <AppIcon icon={a.icon} size={32} />
                  <span className="launcher__name">
                    <strong>{a.name}</strong>
                    <span>{a.description}</span>
                  </span>
                  <span className="launcher__cat">{a.category}</span>
                </button>
                <Button
                  variant="quiet"
                  size="sm"
                  iconOnly
                  aria-pressed={pinned}
                  aria-label={pinned ? `Unpin ${a.name} from the taskbar` : `Pin ${a.name} to the taskbar`}
                  title={pinned ? "Unpin from taskbar" : "Pin to taskbar"}
                  onClick={() => (pinned ? unpinApp(a.id) : pinApp(a.id))}
                >
                  {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
