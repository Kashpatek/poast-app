"use client";

// IdeationSuite — IntelligenceSUITE / Ideas (slot 3).
// A full ideation workspace, not a wrapper around legacy IdeationNation.
// Three zones:
//   LEFT   filters / sections / tag cloud
//   CENTER idea board — cards or kanban view, search + filter
//   RIGHT  detail editor when an idea is selected, otherwise an
//          Inspiration Feed pulling live signals so the user can
//          one-click seed a generation
// Generate modal supports three modes — Quick (single prompt → 10
// angles), From Signal (seeded with a trend / news headline), and
// Wizard (content type → audience → tone → length structured flow).
// Ideas persist to localStorage "poast-is-ideas" + Supabase /api/db
// (id="is-ideas"). Send-to chips push into the bus + router for
// hand-off to Brainstorm, Capper, Brief Builder, SA Weekly.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Plus, Search, Pin, PinOff, Trash2, Wand2, ArrowRight, Loader2, Lightbulb, Radio, X, LayoutGrid, Columns3, Send, Filter } from "lucide-react";
import { D, ft, gf, mn, uid, copyText } from "../shared-constants";
import { showToast } from "../toast-context";
import { SendToChip } from "../components/send-to-chip";

// ─── types ──────────────────────────────────────────────────────────
type Status = "backlog" | "developing" | "ready" | "shipped";
type Source = "ai" | "signal" | "manual" | "competitor";

interface Idea {
  id: string;
  title: string;
  hook: string;
  body: string;
  status: Status;
  source: Source;
  tags: string[];
  pinned: boolean;
  basedOn?: string;
  format?: string;
  audience?: string;
  outline?: string[];
  createdAt: number;
  updatedAt: number;
}

interface IdeasEnvelope {
  ideas: Idea[];
  updatedAt: number;
}

const LS_KEY = "poast-is-ideas";
const DB_TABLE = "projects";
const DB_ID = "is-ideas";
const DB_TYPE = "is-ideas";

const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: "backlog",    label: "Backlog",    color: D.txd },
  { id: "developing", label: "Developing", color: D.amber },
  { id: "ready",      label: "Ready",      color: D.cyan },
  { id: "shipped",    label: "Shipped",    color: D.teal },
];

const SOURCES: { id: Source; label: string; Icon: typeof Sparkles }[] = [
  { id: "ai",         label: "AI",         Icon: Sparkles },
  { id: "signal",     label: "Signal",     Icon: Radio },
  { id: "manual",     label: "Manual",     Icon: Plus },
  { id: "competitor", label: "Competitor", Icon: Lightbulb },
];

const CONTENT_TYPES = ["Short Video", "Meme / Image", "Thread", "Carousel", "Long-form Article", "Podcast Topic"];
const AUDIENCES = ["Hyperscaler buyers", "Wall Street", "Practitioners", "Engineering managers", "Industry generalists", "Policy / regulatory"];
const TONES = ["Direct + technical", "Punchy + provocative", "Contrarian", "Explanatory", "Data-led"];
const LENGTHS = ["Quick hit", "Standard", "Deep dive"];

// ─── helpers ────────────────────────────────────────────────────────
function statusColor(s: Status): string {
  const found = STATUSES.find(x => x.id === s);
  return found ? found.color : D.txd;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d ago";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function extractTags(text: string): string[] {
  const out = new Set<string>();
  const re = /#([A-Za-z0-9_\-]{2,40})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1].toLowerCase());
  return Array.from(out);
}

function migrate(raw: unknown): Idea {
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : uid("idea");
  const title = typeof r.title === "string" ? r.title : "Untitled idea";
  const hook = typeof r.hook === "string" ? r.hook : "";
  const body = typeof r.body === "string" ? r.body : (typeof r.description === "string" ? r.description as string : "");
  const status: Status = (typeof r.status === "string" && STATUSES.some(s => s.id === r.status)) ? r.status as Status : "backlog";
  const source: Source = (typeof r.source === "string" && SOURCES.some(s => s.id === r.source)) ? r.source as Source : "manual";
  const tags = Array.isArray(r.tags) ? (r.tags as string[]).filter(t => typeof t === "string") : extractTags(title + " " + body);
  const pinned = r.pinned === true;
  const basedOn = typeof r.basedOn === "string" ? r.basedOn : (typeof r.based_on === "string" ? r.based_on as string : undefined);
  const format = typeof r.format === "string" ? r.format : (typeof r.content_type === "string" ? r.content_type as string : undefined);
  const audience = typeof r.audience === "string" ? r.audience : undefined;
  const outline = Array.isArray(r.outline) ? (r.outline as string[]).filter(t => typeof t === "string") : undefined;
  const createdAt = typeof r.createdAt === "number" ? r.createdAt : Date.now();
  const updatedAt = typeof r.updatedAt === "number" ? r.updatedAt : createdAt;
  return { id, title, hook, body, status, source, tags, pinned, basedOn, format, audience, outline, createdAt, updatedAt };
}

