"use client";

// Signal Feed — magazine-style news viewer for IntelligenceSUITE.
// Inoreader meets Hacker News meets The Information. Two-column desktop
// layout: editorial stream on the left, "Heating Up" leaderboard and
// reading list on the right. The original NewsFlow widget board is
// preserved as a collapsed-by-default legacy fallback at the bottom.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { D, ft, gf, mn } from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";
import NewsFlow from "../news-flow";

// ─── Types ───────────────────────────────────────────────────────────

interface NewsItem {
  title: string;
  link?: string;
  source?: string;
  category?: string;
  date?: string;
  snippet?: string;
  image?: string;
  thumbnail?: string;
}

interface NewsResponse {
  items: NewsItem[];
  categories?: string[];
  sources?: string[];
}

interface Filter {
  id: string;
  label: string;
  apiCategory: string | null;
  titleMatch?: RegExp;
  accent: string; // tint used for placeholder thumb + soft highlights
}

interface ReadingItem {
  title: string;
  link?: string;
  source?: string;
  date?: string;
  savedAt: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const FILTERS: Filter[] = [
  { id: "all",    label: "All",          apiCategory: null,             accent: D.amber },
  { id: "semi",   label: "Semis",        apiCategory: "Semiconductors", accent: D.amber },
  { id: "ai",     label: "AI/ML",        apiCategory: "AI",             accent: D.violet },
  { id: "cloud",  label: "Cloud",        apiCategory: "Data Center",    accent: D.cyan },
  { id: "geo",    label: "Geopolitics",  apiCategory: null,             accent: D.coral, titleMatch: /\b(china|taiwan|export control|sanction|tariff|chip act|tsmc|huawei|geopolit|biden|trump|xi|kremlin|russia|eu|brussels|defense|pentagon|chinese|japan|korea)\b/i },
  { id: "mkt",    label: "Markets",      apiCategory: "Markets",        accent: D.teal },
  { id: "earn",   label: "Earnings",     apiCategory: null,             accent: D.blue, titleMatch: /\b(earnings|q[1-4]|quarter|revenue|guidance|beats|misses|eps|upgrade|downgrade|price target)\b/i },
];

const DATE_RANGES = [
  { id: "24h", label: "24h",  ms: 86_400_000 },
  { id: "7d",  label: "7d",   ms: 7 * 86_400_000 },
  { id: "30d", label: "30d",  ms: 30 * 86_400_000 },
  { id: "all", label: "All",  ms: Number.POSITIVE_INFINITY },
];

const READING_KEY = "poast-signals-reading-list";
const PAGE_SIZE = 30;

// Category → accent tint. Used for placeholder thumbs and category dots.
const CATEGORY_ACCENT: Record<string, string> = {
  "Semiconductors": D.amber,
  "AI": D.violet,
  "Data Center": D.cyan,
  "Hardware": D.amber,
  "GPUs": D.amber,
  "Markets": D.teal,
  "Tech": D.blue,
  "Energy": D.teal,
};

// ─── Helpers ─────────────────────────────────────────────────────────

function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h";
  if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + "d";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pickPayload(item: NewsItem): string {
  let body = item.snippet ? item.title + "\n\n" + item.snippet : item.title;
  if (item.link) body += "\n\n" + item.link;
  return body;
}

function categoryAccent(cat?: string): string {
  if (!cat) return D.amber;
  return CATEGORY_ACCENT[cat] || D.amber;
}

function loadReading(): ReadingItem[] {
  try {
    const raw = localStorage.getItem(READING_KEY);
    return raw ? (JSON.parse(raw) as ReadingItem[]) : [];
  } catch { return []; }
}

function saveReading(list: ReadingItem[]) {
  try { localStorage.setItem(READING_KEY, JSON.stringify(list.slice(0, 50))); }
  catch { /* quota / disabled */ }
}

// Light-weight trending derivation. Tokenizes titles, dedupes against
// stopwords, and counts mentions across the loaded feed. Sparkline data
// is a synthetic 7-day distribution derived from item timestamps.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "to", "of", "in", "on", "at",
  "by", "from", "is", "was", "are", "were", "be", "been", "this", "that", "these",
  "those", "it", "its", "as", "if", "than", "then", "so", "we", "you", "they", "i",
  "he", "she", "his", "her", "our", "their", "new", "says", "report", "reports",
  "after", "before", "into", "over", "more", "less", "could", "would", "should",
  "will", "has", "have", "had", "may", "can", "about", "amid", "next", "first",
  "year", "week", "today", "vs", "via", "how", "why", "what",
]);

