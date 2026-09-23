class Desktop {
  constructor() {
    this.desktopElement = document.getElementById('desktop');
    this.icons = [];
    this.setBackground();
    this.createIcons();
  }

  setBackground() {
    this.desktopElement.style.background = 'linear-gradient(135deg, rgba(13,24,39,0.96), rgba(28,50,82,0.9))';
  }

  createIcons() {
    const iconNames = ['Welcome', 'Files', 'Notes', 'Terminal'];
    iconNames.forEach((name) => {
      const icon = document.createElement('button');
      icon.type = 'button';
      icon.className = 'desktop-icon';
      icon.innerHTML = `<span class="desktop-icon-symbol">${name.charAt(0)}</span><span>${name}</span>`;
      icon.addEventListener('click', () => this.launchApp(name));
      this.desktopElement.appendChild(icon);
      this.icons.push(icon);
    });
  }

  launchApp(appName) {
    if (!window.webos || !window.webos.windowManager) {
      return;
    }

    window.webos.windowManager.createWindow(appName);
  }
}

export default Desktop;