"use client";

// DevOnly — render a sub-tree only in development. In production it
// returns the supplied fallback (default: a small 404 page that matches
// the rest of the app's chrome). Centralizes the prod-guard that used to
// live inline at the top of every test/ route.

import React from "react";

const PROD_404_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#06060C",
  color: "#4A4858",
  fontFamily: "'Outfit', sans-serif",
};

export function isDevEnv(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV !== "production";
}

export default function DevOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!isDevEnv()) return <>{fallback ?? <div style={PROD_404_STYLE}>404</div>}</>;
  return <>{children}</>;
}
