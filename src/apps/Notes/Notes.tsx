import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import type { AppProps } from "../../types";
import { useNotesStore } from "../../stores/useNotesStore";
import { timeAgo, cx } from "../../lib/helpers";
import { Button, EmptyState } from "../../ui";
import "./Notes.css";

/**
 * Notes — merges OrbitOS's notes list UI with webos-master's localStorage
 * notes: every keystroke is persisted (zustand persist → "webos-notes").
 */
export function Notes(_props: AppProps) {
  const notes = useNotesStore((s) => s.notes);
  const selectedId = useNotesStore((s) => s.selectedId);
  const select = useNotesStore((s) => s.select);
  const addNote = useNotesStore((s) => s.addNote);
  const updateNote = useNotesStore((s) => s.updateNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);

  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [notes, query]);

  const current = notes.find((n) => n.id === selectedId) ?? null;
  const words = current ? (current.content.trim() ? current.content.trim().split(/\s+/).length : 0) : 0;

  return (
    <div className="notes">
      <aside className="notes__side">
        <div className="notes__side-head">
          <div className="notes__search">
            <Search size={13} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" type="search" />
          </div>
          <Button iconOnly onClick={() => { addNote(); setQuery(""); }} title="New note" aria-label="New note">
            <Plus size={16} />
          </Button>
        </div>
        <ul className="notes__list">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={cx("notes__item", n.id === selectedId && "notes__item--on")}
                onClick={() => { select(n.id); setConfirmId(null); }}
              >
                <strong>{n.title.trim() || "Untitled"}</strong>
                <span>{n.content.replace(/\s+/g, " ").slice(0, 60) || "No content"}</span>
                <em>{timeAgo(n.updatedAt)}</em>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="notes__none">{query ? "No matching notes" : "No notes yet"}</li>}
        </ul>
      </aside>

      <section className="notes__main">
        {current ? (
          <>
            <div className="notes__bar">
              <input
                className="notes__title"
                value={current.title}
                onChange={(e) => updateNote(current.id, { title: e.target.value })}
                placeholder="Title"
                aria-label="Note title"
              />
              {confirmId === current.id ? (
                <span className="notes__confirm" role="group" aria-label="Confirm delete">
                  Delete this note?
                  <Button variant="danger" size="sm" onClick={() => { deleteNote(current.id); setConfirmId(null); }}>Delete</Button>
                  <Button size="sm" onClick={() => setConfirmId(null)}>Keep</Button>
                </span>
              ) : (
                <Button variant="quiet" iconOnly onClick={() => setConfirmId(current.id)} title="Delete note" aria-label="Delete note">
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
            <textarea
              className="notes__text"
              value={current.content}
              onChange={(e) => updateNote(current.id, { content: e.target.value })}
              placeholder="Start typing"
              spellCheck={false}
              aria-label="Note content"
            />
            <div className="notes__foot">
              <span>{words} {words === 1 ? "word" : "words"} · {current.content.length} characters</span>
              <span>Saved {timeAgo(current.updatedAt)}</span>
            </div>
          </>
        ) : (
          <EmptyState title="No note selected" action={<Button variant="primary" onClick={() => addNote()}>New note</Button>}>
            Pick one from the list, or start a new one.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