function readLS(): IdeasEnvelope | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdeasEnvelope;
    if (!parsed || !Array.isArray(parsed.ideas)) return null;
    return { ideas: parsed.ideas.map(migrate), updatedAt: parsed.updatedAt || Date.now() };
  } catch { return null; }
}

function writeLS(env: IdeasEnvelope) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(env)); } catch { /* quota */ }
}

// ─── component ──────────────────────────────────────────────────────
export default function IdeationBoardPanel() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "kanban">("cards");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterSource, setFilterSource] = useState<Source | "all">("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeed, setModalSeed] = useState<string>("");
  const lastSavedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── hydrate ──
  useEffect(() => {
    const local = readLS();
    if (local) { setIdeas(local.ideas); setHydrated(true); }
    (async () => {
      try {
        const r = await fetch("/api/db?table=" + DB_TABLE + "&id=" + DB_ID);
        const res = await r.json();
        const remote: IdeasEnvelope | null = res?.data?.data || null;
        if (remote && Array.isArray(remote.ideas)) {
          const env: IdeasEnvelope = { ideas: remote.ideas.map(migrate), updatedAt: remote.updatedAt || 0 };
          if (!local || env.updatedAt > local.updatedAt) {
            setIdeas(env.ideas);
            writeLS(env);
          }
        }
      } catch { /* offline */ }
      setHydrated(true);
    })();
  }, []);

  // ── persist ──
  useEffect(() => {
    if (!hydrated) return;
    const env: IdeasEnvelope = { ideas, updatedAt: Date.now() };
    writeLS(env);
    const serial = JSON.stringify(ideas);
    if (serial === lastSavedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSavedRef.current = serial;
      fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: DB_TABLE,
          data: { id: DB_ID, name: "IntelligenceSUITE Ideas", type: DB_TYPE, data: env, updated_at: new Date(env.updatedAt).toISOString() },
        }),
      }).catch(() => { /* fail-quiet */ });
    }, 900);
  }, [ideas, hydrated]);

  // ── radar / signal → seed generation ──
  useEffect(() => {
    function onSeed(e: Event) {
      const detail = (e as CustomEvent).detail as { topic?: string; name?: string; title?: string };
      const topic = detail?.topic || detail?.title || detail?.name || "";
      if (!topic) return;
      setModalSeed(topic);
      setModalOpen(true);
    }
    window.addEventListener("is-radar-to-ideation", onSeed as EventListener);
    return () => window.removeEventListener("is-radar-to-ideation", onSeed as EventListener);
  }, []);

  // ── derived ──
  const tagCloud = useMemo(() => {
    const map = new Map<string, number>();
    ideas.forEach(i => i.tags.forEach(t => map.set(t, (map.get(t) || 0) + 1)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [ideas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas
      .filter(i => filterStatus === "all" || i.status === filterStatus)
      .filter(i => filterSource === "all" || i.source === filterSource)
      .filter(i => !activeTag || i.tags.includes(activeTag))
      .filter(i => !q || i.title.toLowerCase().includes(q) || i.hook.toLowerCase().includes(q) || i.body.toLowerCase().includes(q) || i.tags.some(t => t.includes(q)))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [ideas, filterStatus, filterSource, activeTag, query]);

  const active = useMemo(() => ideas.find(i => i.id === activeId) || null, [ideas, activeId]);

  const counts = useMemo(() => {
    const c = { all: ideas.length, backlog: 0, developing: 0, ready: 0, shipped: 0 };
    ideas.forEach(i => { c[i.status]++; });
    return c;
  }, [ideas]);

  // ── mutations ──
  function addIdeas(next: Idea[]) {
    setIdeas(prev => [...next, ...prev]);
  }

  function updateIdea(id: string, patch: Partial<Idea>) {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i));
  }

  function deleteIdea(id: string) {
    setIdeas(prev => prev.filter(i => i.id !== id));
    if (activeId === id) setActiveId(null);
    showToast("Idea deleted.", "info");
  }

  function newBlank() {
    const now = Date.now();
    const i: Idea = {
      id: uid("idea"), title: "New idea", hook: "", body: "", status: "backlog",
      source: "manual", tags: [], pinned: false, createdAt: now, updatedAt: now,
    };
    setIdeas(prev => [i, ...prev]);
    setActiveId(i.id);
  }

  // ── render ──
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 360px", gap: 14, height: "calc(100vh - 220px)", minHeight: 560, fontFamily: ft, color: D.tx }}>

      {/* ─── LEFT ─── */}
      <aside style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, padding: 14, overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={() => { setModalSeed(""); setModalOpen(true); }} style={{
          padding: "10px 12px", background: D.amber, color: "#060608", border: "none", borderRadius: 8,
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          boxShadow: "0 0 28px " + D.amber + "44",
        }}><Wand2 size={13} strokeWidth={2.2} /> Generate</button>
        <button onClick={newBlank} style={{
          padding: "8px 12px", background: "transparent", color: D.tx, border: "1px solid " + D.border, borderRadius: 8,
          fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><Plus size={12} strokeWidth={2.2} /> Blank idea</button>

        <div style={{ position: "relative" }}>
          <Search size={13} strokeWidth={1.8} color={D.txd} style={{ position: "absolute", left: 10, top: 9 }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search ideas…"
            style={{ width: "100%", padding: "7px 10px 7px 28px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <SidebarHeader>Status</SidebarHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FilterRow label="All" count={counts.all} active={filterStatus === "all"} onClick={() => setFilterStatus("all")} dot={D.txm} />
            {STATUSES.map(s => (
              <FilterRow key={s.id} label={s.label} count={counts[s.id]} active={filterStatus === s.id} onClick={() => setFilterStatus(s.id)} dot={s.color} />
            ))}
          </div>
        </div>

        <div>
          <SidebarHeader>Source</SidebarHeader>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <PillFilter label="All" active={filterSource === "all"} onClick={() => setFilterSource("all")} />
            {SOURCES.map(s => (
              <PillFilter key={s.id} label={s.label} active={filterSource === s.id} onClick={() => setFilterSource(s.id)} />
            ))}
          </div>
        </div>

        {tagCloud.length > 0 && (
          <div>
            <SidebarHeader>Tags</SidebarHeader>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {tagCloud.map(([t, count]) => (
                <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)} style={{
                  padding: "3px 8px", borderRadius: 999,
                  background: activeTag === t ? D.violet + "22" : "rgba(255,255,255,0.04)",
                  border: "1px solid " + (activeTag === t ? D.violet + "55" : D.border),
                  color: activeTag === t ? D.violet : D.txm,
                  fontFamily: mn, fontSize: 10, fontWeight: 600, cursor: "pointer",
                }}>#{t} <span style={{ opacity: 0.55 }}>{count}</span></button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ─── CENTER ─── */}
      <main style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 10 }}>
          <Filter size={13} strokeWidth={1.8} color={D.txd} />
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 1.4, textTransform: "uppercase" }}>{filtered.length} idea{filtered.length === 1 ? "" : "s"}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: D.surface, padding: 3, borderRadius: 8, border: "1px solid " + D.border }}>
            <button onClick={() => setView("cards")} title="Cards view" style={{
              padding: "5px 9px", background: view === "cards" ? D.amber + "1F" : "transparent", border: "none", borderRadius: 5,
              color: view === "cards" ? D.amber : D.txm, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
            }}><LayoutGrid size={11} strokeWidth={1.8} /> Cards</button>
            <button onClick={() => setView("kanban")} title="Kanban view" style={{
              padding: "5px 9px", background: view === "kanban" ? D.amber + "1F" : "transparent", border: "none", borderRadius: 5,
              color: view === "kanban" ? D.amber : D.txm, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
            }}><Columns3 size={11} strokeWidth={1.8} /> Kanban</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
          {filtered.length === 0 ? (
            <EmptyBoard onGenerate={() => { setModalSeed(""); setModalOpen(true); }} onBlank={newBlank} hasFilter={query !== "" || filterStatus !== "all" || filterSource !== "all" || activeTag !== null} />
          ) : view === "cards" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {filtered.map(i => (
                <IdeaCard key={i.id} idea={i} active={i.id === activeId} onSelect={() => setActiveId(i.id)} onPin={() => updateIdea(i.id, { pinned: !i.pinned })} onStatus={(s) => updateIdea(i.id, { status: s })} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, minHeight: "100%" }}>
              {STATUSES.map(s => {
                const col = filtered.filter(i => i.status === s.id);
                return (
                  <div key={s.id} style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                      <span style={{ fontFamily: mn, fontSize: 10, color: D.tx, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" }}>{s.label}</span>
                      <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{col.length}</span>
                    </div>
                    {col.length === 0 ? (
                      <div style={{ fontFamily: ft, fontSize: 11, color: D.txd, textAlign: "center", padding: "16px 4px" }}>—</div>
                    ) : col.map(i => (
                      <KanbanCard key={i.id} idea={i} active={i.id === activeId} onSelect={() => setActiveId(i.id)} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ─── RIGHT ─── */}
      <aside style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {active ? (
          <IdeaDetail
            idea={active}
            onChange={(patch) => updateIdea(active.id, patch)}
            onDelete={() => deleteIdea(active.id)}
            onClose={() => setActiveId(null)}
            onDevelop={async () => {
              try {
                const r = await fetch("/api/generate", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    system: "You are expanding a SemiAnalysis content idea into an outline. Reply with JSON shape: { hook: string, outline: string[5..8 bullets], keyPoints: string[3..5 punchy lines] }. No markdown wrapper.",
                    user: "Idea: " + active.title + "\n\nContext: " + (active.body || active.hook || ""),
                  }),
                });
                const j = await r.json();
                const text = String(j.text || j.completion || "").trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
                const parsed = JSON.parse(text);
                const outline: string[] = Array.isArray(parsed.outline) ? parsed.outline.filter((x: unknown) => typeof x === "string") : [];
                const newHook = typeof parsed.hook === "string" ? parsed.hook : active.hook;
                const points: string[] = Array.isArray(parsed.keyPoints) ? parsed.keyPoints.filter((x: unknown) => typeof x === "string") : [];
                const composed = points.length > 0 ? (active.body ? active.body + "\n\nKey points:\n" + points.map(p => "- " + p).join("\n") : "Key points:\n" + points.map(p => "- " + p).join("\n")) : active.body;
                updateIdea(active.id, { hook: newHook, body: composed, outline: outline, status: active.status === "backlog" ? "developing" : active.status });
                showToast("Developed.", "success");
              } catch (e) {
                showToast("Develop failed: " + String(e).slice(0, 80), "error");
              }
            }}
          />
        ) : (
          <InspirationFeed onSeed={(topic) => { setModalSeed(topic); setModalOpen(true); }} />
        )}
      </aside>

      {/* ─── MODAL ─── */}
      {modalOpen && (
        <GenerateModal
          seed={modalSeed}
          onClose={() => setModalOpen(false)}
          onIdeas={(generated) => { addIdeas(generated); setModalOpen(false); showToast("Generated " + generated.length + " idea" + (generated.length === 1 ? "" : "s") + ".", "success"); }}
        />
      )}
    </div>
  );
}

// ─── sidebar helpers ────────────────────────────────────────────────
function SidebarHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>{children}</div>;
}

function FilterRow({ label, count, active, onClick, dot }: { label: string; count: number; active: boolean; onClick: () => void; dot: string }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px", borderRadius: 6,
      background: active ? D.amber + "12" : "transparent",
      border: "1px solid " + (active ? D.amber + "44" : "transparent"),
      color: active ? D.amber : D.tx, fontFamily: ft, fontSize: 12.5, cursor: "pointer", textAlign: "left",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{count}</span>
    </button>
  );
}

function PillFilter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 9px", borderRadius: 999,
      background: active ? D.amber + "22" : "rgba(255,255,255,0.04)",
      border: "1px solid " + (active ? D.amber + "55" : D.border),
      color: active ? D.amber : D.txm,
      fontFamily: mn, fontSize: 10, fontWeight: 700, cursor: "pointer",
    }}>{label}</button>
  );
}

// ─── idea card ──────────────────────────────────────────────────────
function IdeaCard({ idea, active, onSelect, onPin, onStatus }: { idea: Idea; active: boolean; onSelect: () => void; onPin: () => void; onStatus: (s: Status) => void }) {
  const sourceMeta = SOURCES.find(s => s.id === idea.source);
  const SourceIcon = sourceMeta ? sourceMeta.Icon : Sparkles;
  return (
    <div onClick={onSelect} style={{
      background: D.surface,
      border: "1px solid " + (active ? D.amber + "66" : D.border),
      borderRadius: 12, padding: 16, cursor: "pointer",
      transition: "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
      boxShadow: active ? "0 0 24px " + D.amber + "22" : "none",
      display: "flex", flexDirection: "column", gap: 10,
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = D.amber + "44"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "translateY(0)"; } }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span title={idea.status} onClick={(e) => { e.stopPropagation(); const order: Status[] = ["backlog", "developing", "ready", "shipped"]; const next = order[(order.indexOf(idea.status) + 1) % order.length]; onStatus(next); }} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 7px", borderRadius: 999,
          background: statusColor(idea.status) + "1A",
          border: "1px solid " + statusColor(idea.status) + "55",
          color: statusColor(idea.status),
          fontFamily: mn, fontSize: 8.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
        }}>{idea.status}</span>
        <SourceIcon size={11} strokeWidth={1.8} color={D.txd} />
        {idea.format && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.8 }}>· {idea.format}</span>}
        <button onClick={(e) => { e.stopPropagation(); onPin(); }} title={idea.pinned ? "Unpin" : "Pin"} style={{
          marginLeft: "auto", background: "transparent", border: "none", color: idea.pinned ? D.amber : D.txd, cursor: "pointer", padding: 0, display: "inline-flex",
        }}>{idea.pinned ? <Pin size={12} strokeWidth={2} /> : <PinOff size={12} strokeWidth={1.5} />}</button>
      </div>
      <div style={{ fontFamily: gf, fontSize: 17, fontWeight: 700, color: D.tx, letterSpacing: -0.2, lineHeight: 1.3 }}>{idea.title}</div>
      {idea.hook && <div style={{ fontFamily: ft, fontSize: 12.5, color: D.txm, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.hook}</div>}
      {idea.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: -2 }}>
          {idea.tags.slice(0, 4).map(t => (
            <span key={t} style={{ fontFamily: mn, fontSize: 9, color: D.violet, background: D.violet + "10", padding: "2px 6px", borderRadius: 999 }}>#{t}</span>
          ))}
        </div>
      )}
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.6 }}>{relativeTime(idea.updatedAt)}{idea.basedOn ? " · from " + idea.basedOn.slice(0, 28) : ""}</div>
    </div>
  );
}

