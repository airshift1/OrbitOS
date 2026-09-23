import DraggableWindow from './draggable-window.js';

class WindowManager {
  constructor() {
    this.windows = [];
    this.activeWindow = null;
    this.taskbar = null;
    this.windowLayer = document.createElement('div');
    this.windowLayer.className = 'window-layer';
    const desktop = document.getElementById('desktop');
    if (desktop) {
      desktop.appendChild(this.windowLayer);
    }
  }

  setTaskbar(taskbar) {
    this.taskbar = taskbar;
  }

  createWindow(appName) {
    const newWindow = new DraggableWindow(appName, this);
    this.windows.push(newWindow);
    this.activateWindow(newWindow);
    this.render();
    return newWindow;
  }

  render() {
    this.windowLayer.innerHTML = '';
    this.windows.forEach((windowItem) => {
      if (!windowItem.isClosed) {
        this.windowLayer.appendChild(windowItem.getElement());
      }
    });

    if (this.taskbar) {
      this.taskbar.updateTaskbar();
    }
  }

  activateWindow(windowItem) {
    this.activeWindow = windowItem;

    this.windows.forEach((window) => {
      window.setActive(window === windowItem);
      if (window === windowItem && window.isMinimized) {
        window.restore();
      }
    });

    if (this.taskbar) {
      this.taskbar.updateTaskbar();
    }
  }

  closeWindow(windowItem) {
    this.windows = this.windows.filter((window) => window !== windowItem);
    if (this.activeWindow === windowItem) {
      this.activeWindow = this.windows[this.windows.length - 1] || null;
    }
    this.render();
  }
}

export default WindowManager;