import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  appName: string;
}

interface State {
  failed: boolean;
}

/**
 * A crashing app takes down its own window, not the whole OS. Details go to
 * the console; the window only says that something failed.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.appName}] crashed`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app-crash" role="alert">
        <strong>{this.props.appName} stopped working</strong>
        <span>Your files are untouched. Try opening it again.</span>
        <button type="button" className="btn btn--primary" onClick={() => this.setState({ failed: false })}>
          Reload app
        </button>
      </div>
    );
  }
}