function KanbanCard({ idea, active, onSelect }: { idea: Idea; active: boolean; onSelect: () => void }) {
  return (
    <div onClick={onSelect} style={{
      background: D.card, border: "1px solid " + (active ? D.amber + "55" : D.border), borderRadius: 8, padding: "10px 12px", cursor: "pointer",
      transition: "border-color 0.12s ease",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = D.amber + "33"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = D.border; }}
    >
      <div style={{ fontFamily: ft, fontSize: 12.5, fontWeight: 700, color: D.tx, marginBottom: 4, lineHeight: 1.3 }}>{idea.title}</div>
      {idea.hook && <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 6 }}>{idea.hook}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: mn, fontSize: 9, color: D.txd }}>
        {idea.pinned && <Pin size={9} strokeWidth={2} color={D.amber} />}
        {idea.format ? <span>{idea.format}</span> : null}
      </div>
    </div>
  );
}

// ─── empty board ────────────────────────────────────────────────────
function EmptyBoard({ onGenerate, onBlank, hasFilter }: { onGenerate: () => void; onBlank: () => void; hasFilter: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: 32, textAlign: "center" }}>
      <Lightbulb size={56} strokeWidth={1.4} color={D.amber} style={{ opacity: 0.45 }} />
      <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.3 }}>{hasFilter ? "Nothing matches that filter." : "Your idea board is empty."}</div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, maxWidth: 380, lineHeight: 1.5 }}>{hasFilter ? "Loosen a filter, or generate fresh angles right now." : "Generate with AI, drop in a blank, or click any topic in the Inspiration Feed →"}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onGenerate} style={{
          padding: "10px 16px", background: D.amber, color: "#060608", border: "none", borderRadius: 8,
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}><Wand2 size={13} /> Generate</button>
        <button onClick={onBlank} style={{
          padding: "10px 16px", background: "transparent", color: D.tx, border: "1px solid " + D.border, borderRadius: 8,
          fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}><Plus size={13} /> Blank</button>
      </div>
    </div>
  );
}

