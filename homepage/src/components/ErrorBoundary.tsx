import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    console.error("ErrorBoundary caught error:", error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center text-red-500 bg-black/90 rounded-2xl border border-red-500/20">
          <h2 className="text-2xl font-bold mb-4">Something went wrong.</h2>
          <p className="text-sm opacity-80 max-w-md">{this.state.error?.message || 'An unexpected UI error occurred.'}</p>
          <p className="text-xs opacity-60 mt-2 max-w-md">{this.state.error?.stack}</p>
          <button 
            onClick={() => this.setState({ hasError: false })} 
            className="mt-6 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl transition-colors text-white"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
