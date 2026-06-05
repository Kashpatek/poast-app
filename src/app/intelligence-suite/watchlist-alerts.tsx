"use client";

// IntelligenceSUITE · Watchlist + Alerts panel (Phase 7E).
//
// User defines a watchlist of tickers / people / keywords; the panel
// polls /api/news every 5 min and surfaces items whose titles match
// any watched value (case-insensitive substring). Each match becomes
// an alert row with Draft Post / Add to Story Radar / Open source
// actions.
//
// Persistence is dual: localStorage ("poast-is-watchlist") for instant
// hydration on mount, plus Supabase via /api/db (projects.id =
// "is-watchlist") so the list syncs across machines on the same
// account.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Search, Activity } from "lucide-react";
import { D, ft, gf, mn, uid } from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";

// ─── Types ───────────────────────────────────────────────────────────

type WatchType = "ticker" | "person" | "keyword";

interface WatchItem {
  id: string;
  type: WatchType;
  value: string;
}

type AlertKind = "filing" | "paper" | "earnings" | "quote";

interface AlertRow {
  id: string;
  kind: AlertKind;
  source: string;
  title: string;
  link?: string;
  time: string;
  matchedItem: string;
}

interface NewsItem {
  title: string;
  link?: string;
  source?: string;
  category?: string;
  date?: string;
  snippet?: string;
}

interface NewsResponse {
  items?: NewsItem[];
}

// ─── Constants ───────────────────────────────────────────────────────

const LS_KEY = "poast-is-watchlist";
const DB_ID = "is-watchlist";
const POLL_MS = 5 * 60 * 1000;
const ALERT_CAP = 50;

// ─── Helpers ─────────────────────────────────────────────────────────

// Heuristic: $-prefixed → ticker. Everything else falls back to
// keyword. Person classification is intentionally fuzzy — we only
// upgrade to "person" when the input looks like a "First Last" name
// (two whitespace-separated capitalized tokens). Anything else stays
// keyword, which matches the same way.
function classify(raw: string): { type: WatchType; value: string } {
  var trimmed = raw.trim();
  if (!trimmed) return { type: "keyword", value: "" };
  if (trimmed.charAt(0) === "$") {
    return { type: "ticker", value: trimmed.slice(1).toUpperCase() };
  }
  var nameMatch = trimmed.match(/^[A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)+$/);
  if (nameMatch) return { type: "person", value: trimmed };
  return { type: "keyword", value: trimmed };
}

// /api/news doesn't return an alert "kind" — we synthesize one from
// the category bucket so the alert chip stays informative without a
// schema change downstream.
function kindFor(item: NewsItem): AlertKind {
  var cat = (item.category || "").toLowerCase();
  var title = (item.title || "").toLowerCase();
  if (cat.indexOf("earning") >= 0 || title.indexOf("earnings") >= 0) return "earnings";
  if (cat.indexOf("paper") >= 0 || title.indexOf("paper") >= 0 || title.indexOf("preprint") >= 0 || title.indexOf("arxiv") >= 0) return "paper";
  if (cat.indexOf("filing") >= 0 || title.indexOf("10-k") >= 0 || title.indexOf("10-q") >= 0 || title.indexOf("8-k") >= 0) return "filing";
  return "quote";
}