// ─── idea detail (right side editor) ────────────────────────────────
function IdeaDetail({ idea, onChange, onDelete, onClose, onDevelop }: { idea: Idea; onChange: (p: Partial<Idea>) => void; onDelete: () => void; onClose: () => void; onDevelop: () => Promise<void> | void }) {
  const [developing, setDeveloping] = useState(false);

  function handleDevelop() {
    setDeveloping(true);
    Promise.resolve(onDevelop()).finally(() => setDeveloping(false));
  }

  return (
    <>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 8 }}>
        <select value={idea.status} onChange={e => onChange({ status: e.target.value as Status })} style={{
          background: statusColor(idea.status) + "1A", border: "1px solid " + statusColor(idea.status) + "55", borderRadius: 6, color: statusColor(idea.status),
          fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: "4px 8px", cursor: "pointer", outline: "none", textTransform: "uppercase",
        }}>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button onClick={() => onChange({ pinned: !idea.pinned })} title={idea.pinned ? "Unpin" : "Pin"} style={{ marginLeft: "auto", background: "transparent", border: "none", color: idea.pinned ? D.amber : D.txd, cursor: "pointer", display: "inline-flex" }}>
          {idea.pinned ? <Pin size={14} strokeWidth={2} /> : <PinOff size={14} strokeWidth={1.5} />}
        </button>
        <button onClick={() => { copyText(idea.title + "\n\n" + idea.hook + "\n\n" + idea.body); showToast("Copied.", "success"); }} title="Copy" style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer" }}>
          <Send size={14} strokeWidth={1.8} style={{ transform: "rotate(-45deg)" }} />
        </button>
        <button onClick={onDelete} title="Delete" style={{ background: "transparent", border: "none", color: D.coral, cursor: "pointer" }}>
          <Trash2 size={14} strokeWidth={1.8} />
        </button>
        <button onClick={onClose} title="Close" style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer" }}>
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <input value={idea.title} onChange={e => onChange({ title: e.target.value })} placeholder="Idea title" style={{
          width: "100%", background: "transparent", border: "none", outline: "none",
          color: D.tx, fontFamily: gf, fontSize: 22, fontWeight: 800, letterSpacing: -0.4, padding: 0,
        }} />

        {idea.basedOn && <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1, textTransform: "uppercase" }}>Based on: <span style={{ color: D.txm, textTransform: "none", letterSpacing: 0 }}>{idea.basedOn}</span></div>}

        <FieldLabel>Hook</FieldLabel>
        <input value={idea.hook} onChange={e => onChange({ hook: e.target.value })} placeholder="One-line opener…" style={{
          width: "100%", padding: "8px 10px", background: D.surface, border: "1px solid " + D.border, borderRadius: 6,
          color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box",
        }} />

        <FieldLabel>Angle / body</FieldLabel>
        <textarea value={idea.body} onChange={e => onChange({ body: e.target.value })} placeholder="Why does this idea matter? What's the angle?" style={{
          width: "100%", minHeight: 120, padding: "8px 10px", background: D.surface, border: "1px solid " + D.border, borderRadius: 6,
          color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.55,
        }} />

        {idea.outline && idea.outline.length > 0 && (
          <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 8, padding: "10px 12px" }}>
            <FieldLabel>Outline</FieldLabel>
            <ul style={{ margin: 0, paddingLeft: 18, color: D.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.6 }}>
              {idea.outline.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {idea.format && <Chip label={idea.format} accent={D.cyan} />}
          {idea.audience && <Chip label={idea.audience} accent={D.violet} />}
          {idea.tags.map(t => <Chip key={t} label={"#" + t} accent={D.violet} />)}
        </div>

        <button onClick={handleDevelop} disabled={developing} style={{
          padding: "10px 14px", background: developing ? D.amber + "22" : D.amber, color: developing ? D.amber : "#060608", border: "none", borderRadius: 8,
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", cursor: developing ? "wait" : "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {developing ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} strokeWidth={2.2} />}
          {developing ? "Developing…" : "Develop with AI"}
        </button>
        <style>{`@keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } } .spin { animation: spin 1.2s linear infinite; }`}</style>

        <FieldLabel>Send this idea to…</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <SendToChip text={idea.title + "\n\n" + idea.hook + "\n\n" + idea.body} sourceTool="ideation-board" kind="idea" />
        </div>
      </div>
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.6, textTransform: "uppercase" }}>{children}</div>;
}

