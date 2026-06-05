"use client";

// HUB home for /intelligence-suite. Two stacked sections under the
// shell's sticky tab bar: an APP LAUNCHER grid (one large card per
// non-HUB app, accent-tinted) and a NEWS FLOW grid hydrated from
// /api/news. The shell owns the wordmark + eyebrow + tabs — this
// component only renders body content.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Radio, Sparkles } from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";
import { apps as APPS } from "./shell";

interface NewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
  category: string;
  snippet: string;
}

// Per-app accent overrides (the shell APPS list doesn't carry colors).
const ACCENT: Record<string, string> = {
  trends: D.amber,
  ideas: D.violet,
  signals: D.cyan,
  watchlist: D.teal,
  competitive: D.coral,
  brief: D.amber,
  notes: D.blue,
};

const SUBTITLE: Record<string, string> = {
  trends: "Heating, cooling, and emerging stories.",
  ideas: "Spatial canvas for new angles.",
  signals: "Live RSS triage by sector.",
  watchlist: "Pinned tickers and keyword alerts.",
  competitive: "Track rivals and benchmarks.",
  brief: "Daily AI-generated digest.",
  notes: "Pinned research capture.",
};

function relativeTime(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d ago";
  return new Date(t).toLocaleDateString();
}

export function HubLanding() {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(function () {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/news");
        if (!r.ok) throw new Error("status " + r.status);
        const d = await r.json();
        if (cancelled) return;
        setNews(Array.isArray(d.items) ? d.items.slice(0, 18) : []);
      } catch (e) {
        if (cancelled) return;
        setErrored(true);
        setNews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return function () { cancelled = true; };
  }, []);

  // Drop HUB itself from the launcher grid — we're already on HUB.
  const launcherApps = APPS.filter(function (a) { return a.id !== "hub"; });

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 64px" }}>
      {/* ── Title block ────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{
          margin: 0,
          fontFamily: gf, fontSize: 56, fontWeight: 900,
          color: D.tx, letterSpacing: -1.4, lineHeight: 1,
        }}>HUB</h1>
        <p style={{
          margin: "10px 0 0",
          fontFamily: ft, fontSize: 16, color: D.txm,
          letterSpacing: -0.1,
        }}>Command center for SemiAnalysis intelligence.</p>
      </div>

      {/* ── App launcher grid ──────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 14,
      }}>
        {launcherApps.map(function (app) {
          const accent = ACCENT[app.id] || D.amber;
          const sub = SUBTITLE[app.id] || "";
          const Icon = app.Icon;
          return (
            <Link
              key={app.id}
              href={app.path}
              style={{
                display: "block",
                background: D.card,
                border: "1px solid " + D.border,
                borderRadius: 14,
                padding: "28px 24px",
                textDecoration: "none",
                color: D.tx,
                transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
              }}
              onMouseEnter={function (e: React.MouseEvent<HTMLAnchorElement>) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = accent + "66";
                e.currentTarget.style.boxShadow = "0 14px 38px rgba(0,0,0,0.5), 0 0 28px " + accent + "22";
                e.currentTarget.style.background = "linear-gradient(180deg, " + D.card + " 0%, " + D.hover + " 100%)";
              }}
              onMouseLeave={function (e: React.MouseEvent<HTMLAnchorElement>) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = D.border;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = D.card;
              }}
            >
              <Icon size={40} strokeWidth={1.6} color={accent} />
              <div style={{
                fontFamily: gf, fontSize: 18, fontWeight: 700,
                color: D.tx, letterSpacing: -0.2,
                marginTop: 16,
              }}>{app.label}</div>
              <div style={{
                fontFamily: ft, fontSize: 13, color: D.txm,
                marginTop: 4,
              }}>{sub}</div>
            </Link>
          );
        })}
      </div>

      {/* ── Section divider ────────────────────────────────────── */}
      <div style={{ marginTop: 48, marginBottom: 18 }}>
        <div style={{
          fontFamily: mn, fontSize: 11, fontWeight: 800, color: D.amber,
          letterSpacing: 2.4, textTransform: "uppercase",
        }}>News Flow</div>
        <div style={{
          fontFamily: ft, fontSize: 14, color: D.txm,
          marginTop: 6,
        }}>Latest signals from across our coverage.</div>
      </div>

      {/* ── News flow grid ─────────────────────────────────────── */}
      {loading ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}>
          {[0, 1, 2].map(function (i) {
            return <NewsSkeleton key={i} />;
          })}
        </div>
      ) : !news || news.length === 0 ? (
        <div style={{
          padding: "32px",
          border: "1px dashed " + D.border,
          borderRadius: 12,
          background: D.card,
          color: D.txm,
          fontFamily: ft, fontSize: 13,
          textAlign: "center",
        }}>
          {errored ? "Couldn't load news right now. Try again shortly." : "No news available."}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}>
          {news.map(function (item, idx) {
            return <NewsCard key={item.link || idx} item={item} />;
          })}
        </div>
      )}
    </div>
  );
}

