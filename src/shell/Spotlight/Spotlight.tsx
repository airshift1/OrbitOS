import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchAll, type SearchItem } from "../../lib/search";
import { SearchResults } from "./SearchResults";
import "./Spotlight.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Ctrl/Cmd+K launcher (from webos-master), upgraded to search apps, files
 * in the virtual file system, and system actions.
 */
export function Spotlight({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => (open ? searchAll(query) : []), [open, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  function run(item: SearchItem) {
    onClose();
    // let the overlay unmount first so focus lands on the launched window
    setTimeout(item.run, 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[index];
      if (it) run(it);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="spotlight-scrim" onMouseDown={onClose}>
      <div
        className="spotlight"
        role="dialog"
        aria-label="Spotlight search"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="spotlight__input">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps, files and actions…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Search"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="spotlight__results">
          <SearchResults
            items={items}
            activeIndex={index}
            onHover={setIndex}
            onRun={run}
            emptyText={`Nothing matches “${query}”`}
          />
        </div>
        <div className="spotlight__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Ctrl</kbd>+<kbd>K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
