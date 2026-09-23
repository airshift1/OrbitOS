const NOTES_STORAGE_KEY = 'stardance-webos-notes';

export class NotesApp {
  constructor() {
    this.notes = this.loadNotes();
    this.selectedNoteId = this.notes[0]?.id || null;

    if (!this.notes.length) {
      const welcomeNote = this.createNote('Welcome', 'Welcome to Stardance WebOS.\n\nYour notes are saved locally in the browser.');
      this.notes = [welcomeNote];
      this.selectedNoteId = welcomeNote.id;
      this.persist();
    }
  }

  createNote(title = 'Untitled note', content = '') {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      content,
    };
  }

  loadNotes() {
    const saved = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((note) => note && typeof note === 'object' && note.id) : [];
    } catch (error) {
      return [];
    }
  }

  persist() {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(this.notes));
  }

  getSelectedNote() {
    return this.notes.find((note) => note.id === this.selectedNoteId) || this.notes[0] || null;
  }

  setSelectedNote(noteId) {
    this.selectedNoteId = noteId;
  }

  createNewNote() {
    const newNote = this.createNote('New note', '');
    this.notes = [...this.notes, newNote];
    this.selectedNoteId = newNote.id;
    this.persist();
    return newNote;
  }

  deleteSelectedNote() {
    if (!this.selectedNoteId) {
      return;
    }

    const nextNotes = this.notes.filter((note) => note.id !== this.selectedNoteId);
    if (nextNotes.length) {
      this.notes = nextNotes;
    } else {
      const welcomeNote = this.createNote('Welcome', 'Welcome to Stardance WebOS.\n\nYour notes are saved locally in the browser.');
      this.notes = [welcomeNote];
    }

    this.selectedNoteId = this.notes[0]?.id || null;
    this.persist();
  }

  updateSelectedNote(changes = {}) {
    const selected = this.getSelectedNote();
    if (!selected) {
      return;
    }

    this.notes = this.notes.map((note) => {
      if (note.id !== selected.id) {
        return note;
      }
      return { ...note, ...changes };
    });

    this.persist();
  }

  renderTo(container) {
    const selected = this.getSelectedNote();
    if (!selected) {
      return;
    }

    container.innerHTML = '';
    const app = document.createElement('div');
    app.className = 'notes-app';

    const sidebar = document.createElement('aside');
    sidebar.className = 'notes-sidebar';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'notes-add';
    addButton.textContent = 'New note';
    addButton.addEventListener('click', () => {
      this.createNewNote();
      this.renderTo(container);
    });

    const list = document.createElement('div');
    list.className = 'notes-list';

    this.notes.forEach((note) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'note-item';
      if (note.id === this.selectedNoteId) {
        item.classList.add('active');
      }
      item.textContent = note.title || 'Untitled note';
      item.addEventListener('click', () => {
        this.selectedNoteId = note.id;
        this.renderTo(container);
      });
      list.appendChild(item);
    });

    sidebar.append(addButton, list);

    const editor = document.createElement('div');
    editor.className = 'notes-editor';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'note-title-input';
    titleInput.value = selected.title;
    titleInput.addEventListener('input', (event) => {
      const nextTitle = event.target.value.trim() || 'Untitled note';
      this.updateSelectedNote({ title: nextTitle });
      this.renderTo(container);
    });

    const textarea = document.createElement('textarea');
    textarea.className = 'note-content';
    textarea.value = selected.content;
    textarea.placeholder = 'Write your note here...';
    textarea.addEventListener('input', (event) => {
      this.updateSelectedNote({ content: event.target.value });
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'notes-delete';
    deleteButton.textContent = 'Delete note';
    deleteButton.addEventListener('click', () => {
      this.deleteSelectedNote();
      this.renderTo(container);
    });

    editor.append(titleInput, textarea, deleteButton);
    app.append(sidebar, editor);
    container.appendChild(app);
  }
}

export default NotesApp;