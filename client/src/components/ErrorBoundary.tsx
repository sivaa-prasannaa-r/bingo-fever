import { Component } from 'react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: '#1a0030',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, fontFamily: 'monospace', color: '#fff',
        }}>
          <h2 style={{ color: '#ff6b9d', marginBottom: 16 }}>⚠️ Render Error</h2>
          <pre style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 16,
            maxWidth: '90vw', overflow: 'auto',
            fontSize: 13, color: '#ffe66d',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20, padding: '10px 24px',
              background: '#ff6b9d', border: 'none',
              borderRadius: 20, color: '#fff',
              fontFamily: 'monospace', fontSize: 14, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