function relTime(iso?: string): string {
  if (!iso) return "";
  var t = new Date(iso).getTime();
  if (!t || isNaN(t)) return "";
  var diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + "d ago";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function matchAgainst(title: string, watch: WatchItem[]): string | null {
  if (!title) return null;
  var hay = title.toLowerCase();
  for (var i = 0; i < watch.length; i++) {
    var w = watch[i];
    if (!w.value) continue;
    if (hay.indexOf(w.value.toLowerCase()) >= 0) {
      return w.type === "ticker" ? "$" + w.value : w.value;
    }
  }
  return null;
}

function dedupeAlerts(existing: AlertRow[], incoming: AlertRow[]): AlertRow[] {
  var seen: Record<string, boolean> = {};
  var out: AlertRow[] = [];
  for (var i = 0; i < incoming.length; i++) {
    var a = incoming[i];
    var key = a.link || a.title;
    if (seen[key]) continue;
    seen[key] = true;
    out.push(a);
  }
  for (var j = 0; j < existing.length; j++) {
    var b = existing[j];
    var k = b.link || b.title;
    if (seen[k]) continue;
    seen[k] = true;
    out.push(b);
  }
  return out.slice(0, ALERT_CAP);
}

function loadFromLS(): WatchItem[] {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function(x) { return x && typeof x.value === "string" && typeof x.type === "string"; });
  } catch { return []; }
}

function saveToLS(list: WatchItem[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* quota */ }
}

function syncToDb(list: WatchItem[]) {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "projects",
      data: {
        id: DB_ID,
        name: "IntelligenceSUITE Watchlist",
        type: "is-watchlist",
        data: { items: list },
        updated_at: new Date().toISOString(),
      },
    }),
  }).catch(function() { /* offline / RLS — LS is the source of truth */ });
}

// ─── Chip color per type ─────────────────────────────────────────────

function typeAccent(t: WatchType): string {
  if (t === "ticker") return D.amber;
  if (t === "person") return D.violet;
  return D.cyan;
}

// ─── Panel ───────────────────────────────────────────────────────────

