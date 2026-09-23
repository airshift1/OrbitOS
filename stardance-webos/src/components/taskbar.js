class Taskbar {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.taskbarElement = document.createElement('div');
    this.taskbarElement.className = 'taskbar';
    this.taskbarButtons = document.createElement('div');
    this.taskbarButtons.className = 'taskbar-buttons';
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.className = 'time-display';
    this.startMenu = document.createElement('div');
    this.startMenu.className = 'start-menu hidden';

    this.createStartButton();
    this.createTimeDisplay();
    this.populateStartMenu();
    this.render();
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
  }

  createStartButton() {
    this.startButton = document.createElement('button');
    this.startButton.type = 'button';
    this.startButton.className = 'start-button';
    this.startButton.textContent = 'Start';
    this.startButton.addEventListener('click', () => this.toggleStartMenu());
    this.taskbarElement.appendChild(this.startButton);
  }

  createTimeDisplay() {
    this.timeDisplay.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    this.taskbarElement.appendChild(this.timeDisplay);
  }

  render() {
    this.taskbarElement.appendChild(this.taskbarButtons);
    document.body.appendChild(this.taskbarElement);
    document.body.appendChild(this.startMenu);
  }

  populateStartMenu() {
    const apps = ['Welcome', 'Files', 'Notes', 'Terminal'];

    apps.forEach((name) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'start-menu-item';
      item.textContent = name;
      item.addEventListener('click', () => {
        this.windowManager.createWindow(name);
        this.toggleStartMenu();
      });
      this.startMenu.appendChild(item);
    });
  }

  toggleStartMenu() {
    this.startMenu.classList.toggle('hidden');
  }

  updateTaskbar() {
    this.taskbarButtons.innerHTML = '';
    this.windowManager.windows.forEach((windowItem) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'taskbar-app-button';
      button.textContent = windowItem.title;
      button.addEventListener('click', () => {
        this.windowManager.activateWindow(windowItem);
      });
      if (this.windowManager.activeWindow && this.windowManager.activeWindow.id === windowItem.id) {
        button.classList.add('active');
      }
      this.taskbarButtons.appendChild(button);
    });
  }

  updateTime() {
    this.timeDisplay.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

export default Taskbar;