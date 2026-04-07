import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-celestial-deep p-6 text-center">
          <div className="w-20 h-20 bg-celestial-mars/20 text-celestial-mars rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl font-bold">!</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">Celestial Signal Interrupted</h2>
          <p className="text-white/60 mb-8 max-w-md">
            We've encountered a cosmic anomaly. Our explorers are working to restore the connection.
          </p>
          <pre className="bg-black/40 p-4 rounded-xl text-xs text-left overflow-auto max-w-full mb-8 border border-white/10">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-celestial-saturn text-black font-bold rounded-full hover:scale-105 transition-transform"
          >
            Reconnect to Lumi
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
