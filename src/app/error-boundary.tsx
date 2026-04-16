"use client";
import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const AMBER = "#F7B041";
const CORAL = "#E06347";
const BG = "#06060C";
const FT_HEAD = "'Outfit',sans-serif";
const FT_MONO = "'JetBrains Mono',monospace";

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // TODO(akash): hook up to Sentry or structured error reporting.
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? "An unexpected error occurred";
      const stackPreview = this.state.error?.stack?.split("\n").slice(0, 4).join("\n");

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: BG,
            fontFamily: FT_HEAD,
            padding: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* TODO(akash): consider adding a subtle scanline / CRT shader background. */}
          <style
            dangerouslySetInnerHTML={{
              __html: [
                "@keyframes errGlitch{0%,100%{transform:translate(0,0);text-shadow:0 0 24px rgba(247,176,65,0.35),0 0 48px rgba(247,176,65,0.12)}20%{transform:translate(-1px,1px);text-shadow:2px 0 0 rgba(224,99,71,0.6),-2px 0 0 rgba(11,134,209,0.5),0 0 24px rgba(247,176,65,0.35)}40%{transform:translate(1px,-1px);text-shadow:-2px 0 0 rgba(224,99,71,0.6),2px 0 0 rgba(11,134,209,0.5),0 0 24px rgba(247,176,65,0.35)}60%{transform:translate(0,1px);text-shadow:0 0 24px rgba(247,176,65,0.35)}}",
                "@keyframes errPulse{0%,100%{opacity:0.6}50%{opacity:1}}",
                "@keyframes errFadeIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}",
                "@keyframes errCaret{0%,100%{opacity:1}50%{opacity:0}}",
                ".eb-btn{padding:12px 28px;border-radius:8px;cursor:pointer;background:linear-gradient(135deg,#F7B041 0%,#E8A020 50%,#F7B041 100%);color:#06060C;font-family:'Outfit',sans-serif;font-size:14px;font-weight:800;border:none;letter-spacing:0.4px;text-transform:uppercase;box-shadow:0 4px 14px rgba(247,176,65,0.25),0 0 20px rgba(247,176,65,0.1);transition:all 0.18s ease}",
                ".eb-btn:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(247,176,65,0.4),0 0 40px rgba(247,176,65,0.18)}",
                ".eb-btn:active{transform:translateY(0)}",
              ].join(""),
            }}
          />

          {/* Ambient orb */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-20%",
              right: "-10%",
              width: "60vw",
              height: "60vw",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse, rgba(247,176,65,0.08) 0%, rgba(247,176,65,0.02) 40%, transparent 70%)",
              filter: "blur(80px)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: "-15%",
              left: "-10%",
              width: "45vw",
              height: "45vw",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse, rgba(224,99,71,0.06) 0%, transparent 65%)",
              filter: "blur(80px)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              maxWidth: 560,
              width: "100%",
              textAlign: "center",
              zIndex: 1,
            }}
          >
            {/* Status header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 20,
                animation: "errFadeIn 0.4s ease forwards",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: CORAL,
                  boxShadow: `0 0 10px ${CORAL}, 0 0 20px ${CORAL}60`,
                  animation: "errPulse 1.4s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: FT_MONO,
                  fontSize: 10,
                  letterSpacing: 3,
                  color: "#6B6878",
                  textTransform: "uppercase",
                }}
              >
                POAST OS // FAULT DETECTED
              </span>
            </div>

            {/* Big glitchy title */}
            <div
              style={{
                fontFamily: FT_HEAD,
                fontSize: "clamp(48px, 9vw, 96px)",
                fontWeight: 900,
                color: AMBER,
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
                marginBottom: 8,
                animation: "errGlitch 3.2s steps(1) infinite, errFadeIn 0.5s ease forwards",
              }}
            >
              [SYSTEM FAULT]
            </div>

            <div
              style={{
                fontFamily: FT_MONO,
                fontSize: 11,
                color: "#4A4858",
                letterSpacing: 2,
                marginBottom: 32,
                animation: "errFadeIn 0.5s ease 0.1s both",
              }}
            >
              uncaught_exception &gt; render_tree
            </div>

            {/* Error message panel */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(224,99,71,0.05), rgba(224,99,71,0.02))",
                border: `1px solid ${CORAL}30`,
                borderLeft: `3px solid ${CORAL}`,
                borderRadius: 8,
                padding: "16px 20px",
                marginBottom: 24,
                textAlign: "left",
                boxShadow: `0 0 24px rgba(224,99,71,0.06)`,
                animation: "errFadeIn 0.5s ease 0.2s both",
              }}
            >
              <div
                style={{
                  fontFamily: FT_MONO,
                  fontSize: 9,
                  color: `${CORAL}`,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 8,
                  opacity: 0.8,
                }}
              >
                error.message
              </div>
              <div
                style={{
                  fontFamily: FT_MONO,
                  fontSize: 13,
                  color: CORAL,
                  lineHeight: 1.6,
                  wordBreak: "break-word",
                }}
              >
                <span style={{ color: `${CORAL}80` }}>&gt; </span>
                {message}
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 14,
                    marginLeft: 4,
                    verticalAlign: "middle",
                    background: CORAL,
                    animation: "errCaret 0.85s step-end infinite",
                  }}
                />
              </div>

              {stackPreview ? (
                <details style={{ marginTop: 14 }}>
                  <summary
                    style={{
                      fontFamily: FT_MONO,
                      fontSize: 9,
                      color: "#6B6878",
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    stack_trace [+]
                  </summary>
                  <pre
                    style={{
                      fontFamily: FT_MONO,
                      fontSize: 10,
                      color: "#6B6878",
                      lineHeight: 1.6,
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 160,
                      overflow: "auto",
                    }}
                  >
                    {stackPreview}
                  </pre>
                </details>
              ) : null}
            </div>

            {/* Action button */}
            <div
              style={{
                marginBottom: 32,
                animation: "errFadeIn 0.5s ease 0.3s both",
              }}
            >
              <button type="button" onClick={this.handleReset} className="eb-btn">
                Try Again
              </button>
            </div>

            {/* Divider */}
            <div
              aria-hidden
              style={{
                width: 80,
                height: 1,
                margin: "0 auto 16px",
                background: `linear-gradient(90deg, transparent, ${AMBER}40, transparent)`,
              }}
            />

            {/* Report hint */}
            <div
              style={{
                fontFamily: FT_MONO,
                fontSize: 10,
                color: "#4A4858",
                letterSpacing: 1,
                animation: "errFadeIn 0.5s ease 0.4s both",
              }}
            >
              Report this to{" "}
              <a
                href="mailto:akash@semianalysis.com"
                style={{
                  color: AMBER,
                  textDecoration: "none",
                  borderBottom: `1px dotted ${AMBER}60`,
                }}
              >
                akash@semianalysis.com
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
