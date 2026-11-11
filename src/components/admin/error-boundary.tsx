"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for Admin Panel
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app.
 */
export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin Error Boundary caught an error:", error, errorInfo);
    // Could send to error tracking service here
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl">
              ⚠️
            </div>
            <div>
              <h2 className="text-lg font-semibold text-red-900">Something went wrong</h2>
              <p className="text-sm text-red-700 mt-1">
                We couldn't load this section. Please try refreshing the page.
              </p>
            </div>
          </div>
          
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-4 p-4 bg-red-100 rounded-lg text-xs">
              <summary className="font-medium text-red-900 cursor-pointer">Error Details</summary>
              <pre className="mt-2 overflow-auto text-red-800">
                {this.state.error.toString()}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Refresh Page
            </button>
            <Link
              href="/admin"
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Section-specific error boundary
 * Use for individual sections that can fail independently
 */
interface SectionErrorBoundaryProps {
  children: ReactNode;
  title: string;
  action?: ReactNode;
}

export function SectionErrorBoundary({ children, title, action }: SectionErrorBoundaryProps) {
  return (
    <AdminErrorBoundary
      fallback={
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                ⚠️
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Failed to load {title}</h3>
                <p className="text-sm text-gray-500">This section couldn't be loaded.</p>
              </div>
            </div>
            {action}
          </div>
        </div>
      }
    >
      {children}
    </AdminErrorBoundary>
  );
}
