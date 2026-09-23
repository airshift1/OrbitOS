import Desktop from './components/desktop.js';
import Taskbar from './components/taskbar.js';
import WindowManager from './components/window-manager.js';

class StardanceWebOS {
  constructor() {
    this.desktop = new Desktop();
    this.windowManager = new WindowManager();
    this.taskbar = new Taskbar(this.windowManager);

    window.webos = this;
    this.windowManager.setTaskbar(this.taskbar);
    this.windowManager.createWindow('Notes');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new StardanceWebOS();
});