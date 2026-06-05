"use client";

// RSS Manager · Production Studio
//
// v1 scope:
//   - Load + parse the SA Weekly podcast feed (server-side via /api/rss-feed
//     so we don't fight CORS in the browser).
//   - Show feed health (HTTP status, parse status, title, last build, count,
//     latest episode).
//   - Paginated episode list (10 per page).
//   - Distribution status sidebar with placeholder "Push now" buttons that
//     hit /api/rss-push (which currently returns "Coming soon").

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Rss, CheckCircle2, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";
import { useToast } from "../toast-context";

const DEFAULT_FEED_URL = "https://anchor.fm/s/poast/podcast/rss";
const STORAGE_KEY = "poast-rss-manager-state";
const PAGE_SIZE = 10;

type Platform = "spotify" | "apple" | "youtube";

interface FeedItem {
  id: string;
  title: string;
  pubDate: string;
  isoDate: string;
  duration: string;
  link: string;
  description: string;
}

interface FeedHealth {
  ok: boolean;
  valid: boolean;
  title: string;
  description?: string;
  feedUrl: string;
  lastBuildDate: string;
  itemCount: number;
  latestEpisodeDate: string;
  imageUrl: string;
  items: FeedItem[];
  httpStatus: number;
  error?: string;
}

interface DistroState {
  spotify: string | null;
  apple: string | null;
  youtube: string | null;
}

interface StoredState {
  feedUrl: string;
  distro: DistroState;
}

const PLATFORM_META: Record<Platform, { name: string; sub: string; color: string }> = {
  spotify: { name: "Spotify", sub: "Spotify for Podcasters", color: "#1DB954" },
  apple: { name: "Apple Podcasts", sub: "Apple Podcasts Connect", color: D.violet },
  youtube: { name: "YouTube", sub: "Podcasts on YouTube", color: D.crimson },
};

function loadStored(): StoredState {
  if (typeof window === "undefined") {
    return { feedUrl: DEFAULT_FEED_URL, distro: { spotify: null, apple: null, youtube: null } };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { feedUrl: DEFAULT_FEED_URL, distro: { spotify: null, apple: null, youtube: null } };
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      feedUrl: parsed.feedUrl || DEFAULT_FEED_URL,
      distro: {
        spotify: parsed.distro?.spotify ?? null,
        apple: parsed.distro?.apple ?? null,
        youtube: parsed.distro?.youtube ?? null,
      },
    };
  } catch {
    return { feedUrl: DEFAULT_FEED_URL, distro: { spotify: null, apple: null, youtube: null } };
  }
}

function saveStored(s: StoredState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Quota / private mode — non-fatal.
  }
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return iso;
  }
}

