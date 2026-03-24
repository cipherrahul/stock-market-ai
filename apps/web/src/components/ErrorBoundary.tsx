'use client';

import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 max-w-md">
            <div className="text-red-400 text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h1>
            <p className="text-gray-300 mb-6">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
