export default class Welcome {
    constructor() {
        this.title = "Welcome to Stardance WebOS";
        this.content = "This is a beginner-friendly browser-based operating system. Explore the features and enjoy your experience!";
    }

    render() {
        const welcomeWindow = document.createElement('div');
        welcomeWindow.className = 'welcome-window';
        
        const titleElement = document.createElement('h1');
        titleElement.innerText = this.title;
        
        const contentElement = document.createElement('p');
        contentElement.innerText = this.content;

        welcomeWindow.appendChild(titleElement);
        welcomeWindow.appendChild(contentElement);

        return welcomeWindow;
    }
}