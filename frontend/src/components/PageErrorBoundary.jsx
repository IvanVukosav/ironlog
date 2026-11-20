import { Component } from "react";

/**
 * Shows `fallback` in place of a page that failed to load or to draw (say its file couldn't be
 * fetched while offline) instead of leaving the screen empty. A new `resetKey` (another page)
 * tries again.
 */
class PageErrorBoundary extends Component {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default PageErrorBoundary;
