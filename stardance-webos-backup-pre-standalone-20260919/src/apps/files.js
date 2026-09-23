export class FilesApp {
    constructor() {
        this.files = [];
        this.currentDirectory = '/';
    }

    init() {
        this.render();
    }

    render() {
        const appContainer = document.createElement('div');
        appContainer.className = 'files-app';

        const header = document.createElement('h1');
        header.innerText = 'File Manager';
        appContainer.appendChild(header);

        const fileList = document.createElement('ul');
        this.files.forEach(file => {
            const fileItem = document.createElement('li');
            fileItem.innerText = file.name;
            fileItem.onclick = () => this.openFile(file);
            fileList.appendChild(fileItem);
        });

        appContainer.appendChild(fileList);
        document.body.appendChild(appContainer);
    }

    openFile(file) {
        alert(`Opening file: ${file.name}`);
    }

    addFile(file) {
        this.files.push(file);
        this.render();
    }

    deleteFile(fileName) {
        this.files = this.files.filter(file => file.name !== fileName);
        this.render();
    }
}