import { Component } from 'react';
import * as Sentry from '@sentry/react';
import { reportError } from '../utils/monitoring';

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('route_render_crash', error, errorInfo);
    Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo?.componentStack || '' } } });
    reportError(error, {
      type: 'react.route_error_boundary',
      componentStack: errorInfo?.componentStack || '',
    });
  }

  handleGoHome = () => {
    window.location.href = '/home';
  };

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-crash-shell">
          <section className="app-crash-card" role="alert" aria-live="assertive">
            <h1>Something went wrong on this page</h1>
            <pre>
              <code>{String(this.state.error?.message || 'Unknown error')}</code>
            </pre>
            <div className="app-crash-actions">
              <button type="button" onClick={this.handleGoHome}>Go back home</button>
              <button type="button" className="secondary" onClick={this.handleTryAgain}>Try again</button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