function Chip({ label, accent }: { label: string; accent: string }) {
  return <span style={{ padding: "3px 9px", borderRadius: 999, background: accent + "14", border: "1px solid " + accent + "44", color: accent, fontFamily: mn, fontSize: 10, fontWeight: 600 }}>{label}</span>;
}

// ─── inspiration feed (right side when no idea selected) ────────────
interface FeedItem { title: string; source?: string; link?: string; date?: string }

function InspirationFeed({ onSeed }: { onSeed: (topic: string) => void }) {
  const [tab, setTab] = useState<"trends" | "news">("trends");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = tab === "trends" ? "/api/trends-feed" : "/api/news";
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        let raw: unknown[] = [];
        if (Array.isArray(d?.items)) raw = d.items;
        else if (Array.isArray(d?.trends)) raw = d.trends;
        else if (Array.isArray(d?.google)) raw = d.google;
        const norm: FeedItem[] = raw.slice(0, 30).map((r) => {
          const o = r as Record<string, unknown>;
          return {
            title: String(o.title || o.topic || o.term || o.name || ""),
            source: typeof o.source === "string" ? o.source : (typeof o.feed === "string" ? o.feed as string : undefined),
            link: typeof o.link === "string" ? o.link : (typeof o.url === "string" ? o.url as string : undefined),
            date: typeof o.date === "string" ? o.date : (typeof o.publishedAt === "string" ? o.publishedAt as string : undefined),
          };
        }).filter(x => x.title);
        setItems(norm);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  return (
    <>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>Inspiration</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: D.surface, padding: 3, borderRadius: 7, border: "1px solid " + D.border }}>
          <button onClick={() => setTab("trends")} style={{
            padding: "4px 9px", background: tab === "trends" ? D.amber + "1F" : "transparent", border: "none", borderRadius: 4,
            color: tab === "trends" ? D.amber : D.txm, cursor: "pointer", fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
          }}>Trends</button>
          <button onClick={() => setTab("news")} style={{
            padding: "4px 9px", background: tab === "news" ? D.amber + "1F" : "transparent", border: "none", borderRadius: 4,
            color: tab === "news" ? D.amber : D.txm, cursor: "pointer", fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
          }}>News</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.4 }}>LOADING…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", fontFamily: ft, fontSize: 12.5, color: D.txm }}>Feed quiet. Try the other tab.</div>
        ) : items.map((it, i) => (
          <button key={i} onClick={() => onSeed(it.title)} style={{
            display: "block", width: "100%", textAlign: "left", background: "transparent",
            border: "none", borderBottom: "1px solid " + D.border, padding: "10px 16px", cursor: "pointer",
            transition: "background 0.12s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = D.amber + "08"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              {it.source && <span style={{ fontFamily: mn, fontSize: 9, color: D.cyan, letterSpacing: 0.6, textTransform: "uppercase" }}>{it.source}</span>}
              <ArrowRight size={10} strokeWidth={2} color={D.amber} style={{ marginLeft: "auto" }} />
            </div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.4 }}>{it.title}</div>
          </button>
        ))}
      </div>
    </>
  );
}

