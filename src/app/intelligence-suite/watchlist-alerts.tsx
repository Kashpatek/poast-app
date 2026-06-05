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

import React, { useEffect, useRef, useState } from "react";
import { D, ft, mn, uid } from "../shared-constants";
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

export default function WatchlistAlertsPanel() {
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
