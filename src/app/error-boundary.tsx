"use client";
import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#06060C",
            fontFamily: "'Outfit',sans-serif",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "#09090D",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: "40px 36px",
              textAlign: "center",
              boxShadow: "0 4px 40px rgba(0,0,0,0.5), 0 0 30px rgba(247,176,65,0.06)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "rgba(247,176,65,0.1)",
                border: "1px solid rgba(247,176,65,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                fontSize: 24,
                color: "#F7B041",
              }}
            >
              !
            </div>
            <div
              style={{
                fontFamily: "'Outfit',sans-serif",
                fontSize: 22,
                fontWeight: 800,
                color: "#E8E4DD",
                marginBottom: 12,
                letterSpacing: -0.5,
              }}
            >
              Something went wrong
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 12,
                color: "#8A8690",
                lineHeight: 1.7,
                marginBottom: 28,
                padding: "14px 18px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.04)",
                wordBreak: "break-word",
              }}
            >
              {this.state.error?.message || "An unexpected error occurred"}
            </div>
            <button
              onClick={this.handleReset}
              style={{
                padding: "14px 32px",
                borderRadius: 12,
                cursor: "pointer",
                background: "linear-gradient(135deg, #F7B041, #E8A020)",
                color: "#06060C",
                fontFamily: "'Outfit',sans-serif",
                fontSize: 14,
                fontWeight: 800,
                border: "none",
                letterSpacing: -0.3,
                boxShadow: "0 0 24px rgba(247,176,65,0.2)",
                transition: "all 0.2s ease",
              }}
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

export default ErrorBoundary;
