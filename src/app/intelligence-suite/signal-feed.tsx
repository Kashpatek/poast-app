"use client";

// Signal Feed — Phase 7B absorption of News Flow into IntelligenceSUITE.
// The stream up top is the curated, action-first view; the collapsible
// "Widgets" block re-mounts the full NewsFlow board for users who still
// want the rich market/earnings/pomodoro layout. NewsFlow stays mounted
// at /news-flow on its own — this is a nested re-render, nothing here
// owns its persisted config.

import React, { useEffect, useState } from "react";
import { D, ft, mn } from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";
import NewsFlow from "../news-flow";

interface NewsItem {
  title: string;
  link?: string;
  source?: string;
  category?: string;
  date?: string;
  snippet?: string;
}

interface NewsResponse {
  items: NewsItem[];
  categories?: string[];
  sources?: string[];
}

// Filter id → server-side `category` param (or null when we client-filter).
// "geo" has no matching server bucket so we keyword-match on the title.
interface Filter {
  id: string;
  label: string;
  apiCategory: string | null;
  titleMatch?: RegExp;
}

const FILTERS: Filter[] = [
  { id: "all",    label: "All",            apiCategory: null },
  { id: "semi",   label: "Semiconductors", apiCategory: "Semiconductors" },
  { id: "ai",     label: "AI/ML",          apiCategory: "AI" },
  { id: "cloud",  label: "Cloud",          apiCategory: "Data Center" },
  { id: "geo",    label: "Geopolitics",    apiCategory: null, titleMatch: /\b(china|taiwan|export control|sanction|tariff|chip act|tsmc|huawei|geopolit|biden|trump|xi|kremlin|russia|eu|brussels|defense)\b/i },
  { id: "mkt",    label: "Markets",        apiCategory: "Markets" },
];

interface Action {
  id: string;
  label: string;
  navSec: string;
  kind: "idea" | "brief" | "caption" | "other";
  toast: string;
}

const ACTIONS: Action[] = [
  { id: "draft",   label: "Draft Post",            navSec: "captions",  kind: "caption", toast: "Sent to Capper." },
  { id: "ideate",  label: "Add to Ideation",       navSec: "ideation",  kind: "idea",    toast: "Sent to IdeationNation." },
  { id: "brief",   label: "Route to Brief Builder",navSec: "p2p",       kind: "brief",   toast: "Routed to Brief Builder." },
  { id: "watch",   label: "Save to Watchlist",     navSec: "news",      kind: "other",   toast: "Saved to Watchlist." },
];

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

function pickPayload(item: NewsItem): string {
  var body = item.snippet ? item.title + "\n\n" + item.snippet : item.title;
  if (item.link) body += "\n\n" + item.link;
  return body;
}

// Watchlist persistence mirrors the News Flow widget's localStorage key
// so a save here surfaces in the existing widget on the same machine.
function saveWatchlist(item: NewsItem) {
  try {
    var raw = localStorage.getItem("poast-watchlist");
    var list: NewsItem[] = raw ? JSON.parse(raw) : [];
    list = [item].concat(list.filter(function(x) { return x.link !== item.link; })).slice(0, 50);
    localStorage.setItem("poast-watchlist", JSON.stringify(list));
  } catch { /* quota / disabled */ }
}

function runAction(action: Action, item: NewsItem) {
  var payload = pickPayload(item);
  var store = useStore.getState();
  store.pushOutput({
    sourceTool: "signal-feed",
    kind: action.kind,
    payload: payload,
    preview: item.title.slice(0, 140),
  });
  if (action.id === "watch") {
    saveWatchlist(item);
    showToast(action.toast, "success");
    return;
  }
  store.setPendingRoute({
    destinationTool: action.navSec,
    sourceTool: "signal-feed",
    payload: payload,
    kind: action.kind,
  });
  window.dispatchEvent(new CustomEvent("poast-nav", { detail: action.navSec }));
  showToast(action.toast, "success");
}