function WatchlistTab() {
  var _watch = useState<WatchItem[]>([]), watch = _watch[0], setWatch = _watch[1];
  var _input = useState<string>(""), input = _input[0], setInput = _input[1];
  var _alerts = useState<AlertRow[]>([]), alerts = _alerts[0], setAlerts = _alerts[1];
  var _loading = useState<boolean>(false), loading = _loading[0], setLoading = _loading[1];

  // Latest watchlist for the polling loop without re-binding the
  // setInterval on every keystroke.
  var watchRef = useRef<WatchItem[]>([]);
  watchRef.current = watch;

  // Hydrate watchlist: LS first (instant), then merge in Supabase
  // copy if it's longer/newer. LS wins ties because typing locally is
  // the most recent intent.
  useEffect(function() {
    var fromLS = loadFromLS();
    if (fromLS.length > 0) setWatch(fromLS);

    var cancelled = false;
    fetch("/api/db?table=projects&id=" + DB_ID)
      .then(function(r) { return r.json(); })
      .then(function(res: { data?: { data?: { items?: WatchItem[] } } }) {
        if (cancelled) return;
        var remote = res && res.data && res.data.data && res.data.data.items;
        if (Array.isArray(remote) && remote.length > fromLS.length) {
          setWatch(remote);
          saveToLS(remote);
        }
      })
      .catch(function() { /* row may not exist yet */ });
    return function() { cancelled = true; };
  }, []);

  // Poll the news feed every 5 min and refilter against the current
  // watchlist. Empty watchlist → skip the fetch entirely.
  useEffect(function() {
    var cancelled = false;

    function tick() {
      var current = watchRef.current;
      if (current.length === 0) return;
      setLoading(true);
      fetch("/api/news")
        .then(function(r) { return r.json(); })
        .then(function(d: NewsResponse) {
          if (cancelled) return;
          var items = (d && d.items) || [];
          var hits: AlertRow[] = [];
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var matched = matchAgainst(it.title || "", current);
            if (!matched) continue;
            hits.push({
              id: uid("alert"),
              kind: kindFor(it),
              source: it.source || "RSS",
              title: it.title || "",
              link: it.link,
              time: it.date || new Date().toISOString(),
              matchedItem: matched,
            });
          }
          setAlerts(function(prev) { return dedupeAlerts(prev, hits); });
          setLoading(false);
        })
        .catch(function() { if (!cancelled) setLoading(false); });
    }

    tick();
    var handle = setInterval(tick, POLL_MS);
    return function() { cancelled = true; clearInterval(handle); };
  }, []);

  // Refilter existing alerts against new watchlist on add/remove so
  // the user doesn't have to wait 5 min for the next poll to see the
  // empty state recompute. We re-scan stored alerts in-place rather
  // than re-fetching news.
  useEffect(function() {
    if (watch.length === 0) { setAlerts([]); return; }
    setAlerts(function(prev) {
      return prev.filter(function(a) {
        return matchAgainst(a.title, watch) !== null;
      });
    });
  }, [watch]);

  function addItem() {
    var classified = classify(input);
    if (!classified.value) return;
    var exists = watch.some(function(w) {
      return w.type === classified.type && w.value.toLowerCase() === classified.value.toLowerCase();
    });
    if (exists) {
      showToast("Already watching " + classified.value, "info");
      setInput("");
      return;
    }
    var next = watch.concat([{ id: uid("watch"), type: classified.type, value: classified.value }]);
    setWatch(next);
    saveToLS(next);
    syncToDb(next);
    setInput("");
  }

  function removeItem(id: string) {
    var next = watch.filter(function(w) { return w.id !== id; });
    setWatch(next);
    saveToLS(next);
    syncToDb(next);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addItem(); }
  }

  function draftPost(a: AlertRow) {
    var store = useStore.getState();
    var payload = a.title + (a.link ? "\n\n" + a.link : "");
    store.pushOutput({
      sourceTool: "watchlist-alerts",
      kind: "caption",
      payload: payload,
      preview: a.title.slice(0, 140),
    });
    store.setPendingRoute({
      destinationTool: "captions",
      sourceTool: "watchlist-alerts",
      payload: payload,
      kind: "caption",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poast-nav", { detail: "captions" }));
    }
    showToast("Sent to Capper.", "success");
  }

  function toStoryRadar(a: AlertRow) {
    var store = useStore.getState();
    var payload = { topic: a.title, source: a.source, link: a.link, matchedItem: a.matchedItem };
    store.pushOutput({
      sourceTool: "watchlist-alerts",
      kind: "other",
      payload: payload,
      preview: a.title.slice(0, 140),
    });
    store.setPendingRoute({
      destinationTool: "story-radar",
      sourceTool: "watchlist-alerts",
      payload: payload,
      kind: "other",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poast-nav", { detail: "story-radar" }));
    }
    showToast("Sent to Story Radar.", "success");
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: ft, color: D.tx }}>
      {/* Input + chips */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
          <input
            value={input}
            onChange={function(e) { setInput(e.target.value); }}
            onKeyDown={onKey}
            placeholder="Add to watchlist ($AVGO, Jensen Huang, HBM)"
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 6,
              background: D.surface,
              border: "1px solid " + D.border,
              color: D.tx,
              fontFamily: ft,
              fontSize: 12,
              outline: "none",
            }}
          />
          <button
            onClick={addItem}
            disabled={!input.trim()}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              background: input.trim() ? D.amber + "18" : "transparent",
              border: "1px solid " + (input.trim() ? D.amber + "55" : D.border),
              color: input.trim() ? D.amber : D.txd,
              fontFamily: mn,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              cursor: input.trim() ? "pointer" : "default",
            }}
          >Add</button>
        </div>

        {watch.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {watch.map(function(w) {
              var c = typeAccent(w.type);
              var label = w.type === "ticker" ? "$" + w.value : w.value;
              return (
                <span
                  key={w.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: c + "14",
                    border: "1px solid " + c + "44",
                    color: c,
                    fontFamily: mn,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                  }}
                >
                  <span style={{ opacity: 0.55, textTransform: "uppercase", fontSize: 8 }}>{w.type}</span>
                  <span>{label}</span>
                  <button
                    onClick={function() { removeItem(w.id); }}
                    title={"Remove " + label}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: c,
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >×</button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Feed */}
      {watch.length === 0 ? (
        <div style={{
          padding: 14,
          border: "1px dashed " + D.border,
          borderRadius: 8,
          color: D.txd,
          fontFamily: ft,
          fontSize: 12,
        }}>Add a ticker, person, or keyword to start watching.</div>
      ) : alerts.length === 0 ? (
        <div style={{
          padding: 14,
          border: "1px dashed " + D.border,
          borderRadius: 8,
          color: D.txd,
          fontFamily: mn,
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}>{loading ? "Scanning feed…" : "No matches yet — polling every 5 min."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid " + D.border, borderRadius: 8, overflow: "hidden", background: D.card }}>
          {alerts.map(function(a, i) {
            return (
              <div
                key={a.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: i === alerts.length - 1 ? "none" : "1px solid " + D.border,
                }}
              >
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.35 }}>{a.title}</div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
                  <span style={{
                    fontFamily: mn,
                    fontSize: 9,
                    color: D.amber,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: D.amber + "14",
                    border: "1px solid " + D.amber + "33",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}>{a.matchedItem}</span>
                  <span style={{ fontFamily: mn, fontSize: 9, color: D.txm, letterSpacing: 0.4, textTransform: "uppercase" }}>{a.kind}</span>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{a.source}</span>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>· {relTime(a.time)}</span>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                  <AlertButton label="Draft Post" onClick={function() { draftPost(a); }} />
                  <AlertButton label="Add to Story Radar" onClick={function() { toStoryRadar(a); }} />
                  {a.link && (
                    <a
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={alertButtonStyle()}
                      onMouseEnter={function(e) { highlight(e.currentTarget, true); }}
                      onMouseLeave={function(e) { highlight(e.currentTarget, false); }}
                    >Open source</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Action button helpers (DRY for both <button> and <a>) ────────────

function alertButtonStyle(): React.CSSProperties {
  return {
    fontFamily: mn,
    fontSize: 9,
    letterSpacing: 0.5,
    padding: "4px 9px",
    borderRadius: 4,
    border: "1px solid " + D.border,
    background: "transparent",
    color: D.txm,
    cursor: "pointer",
    textTransform: "uppercase",
    fontWeight: 700,
    textDecoration: "none",
    display: "inline-block",
    transition: "all 0.15s ease",
  };
}

function highlight(el: HTMLElement, on: boolean) {
  el.style.color = on ? D.amber : D.txm;
  el.style.borderColor = on ? D.amber + "55" : D.border;
  el.style.background = on ? D.amber + "0C" : "transparent";
}

function AlertButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={alertButtonStyle()}
      onMouseEnter={function(e) { highlight(e.currentTarget, true); }}
      onMouseLeave={function(e) { highlight(e.currentTarget, false); }}
    >{label}</button>
  );
}

// ═══ MARKETS · STOCK EXCHANGE UI ═══════════════════════════════════════

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  sparkline: number[];
}

type MarketTab = "stocks" | "etfs" | "crypto" | "earnings" | "watchlist";

interface EarningsItem {
  symbol: string;
  name: string;
  date: string;
  time: "BMO" | "AMC";
  daysOut: number;
  expectedEPS: number;
  lastEPS: number;
}

const EARNINGS: EarningsItem[] = [
  { symbol: "NVDA", name: "NVIDIA",            date: "2026-06-10", time: "AMC", daysOut: 5,  expectedEPS: 0.84, lastEPS: 0.78 },
  { symbol: "AVGO", name: "Broadcom",          date: "2026-06-12", time: "AMC", daysOut: 7,  expectedEPS: 1.41, lastEPS: 1.32 },
  { symbol: "MU",   name: "Micron",            date: "2026-06-18", time: "AMC", daysOut: 13, expectedEPS: 1.04, lastEPS: 0.62 },
  { symbol: "MRVL", name: "Marvell",           date: "2026-06-20", time: "AMC", daysOut: 15, expectedEPS: 0.31, lastEPS: 0.28 },
  { symbol: "TSM",  name: "TSMC",              date: "2026-07-08", time: "BMO", daysOut: 33, expectedEPS: 1.78, lastEPS: 1.61 },
  { symbol: "ASML", name: "ASML",              date: "2026-07-15", time: "BMO", daysOut: 40, expectedEPS: 3.92, lastEPS: 3.42 },
  { symbol: "INTC", name: "Intel",             date: "2026-07-22", time: "AMC", daysOut: 47, expectedEPS: 0.04, lastEPS: -0.38 },
  { symbol: "AMD",  name: "AMD",               date: "2026-07-29", time: "AMC", daysOut: 54, expectedEPS: 1.12, lastEPS: 0.96 },
];

function MarketsTabBar({ active, onChange }: { active: MarketTab; onChange: (t: MarketTab) => void }) {
  var tabs: { id: MarketTab; label: string }[] = [
    { id: "stocks",    label: "Stocks" },
    { id: "etfs",      label: "ETFs" },
    { id: "crypto",    label: "Crypto" },
    { id: "earnings",  label: "Earnings" },
    { id: "watchlist", label: "Watchlist" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, borderBottom: "1px solid " + D.border, marginBottom: 18, paddingBottom: 0 }}>
      {tabs.map(function(t) {
        var isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={function() { onChange(t.id); }}
            style={{
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid " + D.teal : "2px solid transparent",
              color: isActive ? D.tx : D.txm,
              fontFamily: mn, fontSize: 10.5, fontWeight: 800,
              letterSpacing: 1.4, textTransform: "uppercase",
              cursor: "pointer", marginBottom: -1,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.color = D.tx; }}
            onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.color = D.txm; }}
          >{t.label}</button>
        );
      })}
    </div>
  );
}

// Lightweight inline sparkline · 14 points, no axes, color-cued by delta.
function MiniSpark({ data, up }: { data: number[]; up: boolean }) {
  var chartData = data.map(function(y, i) { return { i: i, y: y }; });
  return (
    <div style={{ width: 56, height: 18, display: "inline-block", verticalAlign: "middle" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="y" stroke={up ? D.teal : D.coral} strokeWidth={1.4} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return p.toFixed(2);
}

function fmtVolume(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return String(v);
}

function fmtCap(c: number): string {
  if (c >= 1_000_000_000_000) return "$" + (c / 1_000_000_000_000).toFixed(2) + "T";
  if (c >= 1_000_000_000) return "$" + (c / 1_000_000_000).toFixed(1) + "B";
  if (c >= 1_000_000) return "$" + (c / 1_000_000).toFixed(0) + "M";
  return "$" + c.toLocaleString();
}

// Horizontally scrolling marquee strip of the top 8 stocks.
function MarqueeStrip({ quotes }: { quotes: Quote[] }) {
  var top = quotes.slice(0, 10);
  // Duplicate so the CSS scroll loop runs without gaps.
  var loop = top.concat(top);
  return (
    <div style={{
      background: D.surface,
      border: "1px solid " + D.border,
      borderRadius: 12,
      padding: "10px 14px",
      overflow: "hidden",
      marginBottom: 16,
      position: "relative",
    }}>
      <style>{`
        @keyframes marqueeScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .markets-marquee:hover .markets-marquee-track { animation-play-state: paused; }
      `}</style>
      <div className="markets-marquee">
        <div className="markets-marquee-track" style={{
          display: "flex", gap: 28, whiteSpace: "nowrap",
          animation: "marqueeScroll 60s linear infinite",
          width: "max-content",
        }}>
          {loop.map(function(q, i) {
            var up = q.change >= 0;
            return (
              <div key={i + "-" + q.symbol} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
                <span style={{ fontFamily: mn, fontSize: 12, fontWeight: 700, color: D.tx }}>{q.symbol}</span>
                <span style={{ fontFamily: mn, fontSize: 12, fontWeight: 600, color: D.tx }}>${fmtPrice(q.price)}</span>
                <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 600, color: up ? D.teal : D.coral }}>
                  {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
                </span>
                <MiniSpark data={q.sparkline} up={up} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SortKey = "symbol" | "price" | "changePct" | "volume" | "marketCap";

function BucketTable({ quotes, loading, error, showMarketCap }: { quotes: Quote[]; loading: boolean; error: string | null; showMarketCap: boolean }) {
  var _sort = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "changePct", dir: "desc" });
  var sort = _sort[0], setSort = _sort[1];

  var sorted = useMemo(function() {
    var copy = quotes.slice();
    copy.sort(function(a, b) {
      var av: number | string = a[sort.key];
      var bv: number | string = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") {
        return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sort.dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return copy;
  }, [quotes, sort]);

  function toggleSort(key: SortKey) {
    setSort(function(prev) {
      if (prev.key === key) return { key: key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key: key, dir: key === "symbol" ? "asc" : "desc" };
    });
  }

  if (loading && quotes.length === 0) {
    return <div style={{ padding: 32, textAlign: "center", fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 1.4 }}>LOADING QUOTES…</div>;
  }
  if (error) {
    return <div style={{ padding: 32, textAlign: "center", fontFamily: mn, fontSize: 11, color: D.coral, letterSpacing: 1.4 }}>FAILED: {error}</div>;
  }
  if (sorted.length === 0) {
    return <div style={{ padding: 32, textAlign: "center", fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 1.4 }}>NO QUOTES — TRY ANOTHER BUCKET</div>;
  }

  return (
    <div style={{
      background: D.card,
      border: "1px solid " + D.border,
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: showMarketCap
          ? "44px 90px 1fr 110px 100px 90px 100px 110px"
          : "44px 90px 1fr 110px 100px 90px 100px",
        gap: 0,
        padding: "10px 14px",
        background: D.surface,
        borderBottom: "1px solid " + D.border,
        fontFamily: mn, fontSize: 9.5, fontWeight: 800,
        letterSpacing: 1.4, color: D.txd, textTransform: "uppercase",
      }}>
        <div>#</div>
        <SortHeader label="Symbol"  k="symbol"     sort={sort} onClick={toggleSort} align="left" />
        <div>Name</div>
        <SortHeader label="Price"   k="price"      sort={sort} onClick={toggleSort} align="right" />
        <SortHeader label="24h %"   k="changePct"  sort={sort} onClick={toggleSort} align="right" />
        <div style={{ textAlign: "right" }}>Spark</div>
        <SortHeader label="Volume"  k="volume"     sort={sort} onClick={toggleSort} align="right" />
        {showMarketCap && <SortHeader label="Mkt Cap" k="marketCap" sort={sort} onClick={toggleSort} align="right" />}
      </div>
      <div style={{ maxHeight: 560, overflow: "auto" }}>
        {sorted.map(function(q, i) {
          var up = q.change >= 0;
          return (
            <div key={q.symbol} style={{
              display: "grid",
              gridTemplateColumns: showMarketCap
                ? "44px 90px 1fr 110px 100px 90px 100px 110px"
                : "44px 90px 1fr 110px 100px 90px 100px",
              padding: "12px 14px",
              borderBottom: "1px solid " + D.border,
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
              alignItems: "center",
              fontFamily: ft, fontSize: 13, color: D.tx,
              transition: "background 0.12s ease",
            }}
              onMouseEnter={function(e) { e.currentTarget.style.background = D.amber + "0F"; e.currentTarget.style.borderLeft = "2px solid " + D.amber; e.currentTarget.style.paddingLeft = "12px"; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"; e.currentTarget.style.borderLeft = "none"; e.currentTarget.style.paddingLeft = "14px"; }}
            >
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{i + 1}</div>
              <div style={{ fontFamily: mn, fontSize: 13, fontWeight: 700, color: D.tx }}>{q.symbol}</div>
              <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</div>
              <div style={{ fontFamily: mn, fontSize: 13, fontWeight: 600, color: D.tx, textAlign: "right" }}>${fmtPrice(q.price)}</div>
              <div style={{ fontFamily: mn, fontSize: 12, fontWeight: 700, color: up ? D.teal : D.coral, textAlign: "right" }}>
                {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
              </div>
              <div style={{ textAlign: "right" }}><MiniSpark data={q.sparkline} up={up} /></div>
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, textAlign: "right" }}>{fmtVolume(q.volume)}</div>
              {showMarketCap && <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, textAlign: "right" }}>{fmtCap(q.marketCap)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortHeader({ label, k, sort, onClick, align }: { label: string; k: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onClick: (k: SortKey) => void; align: "left" | "right" }) {
  var isActive = sort.key === k;
  var arrow = isActive ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <div
      onClick={function() { onClick(k); }}
      style={{
        cursor: "pointer", textAlign: align,
        color: isActive ? D.amber : D.txd,
        userSelect: "none",
      }}
    >{label}{arrow}</div>
  );
}

function EarningsList() {
  var _filter = useState<"week" | "next" | "month">("month");
  var filter = _filter[0], setFilter = _filter[1];

  var filtered = EARNINGS.filter(function(e) {
    if (filter === "week") return e.daysOut <= 7;
    if (filter === "next") return e.daysOut > 7 && e.daysOut <= 14;
    return e.daysOut <= 35;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["week", "next", "month"] as const).map(function(f) {
          var label = f === "week" ? "This Week" : f === "next" ? "Next Week" : "This Month";
          var isActive = filter === f;
          return (
            <button
              key={f}
              onClick={function() { setFilter(f); }}
              style={{
                padding: "6px 12px",
                background: isActive ? D.amber + "18" : "transparent",
                border: "1px solid " + (isActive ? D.amber + "55" : D.border),
                color: isActive ? D.amber : D.txm,
                fontFamily: mn, fontSize: 10, fontWeight: 800,
                letterSpacing: 0.8, textTransform: "uppercase",
                borderRadius: 6, cursor: "pointer",
              }}
            >{label}</button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {filtered.map(function(e) {
          var surprise = e.lastEPS !== 0 ? ((e.expectedEPS - e.lastEPS) / Math.abs(e.lastEPS)) * 100 : 0;
          var up = surprise >= 0;
          return (
            <div key={e.symbol + e.date} style={{
              background: D.card,
              border: "1px solid " + D.border,
              borderRadius: 12,
              padding: "14px 16px",
              transition: "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
              cursor: "default",
            }}
              onMouseEnter={function(ev) { ev.currentTarget.style.borderColor = D.amber + "55"; ev.currentTarget.style.transform = "translateY(-1px)"; ev.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.3)"; }}
              onMouseLeave={function(ev) { ev.currentTarget.style.borderColor = D.border; ev.currentTarget.style.transform = "translateY(0)"; ev.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: mn, fontSize: 14, fontWeight: 800, color: D.tx }}>{e.symbol}</span>
                <span style={{ fontFamily: ft, fontSize: 12, color: D.txm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{e.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: mn, fontSize: 11, color: D.amber }}>{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 800, color: D.txd, padding: "2px 5px", background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, borderRadius: 4 }}>{e.time}</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginLeft: "auto" }}>{e.daysOut === 0 ? "today" : "in " + e.daysOut + "d"}</span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: mn, fontSize: 8, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>Est EPS</div>
                  <div style={{ fontFamily: mn, fontSize: 13, fontWeight: 700, color: D.tx }}>{e.expectedEPS.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: mn, fontSize: 8, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>Last</div>
                  <div style={{ fontFamily: mn, fontSize: 13, color: D.txm }}>{e.lastEPS.toFixed(2)}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ fontFamily: mn, fontSize: 8, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>vs</div>
                  <div style={{ fontFamily: mn, fontSize: 13, fontWeight: 700, color: up ? D.teal : D.coral }}>{up ? "+" : ""}{surprise.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bucket loader hook ──────────────────────────────────────────────
function useQuotes(bucket: "stocks" | "etfs" | "crypto") {
  var _quotes = useState<Quote[]>([]), quotes = _quotes[0], setQuotes = _quotes[1];
  var _loading = useState(true), loading = _loading[0], setLoading = _loading[1];
  var _err = useState<string | null>(null), err = _err[0], setErr = _err[1];
  var _stamp = useState<number>(0), stamp = _stamp[0], setStamp = _stamp[1];

  useEffect(function() {
    var cancelled = false;
    function load() {
      setLoading(true);
      fetch("/api/markets/quotes?bucket=" + bucket)
        .then(function(r) { return r.json(); })
        .then(function(d: { quotes?: Quote[]; ts?: number }) {
          if (cancelled) return;
          setQuotes((d && d.quotes) || []);
          setStamp(Date.now());
          setErr(null);
          setLoading(false);
        })
        .catch(function(e: unknown) { if (!cancelled) { setErr(String(e)); setLoading(false); } });
    }
    load();
    // Re-poll every 60s. Quote sparklines are daily-seeded so the
    // shape stays stable; only price/change move.
    var handle = setInterval(load, 60_000);
    return function() { cancelled = true; clearInterval(handle); };
  }, [bucket]);

  return { quotes: quotes, loading: loading, error: err, stamp: stamp };
}

// ─── MarketsPanel · the new default export ────────────────────────────
export default function MarketsPanel() {
  var _tab = useState<MarketTab>("stocks"), tab = _tab[0], setTab = _tab[1];
  var stocks = useQuotes("stocks");
  var etfs = useQuotes("etfs");
  var crypto = useQuotes("crypto");

  // Marquee uses stocks as the dominant marquee feed.
  var marqueeFeed = stocks.quotes;

  var relStamp = useMemo(function() {
    if (!stocks.stamp) return "—";
    var diff = Date.now() - stocks.stamp;
    if (diff < 5_000) return "just now";
    if (diff < 60_000) return Math.floor(diff / 1000) + "s ago";
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
    return Math.floor(diff / 3_600_000) + "h ago";
  }, [stocks.stamp, tab]);

  return (
    <div style={{ fontFamily: ft, color: D.tx, padding: "8px 4px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: mn, fontSize: 10, fontWeight: 800, color: D.teal,
          letterSpacing: 2.4, textTransform: "uppercase",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: D.teal,
            animation: "pulseDot 1.6s ease-in-out infinite",
            boxShadow: "0 0 8px " + D.teal + "AA",
          }} />
          Markets · Live
        </span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>Updated {relStamp}</span>
        <Activity size={14} color={D.txd} strokeWidth={1.8} style={{ marginLeft: "auto", opacity: 0.5 }} />
      </div>
      <style>{`@keyframes pulseDot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.25); } }`}</style>

      {/* Page title */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1.1, color: D.tx, margin: 0 }}>Markets</h1>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 4 }}>Semis &amp; adjacent — your live trading floor.</div>
      </div>

      {/* Marquee */}
      <MarqueeStrip quotes={marqueeFeed} />

      {/* Tabs */}
      <MarketsTabBar active={tab} onChange={setTab} />

      {/* Body */}
      {tab === "stocks" && <BucketTable quotes={stocks.quotes} loading={stocks.loading} error={stocks.error} showMarketCap={true} />}
      {tab === "etfs" && <BucketTable quotes={etfs.quotes} loading={etfs.loading} error={etfs.error} showMarketCap={true} />}
      {tab === "crypto" && <BucketTable quotes={crypto.quotes} loading={crypto.loading} error={crypto.error} showMarketCap={true} />}
      {tab === "earnings" && <EarningsList />}
      {tab === "watchlist" && <WatchlistTab />}
    </div>
  );
}