export default function RssManager() {
  const { showToast } = useToast();
  const [initial] = useState<StoredState>(loadStored);
  const [feedUrl, setFeedUrl] = useState<string>(initial.feedUrl);
  const [feed, setFeed] = useState<FeedHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [distro, setDistro] = useState<DistroState>(initial.distro);
  const [pushing, setPushing] = useState<Platform | null>(null);

  useEffect(() => {
    saveStored({ feedUrl, distro });
  }, [feedUrl, distro]);

  const loadFeed = useCallback(async (url: string) => {
    if (!url.trim()) {
      showToast("Enter a feed URL first.", "error");
      return;
    }
    setLoading(true);
    setPage(0);
    try {
      const res = await fetch("/api/rss-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setFeed({
          ok: false,
          valid: false,
          title: "",
          feedUrl: url,
          lastBuildDate: "",
          itemCount: 0,
          latestEpisodeDate: "",
          imageUrl: "",
          items: [],
          httpStatus: j.httpStatus || res.status,
          error: j.error || "Unknown failure",
        });
        showToast(j.error || "Feed load failed", "error");
        return;
      }
      setFeed(j as FeedHealth);
      showToast(`Loaded ${j.itemCount} episodes`, "success");
    } catch (e) {
      showToast(`Network error: ${String(e)}`, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Auto-load on first mount so users see something immediately.
  useEffect(() => {
    void loadFeed(initial.feedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushTo = useCallback(async (platform: Platform) => {
    if (!feed?.ok) {
      showToast("Load a valid feed first.", "error");
      return;
    }
    setPushing(platform);
    try {
      const res = await fetch("/api/rss-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, feedUrl: feed.feedUrl }),
      });
      const j = await res.json();
      if (j.ok) {
        const now = new Date().toISOString();
        setDistro((d) => ({ ...d, [platform]: now }));
        showToast(j.message || `Push to ${platform} queued`, "info");
      } else {
        showToast(j.error || "Push failed", "error");
      }
    } catch (e) {
      showToast(`Network error: ${String(e)}`, "error");
    } finally {
      setPushing(null);
    }
  }, [feed, showToast]);

  const pageItems = useMemo<FeedItem[]>(() => {
    if (!feed?.items) return [];
    const start = page * PAGE_SIZE;
    return feed.items.slice(start, start + PAGE_SIZE);
  }, [feed, page]);

  const totalPages = feed ? Math.max(1, Math.ceil(feed.items.length / PAGE_SIZE)) : 1;

  return (
    <div style={{ padding: "24px 28px 64px", maxWidth: 1280, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={iconBox(D.cyan)}>
          <Rss size={18} color={D.cyan} strokeWidth={1.8} />
        </div>
        <div>
          <h1 style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, letterSpacing: -0.4, margin: 0, color: D.tx }}>
            RSS Manager
          </h1>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 2 }}>
            View SA Weekly feed health, browse episodes, and push to distribution targets.
          </div>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18 }}>
        <input
          type="url"
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="https://anchor.fm/s/.../podcast/rss"
          style={input}
        />
        <button
          type="button"
          onClick={() => loadFeed(feedUrl)}
          disabled={loading}
          style={primaryBtn(loading)}
        >
          {loading ? "Loading…" : "Load feed"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18 }}>
        <div style={{ minWidth: 0 }}>
          <FeedHealthCard feed={feed} loading={loading} />
          <div style={{ height: 18 }} />
          <EpisodeList
            items={pageItems}
            page={page}
            totalPages={totalPages}
            total={feed?.items.length || 0}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            loading={loading}
          />
        </div>
        <DistributionSidebar
          distro={distro}
          onPush={pushTo}
          pushing={pushing}
          feedReady={!!feed?.ok}
        />
      </div>
    </div>
  );
}

function FeedHealthCard({ feed, loading }: { feed: FeedHealth | null; loading: boolean }) {
  if (loading && !feed) {
    return <div style={emptyBox}>Loading feed…</div>;
  }
  if (!feed) {
    return <div style={emptyBox}>Paste a feed URL and click Load feed.</div>;
  }
  const valid = feed.ok && feed.valid;
  const ringColor = valid ? D.teal : D.coral;
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        {valid ? (
          <CheckCircle2 size={18} color={D.teal} strokeWidth={2} />
        ) : (
          <AlertTriangle size={18} color={D.coral} strokeWidth={2} />
        )}
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: ringColor, textTransform: "uppercase", fontWeight: 700 }}>
          {valid ? "Feed healthy" : "Feed problem"}
        </div>
        <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6 }}>
          HTTP {feed.httpStatus || "—"}
        </div>
      </div>

      {valid ? (
        <>
          <div style={{ fontFamily: gf, fontSize: 22, color: D.tx, marginBottom: 4 }}>
            {feed.title}
          </div>
          {feed.description ? (
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginBottom: 14, lineHeight: 1.5 }}>
              {feed.description.length > 220 ? feed.description.slice(0, 220) + "…" : feed.description}
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Stat label="Items" value={String(feed.itemCount)} />
            <Stat label="Latest episode" value={formatDate(feed.latestEpisodeDate)} />
            <Stat label="Last build" value={formatDate(feed.lastBuildDate)} />
            <Stat label="Validity" value={valid ? "HTTP 200 + parse OK" : "Failed"} color={valid ? D.teal : D.coral} />
          </div>
        </>
      ) : (
        <div style={{ fontFamily: ft, fontSize: 13, color: D.coral, lineHeight: 1.5 }}>
          {feed.error || "Feed could not be loaded."}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: mn, fontSize: 12, color: color || D.tx, lineHeight: 1.4, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function EpisodeList({
  items,
  page,
  totalPages,
  total,
  onPrev,
  onNext,
  loading,
}: {
  items: FeedItem[];
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  if (loading && items.length === 0) {
    return <div style={emptyBox}>Loading episodes…</div>;
  }
  if (items.length === 0) {
    return <div style={emptyBox}>No episodes yet — load a feed above.</div>;
  }
  return (
    <div style={{ ...card, padding: 0 }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${D.border}` }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase" }}>
          Episodes — page {page + 1} / {totalPages} · {total} total
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onPrev} disabled={page === 0} style={pageBtn(page === 0)}>
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <button type="button" onClick={onNext} disabled={page >= totalPages - 1} style={pageBtn(page >= totalPages - 1)}>
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div>
        {items.map((it) => (
          <EpisodeRow key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}

function EpisodeRow({ item }: { item: FeedItem }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 110px 90px 70px",
      gap: 12,
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: `1px solid ${D.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: gf, fontSize: 14, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </div>
        {item.description ? (
          <div style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.description}
          </div>
        ) : null}
      </div>
      <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txm, letterSpacing: 0.4 }}>
        {formatDate(item.isoDate || item.pubDate)}
      </div>
      <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txm, letterSpacing: 0.4 }}>
        {item.duration}
      </div>
      <div style={{ textAlign: "right" }}>
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: D.cyan,
              fontFamily: mn,
              fontSize: 10,
              letterSpacing: 0.6,
              textDecoration: "none",
              textTransform: "uppercase",
            }}
          >
            Open <ExternalLink size={11} />
          </a>
        ) : (
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>—</span>
        )}
      </div>
    </div>
  );
}