interface TrendTopic {
  topic: string;
  count: number;
  spark: { v: number }[];
}

function deriveTrending(items: NewsItem[]): TrendTopic[] {
  const counts: Record<string, number> = {};
  const dayBuckets: Record<string, number[]> = {};
  const now = Date.now();
  for (const it of items) {
    const tokens = (it.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9 +-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOPWORDS.has(w));
    const t = it.date ? new Date(it.date).getTime() : now;
    const ageDays = Math.max(0, Math.min(6, Math.floor((now - t) / 86_400_000)));
    const uniq = Array.from(new Set(tokens));
    for (const w of uniq) {
      counts[w] = (counts[w] || 0) + 1;
      if (!dayBuckets[w]) dayBuckets[w] = [0, 0, 0, 0, 0, 0, 0];
      dayBuckets[w][6 - ageDays] += 1;
    }
  }
  const ranked = Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return ranked.map(([topic, count]) => ({
    topic: topic.charAt(0).toUpperCase() + topic.slice(1),
    count,
    spark: (dayBuckets[topic] || [0, 0, 0, 0, 0, 0, 0]).map(v => ({ v })),
  }));
}

// ─── Action routing ──────────────────────────────────────────────────

function draftPost(item: NewsItem) {
  const store = useStore.getState();
  const payload = pickPayload(item);
  store.pushOutput({
    sourceTool: "signal-feed",
    kind: "caption",
    payload,
    preview: item.title.slice(0, 140),
  });
  store.setPendingRoute({
    destinationTool: "captions",
    sourceTool: "signal-feed",
    payload,
    kind: "caption",
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("poast-nav", { detail: "captions" }));
  }
  showToast("Sent to Capper.", "success");
}

function addToIdeas(item: NewsItem) {
  const store = useStore.getState();
  const payload = pickPayload(item);
  store.pushOutput({
    sourceTool: "signal-feed",
    kind: "idea",
    payload,
    preview: item.title.slice(0, 140),
  });
  store.setPendingRoute({
    destinationTool: "ideas",
    sourceTool: "signal-feed",
    payload,
    kind: "idea",
  });
  // Caller must do the soft-nav. We push to the bus + stage pendingRoute,
  // then the component-scoped wrapper calls router.push so the in-memory
  // Zustand bus survives the route change. A hard window.location.href
  // reload would wipe the store before /ideas can consume it.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("poast-nav", { detail: "ideas" }));
  }
}

function saveReadingItem(item: NewsItem): boolean {
  const list = loadReading();
  if (list.some(r => r.link && r.link === item.link)) return false;
  const next: ReadingItem[] = [{
    title: item.title,
    link: item.link,
    source: item.source,
    date: item.date,
    savedAt: Date.now(),
  }, ...list];
  saveReading(next);
  return true;
}

// ─── Sub-components ──────────────────────────────────────────────────

interface ChipProps {
  label: string;
  onClick: () => void;
  accent?: string;
  visible: boolean;
}

const ActionChip: React.FC<ChipProps> = ({ label, onClick, accent, visible }) => {
  const tint = accent || D.amber;
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={{
        fontFamily: mn,
        fontSize: 10,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        padding: "5px 10px",
        borderRadius: 5,
        border: "1px solid " + D.border,
        background: "transparent",
        color: D.txm,
        cursor: "pointer",
        transition: "all 0.15s ease",
        opacity: visible ? 1 : 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = tint;
        e.currentTarget.style.borderColor = tint + "55";
        e.currentTarget.style.background = tint + "0C";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = D.txm;
        e.currentTarget.style.borderColor = D.border;
        e.currentTarget.style.background = "transparent";
      }}
    >{label}</button>
  );
};

interface ThumbProps {
  item: NewsItem;
  size: "lead" | "row";
}