export default function SignalFeedPanel() {
  var _data = useState<NewsResponse>({ items: [] }), data = _data[0], setData = _data[1];
  var _filter = useState<string>("all"), filter = _filter[0], setFilter = _filter[1];
  var _loading = useState<boolean>(true), loading = _loading[0], setLoading = _loading[1];
  var _widgetsOpen = useState<boolean>(false), widgetsOpen = _widgetsOpen[0], setWidgetsOpen = _widgetsOpen[1];

  useEffect(function() {
    var cancelled = false;
    var active = FILTERS.find(function(f) { return f.id === filter; }) || FILTERS[0];
    var q = active.apiCategory ? "?category=" + encodeURIComponent(active.apiCategory) : "";
    setLoading(true);
    fetch("/api/news" + q)
      .then(function(r) { return r.json(); })
      .then(function(d: NewsResponse) {
        if (cancelled) return;
        setData(d || { items: [] });
        setLoading(false);
      })
      .catch(function() {
        if (cancelled) return;
        setLoading(false);
      });
    return function() { cancelled = true; };
  }, [filter]);

  var active = FILTERS.find(function(f) { return f.id === filter; }) || FILTERS[0];
  var items = data.items || [];
  if (active.titleMatch) {
    items = items.filter(function(it) { return active.titleMatch!.test(it.title || ""); });
  }
  items = items.slice(0, 40);

  return (
    <div style={{ padding: "20px 24px", fontFamily: ft, color: D.tx, background: D.bg, minHeight: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 700, color: D.tx, letterSpacing: -0.2 }}>Signal Feed</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 }}>Curated stream + News Flow widgets</div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTERS.map(function(f) {
          var on = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={function() { setFilter(f.id); }}
              style={{
                fontFamily: mn,
                fontSize: 10,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid " + (on ? D.amber + "70" : D.border),
                background: on ? D.amber + "18" : "transparent",
                color: on ? D.amber : D.txm,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >{f.label}</button>
          );
        })}
      </div>

      <div style={{ border: "1px solid " + D.border, borderRadius: 10, background: D.card, overflow: "hidden" }}>
        {loading && items.length === 0 && (
          <div style={{ padding: 24, fontFamily: mn, fontSize: 11, color: D.txd, textAlign: "center" }}>Loading…</div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: 24, fontFamily: mn, fontSize: 11, color: D.txd, textAlign: "center" }}>No items match this filter.</div>
        )}
        {items.map(function(item, i) {
          return (
            <div key={i} style={{ padding: "14px 16px", borderBottom: i === items.length - 1 ? "none" : "1px solid " + D.border }}>
              <a
                href={item.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.tx, textDecoration: "none", lineHeight: 1.4, display: "block" }}
              >{item.title}</a>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                {item.source && (
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, padding: "2px 7px", borderRadius: 4, background: D.amber + "12", letterSpacing: 0.4, textTransform: "uppercase" }}>{item.source}</span>
                )}
                {item.category && (
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.4 }}>{item.category}</span>
                )}
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{relTime(item.date)}</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {ACTIONS.map(function(a) {
                  return (
                    <button
                      key={a.id}
                      onClick={function() { runAction(a, item); }}
                      style={{
                        fontFamily: mn,
                        fontSize: 10,
                        letterSpacing: 0.4,
                        padding: "5px 10px",
                        borderRadius: 5,
                        border: "1px solid " + D.border,
                        background: "transparent",
                        color: D.txm,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={function(e: React.MouseEvent<HTMLButtonElement>) {
                        e.currentTarget.style.color = D.amber;
                        e.currentTarget.style.borderColor = D.amber + "55";
                        e.currentTarget.style.background = D.amber + "0C";
                      }}
                      onMouseLeave={function(e: React.MouseEvent<HTMLButtonElement>) {
                        e.currentTarget.style.color = D.txm;
                        e.currentTarget.style.borderColor = D.border;
                        e.currentTarget.style.background = "transparent";
                      }}
                    >{a.label}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          onClick={function() { setWidgetsOpen(function(v) { return !v; }); }}
          style={{
            fontFamily: mn,
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: widgetsOpen ? D.amber : D.txm,
            background: "transparent",
            border: "1px solid " + (widgetsOpen ? D.amber + "55" : D.border),
            padding: "7px 14px",
            borderRadius: 6,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{widgetsOpen ? "▾" : "▸"}</span>
          <span>Widgets — News Flow Board</span>
        </button>
        {widgetsOpen && (
          <div style={{ marginTop: 12, border: "1px solid " + D.border, borderRadius: 10, overflow: "hidden", background: D.card }}>
            <NewsFlow />
          </div>
        )}
      </div>
    </div>
  );
}