// Default export keeps backward compatibility with anything still
// importing the file's default (e.g. older page.tsx variants).
export default HubLanding;

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div
      style={{
        background: D.card,
        border: "1px solid " + D.border,
        borderRadius: 12,
        padding: "14px 16px 12px",
        display: "flex", flexDirection: "column", gap: 10,
        transition: "border-color 140ms ease, background 140ms ease",
      }}
      onMouseEnter={function (e: React.MouseEvent<HTMLDivElement>) {
        e.currentTarget.style.borderColor = "rgba(247,176,65,0.30)";
        e.currentTarget.style.background = D.hover;
      }}
      onMouseLeave={function (e: React.MouseEvent<HTMLDivElement>) {
        e.currentTarget.style.borderColor = D.border;
        e.currentTarget.style.background = D.card;
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{
          fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.txm,
          letterSpacing: 1.2, textTransform: "uppercase",
        }}>{item.source}</span>
        <span style={{
          fontFamily: mn, fontSize: 10, fontWeight: 600, color: D.txd,
          letterSpacing: 0.4,
        }}>{relativeTime(item.date)}</span>
      </div>

      <div style={{
        fontFamily: ft, fontSize: 14, color: D.tx,
        lineHeight: 1.4,
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{item.title}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 2 }}>
        <NewsAction icon={<Sparkles size={11} strokeWidth={2.4} />} label="Draft Post" color={D.amber} />
        <NewsAction icon={<Radio size={11} strokeWidth={2.4} />} label="Add to Signals" color={D.cyan} />
        <a
          href={item.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            color: D.txm,
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Open <ExternalLink size={10} strokeWidth={2.4} />
        </a>
      </div>
    </div>
  );
}

function NewsAction({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <button
      type="button"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
        color: color,
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function NewsSkeleton() {
  return (
    <div style={{
      background: D.card,
      border: "1px solid " + D.border,
      borderRadius: 12,
      padding: "14px 16px 12px",
      display: "flex", flexDirection: "column", gap: 10,
      minHeight: 132,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Bar w={60} />
        <Bar w={40} />
      </div>
      <Bar w="100%" h={12} />
      <Bar w="86%" h={12} />
      <Bar w="64%" h={12} />
      <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
        <Bar w={56} />
        <Bar w={70} />
      </div>
    </div>
  );
}

function Bar({ w, h }: { w: number | string; h?: number }) {
  return (
    <span style={{
      display: "block",
      width: typeof w === "number" ? w + "px" : w,
      height: (h || 8) + "px",
      borderRadius: 4,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
      backgroundSize: "200% 100%",
      animation: "hub-skeleton 1.6s linear infinite",
    }} />
  );
}

// Inline keyframes once. Re-mount is cheap and doesn't conflict because
// the @keyframes name is globally unique.
if (typeof document !== "undefined" && !document.getElementById("hub-skeleton-kf")) {
  const style = document.createElement("style");
  style.id = "hub-skeleton-kf";
  style.textContent = "@keyframes hub-skeleton { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }";
  document.head.appendChild(style);
}

