export default class Terminal {
    constructor() {
        this.commands = {
            help: this.help,
            clear: this.clear,
            echo: this.echo,
        };
        this.history = [];
        this.currentInput = '';
    }

    help() {
        return 'Available commands: help, clear, echo';
    }

    clear() {
        this.history = [];
        return '';
    }

    echo(args) {
        return args.join(' ');
    }

    executeCommand(input) {
        const [command, ...args] = input.split(' ');
        this.history.push(input);
        if (this.commands[command]) {
            return this.commands[command].call(this, args);
        } else {
            return `Command not found: ${command}`;
        }
    }

    getHistory() {
        return this.history;
    }

    setInput(input) {
        this.currentInput = input;
    }

    getInput() {
        return this.currentInput;
    }
}