// ─── generate modal ─────────────────────────────────────────────────
type ModalMode = "quick" | "signal" | "wizard";

function GenerateModal({ seed, onClose, onIdeas }: { seed: string; onClose: () => void; onIdeas: (g: Idea[]) => void }) {
  const [mode, setMode] = useState<ModalMode>(seed ? "signal" : "quick");
  const [prompt, setPrompt] = useState(seed);
  const [signal, setSignal] = useState(seed);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<string | null>(null);
  const [audience, setAudience] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [length, setLength] = useState<string | null>(null);

  useEffect(() => { setPrompt(seed); setSignal(seed); }, [seed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function generate(args: { topic: string; format?: string; audience?: string; tone?: string; length?: string; source: Source; basedOn?: string }) {
    setRunning(true);
    try {
      const sys = "You are SemiAnalysis's editorial brain. Given a topic, return 8-10 sharp, ship-ready content angles with hooks. JSON shape only: { ideas: Array<{ title: string, hook: string, body: string, format?: string, tags: string[] }> }. Brand voice: direct, technical, contrarian, no fluff, no em dashes. No markdown wrapper.";
      const user =
        "Topic: " + args.topic + "\n" +
        (args.format ? "Format constraint: " + args.format + "\n" : "") +
        (args.audience ? "Audience: " + args.audience + "\n" : "") +
        (args.tone ? "Tone: " + args.tone + "\n" : "") +
        (args.length ? "Length: " + args.length + "\n" : "");
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: sys, user }),
      });
      const j = await r.json();
      const text = String(j.text || j.completion || "").trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
      const now = Date.now();
      const generated: Idea[] = list.slice(0, 12).map((raw: unknown, i: number) => {
        const o = raw as Record<string, unknown>;
        return {
          id: uid("idea"),
          title: typeof o.title === "string" ? o.title : "Untitled idea",
          hook: typeof o.hook === "string" ? o.hook : "",
          body: typeof o.body === "string" ? o.body : "",
          status: "backlog",
          source: args.source,
          tags: Array.isArray(o.tags) ? ((o.tags as unknown[]).filter(t => typeof t === "string") as string[]) : [],
          pinned: false,
          basedOn: args.basedOn,
          format: typeof o.format === "string" ? o.format : args.format,
          audience: args.audience,
          createdAt: now + i,
          updatedAt: now + i,
        };
      });
      if (generated.length === 0) throw new Error("No ideas returned");
      onIdeas(generated);
    } catch (e) {
      showToast("Generate failed: " + String(e).slice(0, 80), "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.78)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: "100%", maxHeight: "calc(100vh - 40px)",
        background: D.card, border: "1px solid " + D.border, borderRadius: 16,
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 60px " + D.amber + "16",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 12 }}>
          <Wand2 size={18} strokeWidth={2} color={D.amber} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.2 }}>Generate Ideas</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 2 }}>
              {mode === "quick" ? "Quick prompt" : mode === "signal" ? "From signal" : "Structured wizard"}
            </div>
          </div>
          <button onClick={onClose} title="Close" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, color: D.txm, borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "inline-flex" }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Mode switcher */}
        <div style={{ padding: "12px 22px", borderBottom: "1px solid " + D.border, display: "flex", gap: 4 }}>
          {(["quick", "signal", "wizard"] as ModalMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "7px 12px", borderRadius: 6,
              background: mode === m ? D.amber + "1F" : "transparent",
              border: "1px solid " + (mode === m ? D.amber + "55" : D.border),
              color: mode === m ? D.amber : D.txm,
              fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
            }}>{m === "quick" ? "Quick" : m === "signal" ? "From signal" : "Wizard"}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "quick" && (
            <>
              <FieldLabel>What do you want ideas about?</FieldLabel>
              <textarea autoFocus value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. Blackwell allocations, HBM4 supply, TSMC N2 yield, hyperscaler capex cycles…" style={{
                width: "100%", minHeight: 110, padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8,
                color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", resize: "vertical", lineHeight: 1.55, boxSizing: "border-box",
              }} />
              <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.5 }}>10 ideas · brand voice · ~6s</div>
            </>
          )}

          {mode === "signal" && (
            <>
              <FieldLabel>Signal · trend · headline</FieldLabel>
              <input autoFocus value={signal} onChange={e => setSignal(e.target.value)} placeholder="Paste a trend, news headline, or topic to seed generations" style={{
                width: "100%", padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8,
                color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box",
              }} />
              <FieldLabel>Optional format hint</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <PickChip label="Any" active={!format} onClick={() => setFormat(null)} />
                {CONTENT_TYPES.map(c => <PickChip key={c} label={c} active={format === c} onClick={() => setFormat(c)} />)}
              </div>
            </>
          )}

          {mode === "wizard" && (
            <>
              <ProgressBar step={step} steps={4} />
              {step === 0 && (
                <WizardStep title="Content type" eyebrow={"Step 1 of 4"} options={CONTENT_TYPES} selected={format} onSelect={setFormat} />
              )}
              {step === 1 && (
                <WizardStep title="Audience" eyebrow={"Step 2 of 4"} options={AUDIENCES} selected={audience} onSelect={setAudience} />
              )}
              {step === 2 && (
                <WizardStep title="Tone" eyebrow={"Step 3 of 4"} options={TONES} selected={tone} onSelect={setTone} />
              )}
              {step === 3 && (
                <>
                  <WizardStep title="Length" eyebrow={"Step 4 of 4"} options={LENGTHS} selected={length} onSelect={setLength} />
                  <FieldLabel>Topic (optional)</FieldLabel>
                  <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. CoWoS capacity in 2026…" style={{
                    width: "100%", padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8,
                    color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box",
                  }} />
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 8 }}>
          {mode === "wizard" && step > 0 && (
            <button onClick={() => setStep(s => s - 1)} disabled={running} style={{
              padding: "8px 14px", background: "transparent", color: D.txm, border: "1px solid " + D.border, borderRadius: 7,
              fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer",
            }}>Back</button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={onClose} disabled={running} style={{
              padding: "8px 14px", background: "transparent", color: D.txm, border: "1px solid " + D.border, borderRadius: 7,
              fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer",
            }}>Cancel</button>
            {mode === "wizard" && step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={(step === 0 && !format)} style={{
                padding: "10px 18px",
                background: (step === 0 && !format) ? "rgba(247,176,65,0.18)" : D.amber,
                color: (step === 0 && !format) ? D.txd : "#060608",
                border: "none", borderRadius: 7,
                fontFamily: mn, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
                cursor: (step === 0 && !format) ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>Next <ArrowRight size={12} strokeWidth={2.2} /></button>
            ) : (
              <button
                onClick={() => {
                  if (mode === "quick") generate({ topic: prompt, source: "ai" });
                  else if (mode === "signal") generate({ topic: signal, format: format || undefined, source: "signal", basedOn: signal });
                  else generate({ topic: prompt || (format ? "ideas for " + format.toLowerCase() : "SemiAnalysis"), format: format || undefined, audience: audience || undefined, tone: tone || undefined, length: length || undefined, source: "ai" });
                }}
                disabled={running || (mode === "quick" && !prompt.trim()) || (mode === "signal" && !signal.trim())}
                style={{
                  padding: "10px 18px",
                  background: running ? D.amber + "22" : D.amber, color: running ? D.amber : "#060608",
                  border: "none", borderRadius: 7,
                  fontFamily: mn, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
                  cursor: running ? "wait" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  opacity: ((mode === "quick" && !prompt.trim()) || (mode === "signal" && !signal.trim())) && !running ? 0.5 : 1,
                }}>
                {running ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} strokeWidth={2.2} />}
                {running ? "Generating…" : "Generate"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ step, steps }: { step: number; steps: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: steps }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? D.amber : "rgba(255,255,255,0.08)", transition: "background 0.2s ease" }} />
      ))}
    </div>
  );
}

function WizardStep({ title, eyebrow, options, selected, onSelect }: { title: string; eyebrow: string; options: string[]; selected: string | null; onSelect: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>{eyebrow}</div>
      <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 14, letterSpacing: -0.2 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {options.map(o => (
          <button key={o} onClick={() => onSelect(o)} style={{
            padding: "12px 14px", borderRadius: 8, textAlign: "left", cursor: "pointer",
            background: selected === o ? D.amber + "1A" : D.surface,
            border: "1px solid " + (selected === o ? D.amber + "66" : D.border),
            color: D.tx, fontFamily: ft, fontSize: 13.5, fontWeight: 600,
            transition: "background 0.15s ease, border-color 0.15s ease",
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function PickChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 11px", borderRadius: 999,
      background: active ? D.amber + "1F" : "rgba(255,255,255,0.04)",
      border: "1px solid " + (active ? D.amber + "55" : D.border),
      color: active ? D.amber : D.txm,
      fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer",
    }}>{label}</button>
  );
}
