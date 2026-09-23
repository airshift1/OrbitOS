import NotesApp from '../apps/notes.js';

class DraggableWindow {
  constructor(appName, windowManager) {
    this.id = `window-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.appName = appName;
    this.title = appName;
    this.windowManager = windowManager;
    this.isClosed = false;
    this.isMinimized = false;
    this.isMaximized = false;
    this.dragState = null;
    this.resizeState = null;
    this.windowElement = document.createElement('div');
    this.windowElement.className = 'window';
    this.windowElement.dataset.windowId = this.id;
    this.windowElement.style.width = '420px';
    this.windowElement.style.height = '420px';
    this.windowElement.style.left = `${this.calculatePositionX()}px`;
    this.windowElement.style.top = `${this.calculatePositionY()}px`;
    this.buildWindow();
  }

  calculatePositionX() {
    const offset = this.windowManager.windows.length * 28;
    return 120 + offset;
  }

  calculatePositionY() {
    const offset = this.windowManager.windows.length * 22;
    return 80 + offset;
  }

  buildWindow() {
    const header = document.createElement('div');
    header.className = 'window-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'window-title';
    titleEl.textContent = this.title;

    const controls = document.createElement('div');
    controls.className = 'window-controls';

    const minimizeButton = document.createElement('button');
    minimizeButton.type = 'button';
    minimizeButton.className = 'window-button';
    minimizeButton.textContent = '—';
    minimizeButton.addEventListener('click', () => this.toggleMinimize());

    const maximizeButton = document.createElement('button');
    maximizeButton.type = 'button';
    maximizeButton.className = 'window-button';
    maximizeButton.textContent = '▢';
    maximizeButton.addEventListener('click', () => this.toggleMaximize());

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'window-button close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => this.close());

    controls.append(minimizeButton, maximizeButton, closeButton);
    header.append(titleEl, controls);

    const content = document.createElement('div');
    content.className = 'window-content';
    this.contentElement = content;
    this.renderContent();

    this.windowElement.append(header, content);
    this.windowElement.addEventListener('mousedown', () => this.windowManager.activateWindow(this));
    this.makeDraggable();
    this.makeResizable();
  }

  renderContent() {
    if (this.appName === 'Notes') {
      if (!this.notesApp) {
        this.notesApp = new NotesApp();
      }
      this.notesApp.renderTo(this.contentElement);
      this.title = 'Notes';
      return;
    }

    const info = document.createElement('div');
    info.className = 'app-content';
    info.innerHTML = `<h2>${this.title}</h2><p>This ${this.title.toLowerCase()} window is ready.</p>`;
    this.contentElement.appendChild(info);
  }

  makeDraggable() {
    const header = this.windowElement.querySelector('.window-header');
    header.addEventListener('mousedown', (event) => {
      if (event.target.closest('button')) {
        return;
      }
      this.startDrag(event);
    });
  }

  startDrag(event) {
    if (this.isMaximized) {
      return;
    }

    const rect = this.windowElement.getBoundingClientRect();
    this.dragState = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    const onMouseMove = (moveEvent) => {
      const left = Math.max(0, moveEvent.clientX - this.dragState.offsetX);
      const top = Math.max(32, moveEvent.clientY - this.dragState.offsetY);
      this.windowElement.style.left = `${left}px`;
      this.windowElement.style.top = `${top}px`;
    };

    const onMouseUp = () => {
      this.dragState = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  restore() {
    this.isMinimized = false;
    this.windowElement.classList.remove('minimized');
    this.windowElement.style.display = 'block';
    if (this.windowManager.taskbar) {
      this.windowManager.taskbar.updateTaskbar();
    }
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.windowElement.classList.toggle('minimized', this.isMinimized);
    this.windowElement.style.display = this.isMinimized ? 'none' : 'block';
    if (this.windowManager.taskbar) {
      this.windowManager.taskbar.updateTaskbar();
    }
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    this.windowElement.classList.toggle('maximized', this.isMaximized);

    if (this.isMaximized) {
      this.windowElement.style.left = '0';
      this.windowElement.style.top = '0';
      this.windowElement.style.width = 'calc(100vw - 20px)';
      this.windowElement.style.height = 'calc(100vh - 60px)';
      return;
    }

    this.windowElement.style.width = '420px';
    this.windowElement.style.height = '420px';
    this.windowElement.style.left = `${this.calculatePositionX()}px`;
    this.windowElement.style.top = `${this.calculatePositionY()}px`;
  }

  makeResizable() {
    const directions = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];

    directions.forEach((direction) => {
      const handle = document.createElement('div');
      handle.className = `window-resize window-resize-${direction}`;
      handle.dataset.direction = direction;
      handle.addEventListener('mousedown', (event) => this.startResize(event, direction));
      this.windowElement.appendChild(handle);
    });
  }

  startResize(event, direction) {
    if (this.isMaximized) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = this.windowElement.getBoundingClientRect();
    this.resizeState = {
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      direction,
    };

    const onMouseMove = (moveEvent) => {
      if (!this.resizeState) {
        return;
      }

      const dx = moveEvent.clientX - this.resizeState.startX;
      const dy = moveEvent.clientY - this.resizeState.startY;
      let nextWidth = this.resizeState.width;
      let nextHeight = this.resizeState.height;
      let nextLeft = this.resizeState.left;
      let nextTop = this.resizeState.top;

      if (direction.includes('e')) {
        nextWidth = Math.max(260, this.resizeState.width + dx);
      }
      if (direction.includes('s')) {
        nextHeight = Math.max(220, this.resizeState.height + dy);
      }
      if (direction.includes('w')) {
        nextWidth = Math.max(260, this.resizeState.width - dx);
        nextLeft = this.resizeState.left + dx;
      }
      if (direction.includes('n')) {
        nextHeight = Math.max(220, this.resizeState.height - dy);
        nextTop = this.resizeState.top + dy;
      }

      const maxWidth = window.innerWidth - nextLeft - 8;
      const maxHeight = window.innerHeight - nextTop - 48;
      nextWidth = Math.min(nextWidth, maxWidth);
      nextHeight = Math.min(nextHeight, maxHeight);

      this.windowElement.style.width = `${nextWidth}px`;
      this.windowElement.style.height = `${nextHeight}px`;
      this.windowElement.style.left = `${nextLeft}px`;
      this.windowElement.style.top = `${nextTop}px`;
    };

    const onMouseUp = () => {
      this.resizeState = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  close() {
    this.isClosed = true;
    this.windowElement.remove();
    this.windowManager.closeWindow(this);
  }

  setActive(isActive) {
    this.windowElement.classList.toggle('active', isActive);
  }

  getElement() {
    return this.windowElement;
  }
}

export default DraggableWindow;