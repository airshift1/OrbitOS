import { useEffect, useRef } from "react";
import type { SearchItem, SearchGroup } from "../../lib/search";
import { AppIcon } from "../AppIcon";
import { cx } from "../../lib/helpers";

interface Props {
  items: SearchItem[];
  activeIndex: number;
  onHover: (i: number) => void;
  onRun: (item: SearchItem) => void;
  emptyText?: string;
}

const GROUP_ORDER: SearchGroup[] = ["Apps", "Files", "Actions"];

/** Grouped result list shared by Spotlight and the Start-menu search. */
export function SearchResults({ items, activeIndex, onHover, onRun, emptyText = "No results" }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (items.length === 0) return <div className="sr-empty">{emptyText}</div>;

  return (
    <div className="sr" role="listbox">
      {GROUP_ORDER.map((group) => {
        const inGroup = items.map((it, index) => ({ it, index })).filter(({ it }) => it.group === group);
        if (inGroup.length === 0) return null;
        return (
          <div key={group} className="sr__group">
            <div className="sr__group-title">{group}</div>
            {inGroup.map(({ it, index }) => (
              <button
                key={it.key}
                ref={index === activeIndex ? activeRef : undefined}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cx("sr__item", index === activeIndex && "sr__item--active")}
                onMouseEnter={() => onHover(index)}
                onClick={() => onRun(it)}
              >
                <AppIcon icon={it.icon} size={32} />
                <span className="sr__text">
                  <span className="sr__title">{it.title}</span>
                  {it.subtitle && <span className="sr__sub">{it.subtitle}</span>}
                </span>
                {index === activeIndex && <kbd className="sr__kbd">↵</kbd>}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