function DistributionSidebar({
  distro,
  onPush,
  pushing,
  feedReady,
}: {
  distro: DistroState;
  onPush: (p: Platform) => void;
  pushing: Platform | null;
  feedReady: boolean;
}) {
  return (
    <aside>
      <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase", marginBottom: 10 }}>
        Distribution status
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(Object.keys(PLATFORM_META) as Platform[]).map((p) => {
          const meta = PLATFORM_META[p];
          const last = distro[p];
          const isPushing = pushing === p;
          return (
            <div key={p} style={{ ...card, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={iconBox(meta.color)}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: gf, fontSize: 14, color: D.tx }}>{meta.name}</div>
                  <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 0.6, color: D.txd, textTransform: "uppercase" }}>
                    {meta.sub}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, lineHeight: 1.4 }}>
                  <div style={{ color: D.txd, letterSpacing: 0.6, textTransform: "uppercase", fontSize: 9, marginBottom: 2 }}>
                    Last pushed
                  </div>
                  {formatRelative(last)}
                </div>
                <button
                  type="button"
                  onClick={() => onPush(p)}
                  disabled={!feedReady || isPushing}
                  style={pushBtn(meta.color, !feedReady || isPushing)}
                >
                  <Send size={11} strokeWidth={2} />
                  {isPushing ? "Pushing…" : "Push now"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        border: `1px dashed ${D.border}`,
        borderRadius: 8,
        fontFamily: mn,
        fontSize: 10,
        color: D.txd,
        letterSpacing: 0.4,
        lineHeight: 1.5,
      }}>
        v1 stub. OAuth wiring for Spotify / Apple / YouTube ships in a later phase.
      </div>
    </aside>
  );
}

const card: React.CSSProperties = {
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 12,
  color: D.tx,
};

const emptyBox: React.CSSProperties = {
  ...card,
  padding: 28,
  fontFamily: ft,
  fontSize: 13,
  color: D.txm,
  textAlign: "center",
  lineHeight: 1.5,
};

const input: React.CSSProperties = {
  flex: 1,
  height: 38,
  padding: "0 12px",
  background: D.bg,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  color: D.tx,
  fontFamily: mn,
  fontSize: 12,
  letterSpacing: 0.3,
  outline: "none",
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 38,
    padding: "0 16px",
    background: disabled ? D.surface : D.cyan + "1c",
    border: `1px solid ${disabled ? D.border : D.cyan + "55"}`,
    color: disabled ? D.txd : D.cyan,
    borderRadius: 8,
    fontFamily: mn,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: D.surface,
    border: `1px solid ${D.border}`,
    color: disabled ? D.txd : D.tx,
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function pushBtn(color: string, disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    background: disabled ? D.surface : `${color}1c`,
    border: `1px solid ${disabled ? D.border : color + "55"}`,
    color: disabled ? D.txd : color,
    borderRadius: 6,
    fontFamily: mn,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function iconBox(accent: string): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: `${accent}1c`,
    border: `1px solid ${accent}55`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}
