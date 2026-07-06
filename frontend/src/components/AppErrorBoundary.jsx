import { Component } from "react";
import * as Sentry from "@sentry/react";
import { reportError } from "../utils/monitoring";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("app_render_crash", error, errorInfo);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo?.componentStack || "" } },
    });
    reportError(error, {
      type: "react.error_boundary",
      componentStack: errorInfo?.componentStack || "",
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-crash-shell">
          <section
            className="app-crash-card"
            role="alert"
            aria-live="assertive"
          >
            <p className="app-crash-kicker">Unexpected issue</p>
            <h1>Something went wrong on this page.</h1>
            <p>Your data is safe. Try reloading or returning home.</p>
            <div className="app-crash-actions">
              <button type="button" onClick={this.handleReload}>
                Reload app
              </button>
              <button
                type="button"
                className="secondary"
                onClick={this.handleHome}
              >
                Go home
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
