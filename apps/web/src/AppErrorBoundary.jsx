import { Component } from "react";

/**
 * Top-level fatal fallback (Phase 8, css-revamp-phase-8.md). Distinct from
 * App.jsx's own recoverable catalog-load error: this only renders if React
 * itself fails to render the tree (an uncaught error anywhere below it), so
 * it intentionally does not assume the header, stores, or routing are safe
 * to render either — no <ClientLayout>, no app state, plain markup only.
 */
export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("Fatal app error:", error, info);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="app-fatal-state" role="alert">
        <div className="app-fatal-card">
          <h1>Something went wrong</h1>
          <p>Tuti ran into an unexpected problem. Reloading the page usually fixes this.</p>
          <button className="primary-action" onClick={() => window.location.reload()} type="button">
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
