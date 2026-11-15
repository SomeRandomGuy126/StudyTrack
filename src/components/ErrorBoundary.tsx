import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="card p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-primary mb-2">Something went wrong</h2>
            <p className="text-secondary text-sm mb-4">{this.state.error?.message ?? 'An unexpected error occurred.'}</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary">Reload app</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
