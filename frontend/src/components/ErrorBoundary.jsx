import React from 'react';
import { MdWarningAmber } from 'react-icons/md';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI or use the one provided via props
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-ember-soft border border-ember/30 rounded-lg">
          <MdWarningAmber className="w-12 h-12 text-ember mb-4" />
          <h3 className="text-lg font-semibold text-ember mb-2">
            {this.props.title || 'Something went wrong'}
          </h3>
          <p className="text-ember text-center mb-4">
            {this.props.message || 'An error occurred while loading this component. Please try refreshing the page.'}
          </p>
          {this.props.showDetails && this.state.error && (
            <details className="w-full max-w-md">
              <summary className="cursor-pointer text-sm text-ember hover:text-ember">
                Show error details
              </summary>
              <pre className="mt-2 p-2 bg-ember-soft text-xs text-ember rounded border overflow-auto max-h-32">
                {this.state.error.toString()}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          {this.props.onRetry && (
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                this.props.onRetry();
              }}
              className="mt-4 px-4 py-2 bg-ember text-paper rounded hover:bg-ember transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