const Thumb: React.FC<ThumbProps> = ({ item, size }) => {
  const w = size === "lead" ? "100%" : 84;
  const h = size === "lead" ? 200 : 84;
  const img = item.image || item.thumbnail;
  const tint = categoryAccent(item.category);
  if (img) {
    return (
      <div style={{
        width: w,
        height: h,
        borderRadius: 8,
        overflow: "hidden",
        background: D.bg,
        border: "1px solid " + D.border,
        flexShrink: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  // Placeholder: category-tinted gradient with first letter.
  const letter = (item.category || item.source || "S").slice(0, 1).toUpperCase();
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: 8,
      flexShrink: 0,
      background: "linear-gradient(135deg, " + tint + "22 0%, " + tint + "08 60%, " + D.card + " 100%)",
      border: "1px solid " + tint + "33",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        fontFamily: gf,
        fontSize: size === "lead" ? 72 : 36,
        fontWeight: 900,
        color: tint,
        opacity: 0.5,
        letterSpacing: -2,
      }}>{letter}</div>
    </div>
  );
};

interface SourcesDropdownProps {
  sources: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

const SourcesDropdown: React.FC<SourcesDropdownProps> = ({ sources, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = "Sources: " + selected.size + " of " + sources.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          fontFamily: mn,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          padding: "7px 12px",
          borderRadius: 6,
          border: "1px solid " + (open ? D.amber + "55" : D.border),
          background: open ? D.amber + "10" : "transparent",
          color: open ? D.amber : D.txm,
          cursor: "pointer",
        }}
      >{label}</button>
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 6px)",
          width: 240,
          maxHeight: 320,
          overflowY: "auto",
          background: D.card,
          border: "1px solid " + D.border,
          borderRadius: 8,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          zIndex: 50,
          padding: 8,
        }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, padding: "4px 6px" }}>
            <button onClick={() => onChange(new Set(sources))} style={{
              flex: 1, fontFamily: mn, fontSize: 9, letterSpacing: 0.6,
              textTransform: "uppercase", padding: "5px 8px", borderRadius: 4,
              border: "1px solid " + D.border, background: "transparent",
              color: D.txm, cursor: "pointer",
            }}>All</button>
            <button onClick={() => onChange(new Set())} style={{
              flex: 1, fontFamily: mn, fontSize: 9, letterSpacing: 0.6,
              textTransform: "uppercase", padding: "5px 8px", borderRadius: 4,
              border: "1px solid " + D.border, background: "transparent",
              color: D.txm, cursor: "pointer",
            }}>None</button>
          </div>
          {sources.map(src => {
            const on = selected.has(src);
            return (
              <div
                key={src}
                onClick={() => {
                  const next = new Set(selected);
                  if (on) next.delete(src); else next.add(src);
                  onChange(next);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 8px", cursor: "pointer", borderRadius: 4,
                  fontFamily: ft, fontSize: 12, color: on ? D.tx : D.txm,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = D.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: "1px solid " + (on ? D.amber : D.border),
                  background: on ? D.amber : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: mn, fontSize: 10, color: D.bg, fontWeight: 700,
                }}>{on ? "✓" : ""}</div>
                <span>{src}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── SA Angle inline panel ───────────────────────────────────────────

interface AngleState {
  loading: boolean;
  text: string;
  error: string;
}

interface SignalCardProps {
  item: NewsItem;
  variant: "lead" | "row";
  angle: AngleState | undefined;
  onAngle: (item: NewsItem) => void;
  onUseAngle: (item: NewsItem, text: string) => void;
  onSave: (item: NewsItem) => void;
  onAddToIdeas: (item: NewsItem) => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ item, variant, angle, onAngle, onUseAngle, onSave, onAddToIdeas }) => {
  const [hover, setHover] = useState(false);
  const accent = categoryAccent(item.category);
  const isLead = variant === "lead";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: D.card,
        border: "1px solid " + (hover ? D.amber + "66" : D.border),
        borderRadius: 14,
        padding: isLead ? 22 : 18,
        marginBottom: 14,
        transition: "all 0.18s ease",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hover ? "0 10px 28px rgba(0,0,0,0.5)" : "0 1px 0 rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: isLead ? "column" : "row",
        gap: isLead ? 16 : 16,
        alignItems: isLead ? "stretch" : "flex-start",
      }}
    >
      {isLead ? (
        <Thumb item={item} size="lead" />
      ) : (
        <Thumb item={item} size="row" />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Meta row */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          {item.source && (
            <span style={{
              fontFamily: mn, fontSize: 10, color: accent,
              padding: "2px 7px", borderRadius: 4,
              background: accent + "12", letterSpacing: 0.8, textTransform: "uppercase",
              fontWeight: 600,
            }}>{item.source}</span>
          )}
          {item.category && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.8, textTransform: "uppercase",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
              {item.category}
            </span>
          )}
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{relTime(item.date)}</span>
        </div>

        {/* Title */}
        <a
          href={item.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: isLead ? gf : ft,
            fontSize: isLead ? 22 : 14,
            fontWeight: isLead ? 700 : 600,
            color: D.tx,
            textDecoration: "none",
            lineHeight: isLead ? 1.25 : 1.4,
            letterSpacing: isLead ? -0.4 : 0,
            display: "block",
            marginBottom: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = D.amber; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = D.tx; }}
        >{item.title}</a>

        {/* Snippet */}
        {item.snippet && (
          <div style={{
            fontFamily: ft,
            fontSize: isLead ? 14 : 12,
            color: D.txm,
            lineHeight: 1.5,
            marginBottom: 12,
            display: "-webkit-box",
            WebkitLineClamp: isLead ? 3 : 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>{item.snippet}</div>
        )}

        {/* SA Angle inline result */}
        {angle && (angle.loading || angle.text || angle.error) && (
          <div style={{
            border: "1px solid " + D.amber + "44",
            background: D.amber + "0A",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
          }}>
            <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", color: D.amber, marginBottom: 6 }}>SA Angle</div>
            {angle.loading && (
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>Generating…</div>
            )}
            {angle.error && (
              <div style={{ fontFamily: mn, fontSize: 11, color: D.coral }}>{angle.error}</div>
            )}
            {!angle.loading && angle.text && (
              <>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{angle.text}</div>
                <button
                  onClick={() => onUseAngle(item, angle.text)}
                  style={{
                    marginTop: 8,
                    fontFamily: mn, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase",
                    padding: "5px 10px", borderRadius: 5,
                    border: "1px solid " + D.amber + "66",
                    background: D.amber + "16", color: D.amber,
                    cursor: "pointer",
                  }}
                >Use this angle →</button>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap",
          opacity: hover ? 1 : 0.35,
          transition: "opacity 0.2s ease",
        }}>
          <ActionChip label="Draft Post" visible={true} onClick={() => draftPost(item)} accent={D.amber} />
          <ActionChip label="Add to Ideas" visible={true} onClick={() => onAddToIdeas(item)} accent={D.violet} />
          <ActionChip label="Save to Reading" visible={true} onClick={() => onSave(item)} accent={D.teal} />
          <ActionChip label="SA Angle" visible={true} onClick={() => onAngle(item)} accent={D.cyan} />
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: mn, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase",
                padding: "5px 10px", borderRadius: 5,
                border: "1px solid " + D.border, background: "transparent", color: D.txm,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = D.blue; e.currentTarget.style.borderColor = D.blue + "55"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = D.txm; e.currentTarget.style.borderColor = D.border; }}
            >Open ↗</a>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Heating Up rail ─────────────────────────────────────────────────

interface HeatingUpProps {
  trends: TrendTopic[];
  onTopicClick: (topic: string) => void;
}

const HeatingUp: React.FC<HeatingUpProps> = ({ trends, onTopicClick }) => {
  return (
    <div style={{
      background: D.card,
      border: "1px solid " + D.border,
      borderRadius: 14,
      padding: 18,
      marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%", background: D.amber,
          boxShadow: "0 0 8px " + D.amber,
        }} />
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2.4, textTransform: "uppercase", color: D.amber, fontWeight: 600 }}>Heating Up</div>
      </div>
      {trends.length === 0 && (
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, padding: "8px 0" }}>No trends yet — load more signals.</div>
      )}
      {trends.map((t, i) => (
        <div
          key={t.topic}
          onClick={() => onTopicClick(t.topic)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 0",
            borderBottom: i === trends.length - 1 ? "none" : "1px solid " + D.border,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = D.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{
            width: 22, fontFamily: mn, fontSize: 11, color: D.txd, fontWeight: 600,
            textAlign: "center",
          }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.6, marginTop: 2 }}>{t.count} mentions</div>
          </div>
          <div style={{ width: 60, height: 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={t.spark}>
                <Line type="monotone" dataKey="v" stroke={D.amber} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Reading list rail ───────────────────────────────────────────────

interface ReadingRailProps {
  items: ReadingItem[];
  onRemove: (link?: string) => void;
}

const ReadingRail: React.FC<ReadingRailProps> = ({ items, onRemove }) => {
  return (
    <div style={{
      background: D.card,
      border: "1px solid " + D.border,
      borderRadius: 14,
      padding: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2.4, textTransform: "uppercase", color: D.teal, fontWeight: 600 }}>Reading List</div>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{items.length}</span>
      </div>
      {items.length === 0 && (
        <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5 }}>
          Nothing saved yet. Hit <span style={{ fontFamily: mn, fontSize: 10, color: D.teal }}>Save to Reading</span> on any signal to stash it for later.
        </div>
      )}
      {items.slice(0, 8).map((r) => (
        <div key={r.link || r.title} style={{
          padding: "10px 0",
          borderBottom: "1px solid " + D.border,
        }}>
          <a href={r.link || "#"} target="_blank" rel="noopener noreferrer" style={{
            fontFamily: ft, fontSize: 12, color: D.tx, textDecoration: "none",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>{r.title}</a>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.6 }}>{r.source || ""}</span>
            <button
              onClick={() => onRemove(r.link)}
              style={{
                fontFamily: mn, fontSize: 9, color: D.coral, background: "transparent",
                border: "none", cursor: "pointer", padding: 0, letterSpacing: 0.6, textTransform: "uppercase",
              }}
            >Remove</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Panel ──────────────────────────────────────────────────────

export default function SignalFeedPanel() {
  const router = useRouter();
  const [data, setData] = useState<NewsResponse>({ items: [] });
  const [filter, setFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("7d");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourcesInit, setSourcesInit] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [widgetsOpen, setWidgetsOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [reading, setReading] = useState<ReadingItem[]>([]);
  const [angles, setAngles] = useState<Record<string, AngleState>>({});
  const [topicQuery, setTopicQuery] = useState<string>("");

  // Soft-nav wrapper for the Add-to-Ideas action. addToIdeas() pushes
  // to the in-memory Zustand bus + stages pendingRoute; we then use the
  // App Router so the store survives the route change (hard nav would
  // wipe the in-memory bus before the Ideas page can consume it).
  const handleAddToIdeas = (item: NewsItem) => {
    addToIdeas(item);
    router.push("/intelligence-suite/ideas");
  };

  // Hydrate reading list once.
  useEffect(() => {
    setReading(loadReading());
  }, []);

  // Fetch feed when filter changes.
  useEffect(() => {
    let cancelled = false;
    const active = FILTERS.find(f => f.id === filter) || FILTERS[0];
    const q = active.apiCategory ? "?category=" + encodeURIComponent(active.apiCategory) : "";
    setLoading(true);
    fetch("/api/news" + q)
      .then(r => r.json())
      .then((d: NewsResponse) => {
        if (cancelled) return;
        setData(d || { items: [] });
        setLoading(false);
        setVisibleCount(PAGE_SIZE);
        // Initialize source selection to all on first successful load.
        if (!sourcesInit && d?.sources && d.sources.length) {
          setSelectedSources(new Set(d.sources));
          setSourcesInit(true);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, sourcesInit]);

  const active = FILTERS.find(f => f.id === filter) || FILTERS[0];
  const range = DATE_RANGES.find(d => d.id === dateRange) || DATE_RANGES[1];
  const allSources = data.sources || Array.from(new Set((data.items || []).map(i => i.source).filter(Boolean) as string[])).sort();

  // Apply filters.
  const filteredItems = useMemo(() => {
    let items = data.items || [];
    if (active.titleMatch) {
      items = items.filter(it => active.titleMatch!.test(it.title || ""));
    }
    if (topicQuery) {
      const re = new RegExp(topicQuery, "i");
      items = items.filter(it => re.test(it.title || "") || re.test(it.snippet || ""));
    }
    if (range.ms !== Number.POSITIVE_INFINITY) {
      const cutoff = Date.now() - range.ms;
      items = items.filter(it => {
        if (!it.date) return true;
        const t = new Date(it.date).getTime();
        return !t || isNaN(t) ? true : t >= cutoff;
      });
    }
    if (sourcesInit && selectedSources.size > 0 && selectedSources.size < allSources.length) {
      items = items.filter(it => it.source && selectedSources.has(it.source));
    } else if (sourcesInit && selectedSources.size === 0) {
      items = [];
    }
    return items;
  }, [data.items, active, topicQuery, range.ms, sourcesInit, selectedSources, allSources.length]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  const trending = useMemo(() => deriveTrending(data.items || []), [data.items]);

  // SA Angle handler.
  function requestAngle(item: NewsItem) {
    const key = item.link || item.title;
    setAngles(prev => ({ ...prev, [key]: { loading: true, text: "", error: "" } }));
    const prompt = "Given this signal, write a 2-line SemiAnalysis angle.\n\nTitle: " + item.title + "\nSnippet: " + (item.snippet || "") + (item.source ? "\nSource: " + item.source : "");
    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "You are a senior analyst at SemiAnalysis. Be concise. No emojis. No hashtags. No em dashes. Write exactly two lines: line 1 frames the angle in market terms; line 2 names the second-order implication.",
        prompt,
      }),
    })
      .then(r => r.json())
      .then((d: { content?: { text?: string }[]; error?: unknown }) => {
        if (d.error) throw new Error(typeof d.error === "string" ? d.error : "Generation failed");
        const text = (d.content || []).map(c => c.text || "").join("").trim();
        setAngles(prev => ({ ...prev, [key]: { loading: false, text: text || "(empty response)", error: "" } }));
      })
      .catch((e: Error) => {
        setAngles(prev => ({ ...prev, [key]: { loading: false, text: "", error: e.message || "Error generating angle." } }));
      });
  }

  function useAngle(item: NewsItem, text: string) {
    const store = useStore.getState();
    const payload = text + "\n\nSource: " + item.title + (item.link ? "\n" + item.link : "");
    store.pushOutput({
      sourceTool: "signal-feed",
      kind: "caption",
      payload,
      preview: "SA Angle: " + item.title.slice(0, 100),
    });
    store.setPendingRoute({
      destinationTool: "captions",
      sourceTool: "signal-feed",
      payload,
      kind: "caption",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poast-nav", { detail: "captions" }));
    }
    showToast("Angle sent to Capper.", "success");
  }

  function onSave(item: NewsItem) {
    const ok = saveReadingItem(item);
    if (ok) {
      setReading(loadReading());
      showToast("Saved to Reading List.", "success");
    } else {
      showToast("Already saved.", "info");
    }
  }

  function onRemoveReading(link?: string) {
    const next = loadReading().filter(r => r.link !== link);
    saveReading(next);
    setReading(next);
  }

  const subtitle = "Distilled news, threads, and announcements across our coverage.";

  return (
    <div style={{ fontFamily: ft, color: D.tx }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", color: D.amber, marginBottom: 6, fontWeight: 600 }}>Signals</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, lineHeight: 1.5 }}>{subtitle}</div>
      </div>

      {/* ─── Filter bar ─── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map(f => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setTopicQuery(""); }}
                style={{
                  fontFamily: mn,
                  fontSize: 10,
                  letterSpacing: 1.0,
                  textTransform: "uppercase",
                  padding: "7px 13px",
                  borderRadius: 6,
                  border: "1px solid " + (on ? D.amber : D.border),
                  background: on ? D.amber : "transparent",
                  color: on ? D.bg : D.txm,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontWeight: on ? 700 : 500,
                }}
              >{f.label}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 0, border: "1px solid " + D.border, borderRadius: 6, overflow: "hidden" }}>
            {DATE_RANGES.map((d, i) => {
              const on = dateRange === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDateRange(d.id)}
                  style={{
                    fontFamily: mn, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
                    padding: "7px 10px",
                    borderLeft: i === 0 ? "none" : "1px solid " + D.border,
                    background: on ? D.amber + "18" : "transparent",
                    color: on ? D.amber : D.txm,
                    cursor: "pointer", border: "none",
                  }}
                >{d.label}</button>
              );
            })}
          </div>
          <SourcesDropdown
            sources={allSources}
            selected={selectedSources}
            onChange={setSelectedSources}
          />
        </div>
      </div>

      {/* Topic-from-trending pill */}
      {topicQuery && (
        <div style={{ marginBottom: 14 }}>
          <span style={{
            fontFamily: mn, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
            color: D.amber, padding: "5px 10px", borderRadius: 6,
            background: D.amber + "12", border: "1px solid " + D.amber + "55",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            Topic: {topicQuery}
            <button onClick={() => setTopicQuery("")} style={{
              background: "transparent", border: "none", color: D.amber,
              fontFamily: mn, fontSize: 12, cursor: "pointer", padding: 0,
            }}>×</button>
          </span>
        </div>
      )}

      {/* ─── Two-column layout ─── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 7fr) minmax(280px, 3fr)",
        gap: 20,
        alignItems: "start",
      }} className="signals-grid">
        {/* LEFT — stream */}
        <div style={{ minWidth: 0 }}>
          {loading && visibleItems.length === 0 && (
            <div style={{
              padding: "40px 20px", textAlign: "center",
              background: D.card, border: "1px solid " + D.border, borderRadius: 14,
              fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 0.6,
            }}>Loading signals…</div>
          )}
          {!loading && visibleItems.length === 0 && (
            <div style={{
              padding: "44px 24px", textAlign: "center",
              background: D.card, border: "1px solid " + D.border, borderRadius: 14,
            }}>
              <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 700, color: D.tx, marginBottom: 8 }}>No signals match these filters.</div>
              <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginBottom: 16 }}>Try widening the date range or clearing the topic filter.</div>
              <button
                onClick={() => { setDateRange("all"); setTopicQuery(""); setFilter("all"); }}
                style={{
                  fontFamily: mn, fontSize: 10, letterSpacing: 1.0, textTransform: "uppercase",
                  padding: "8px 16px", borderRadius: 6,
                  border: "1px solid " + D.amber + "55", background: D.amber + "12", color: D.amber,
                  cursor: "pointer", fontWeight: 600,
                }}
              >Reset filters</button>
            </div>
          )}
          {visibleItems.map((item, i) => {
            const key = item.link || (item.title + "-" + i);
            return (
              <SignalCard
                key={key}
                item={item}
                variant={i === 0 ? "lead" : "row"}
                angle={angles[item.link || item.title]}
                onAngle={requestAngle}
                onUseAngle={useAngle}
                onSave={onSave}
                onAddToIdeas={handleAddToIdeas}
              />
            );
          })}
          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                style={{
                  fontFamily: mn, fontSize: 11, letterSpacing: 1.0, textTransform: "uppercase",
                  padding: "10px 22px", borderRadius: 6,
                  border: "1px solid " + D.border, background: D.card, color: D.txm,
                  cursor: "pointer", fontWeight: 600,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = D.amber;
                  e.currentTarget.style.borderColor = D.amber + "55";
                  e.currentTarget.style.background = D.amber + "0C";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = D.txm;
                  e.currentTarget.style.borderColor = D.border;
                  e.currentTarget.style.background = D.card;
                }}
              >Load more ({filteredItems.length - visibleCount} remaining)</button>
            </div>
          )}
        </div>

        {/* RIGHT — leaderboard + reading list */}
        <div style={{ minWidth: 0 }}>
          <HeatingUp trends={trending} onTopicClick={(t) => { setTopicQuery(t); setVisibleCount(PAGE_SIZE); }} />
          <ReadingRail items={reading} onRemove={onRemoveReading} />
        </div>
      </div>

      {/* ─── Legacy NewsFlow widgets, collapsed by default ─── */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid " + D.border }}>
        <button
          onClick={() => setWidgetsOpen(v => !v)}
          style={{
            fontFamily: mn,
            fontSize: 10,
            letterSpacing: 1.4,
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
          <span>Show legacy widgets — News Flow board</span>
        </button>
        {widgetsOpen && (
          <div style={{ marginTop: 14, border: "1px solid " + D.border, borderRadius: 10, overflow: "hidden", background: D.card }}>
            <NewsFlow />
          </div>
        )}
      </div>

      {/* Responsive collapse to single column on narrow viewports. */}
      <style jsx>{`
        @media (max-width: 880px) {
          :global(.signals-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
