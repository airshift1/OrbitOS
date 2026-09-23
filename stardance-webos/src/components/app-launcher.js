class AppLauncher {
    constructor(apps) {
        this.apps = apps;
        this.launcherElement = this.createLauncherElement();
        document.body.appendChild(this.launcherElement);
    }

    createLauncherElement() {
        const launcher = document.createElement('div');
        launcher.className = 'app-launcher';
        const appList = document.createElement('ul');

        this.apps.forEach(app => {
            const appItem = document.createElement('li');
            appItem.textContent = app.name;
            appItem.onclick = () => this.launchApp(app);
            appList.appendChild(appItem);
        });

        launcher.appendChild(appList);
        return launcher;
    }

    launchApp(app) {
        const appWindow = new DraggableWindow(app);
        appWindow.open();
    }
}

export default AppLauncher;