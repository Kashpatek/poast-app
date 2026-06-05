"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { FilePen, Sparkles, Captions, ShieldCheck, Recycle, Send, MessageSquareQuote, Newspaper, Tags, Search, ArrowRight, Trash2, RotateCcw, Plus } from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";
import { CopyShell, COPY_GRADIENT, COPY_SOLID, COPY_GLOW } from "./shell";
import { listDrafts, softDelete, restoreDraft, type DraftRecord } from "./draft-store";

// ─── Cards ─────────────────────────────────────────────────────────
type Section = "WRITE" | "SHIP";
interface ToolCard {
  id: string;
  label: string;
  sub: string;
  Icon: typeof FilePen;
  href: string;
  section: Section;
  cmd: string;
  external?: boolean;
}

const TOOLS: ToolCard[] = [
  { id: "draft",       label: "Draft",                sub: "Long-form writer with slash + AI assists", Icon: FilePen,           href: "/copy-studio/draft",       section: "WRITE", cmd: "draft" },
  { id: "headline",    label: "Headline / Hook",      sub: "Doctor your opener, A/B variants",         Icon: Sparkles,          href: "/copy-studio/headline",    section: "WRITE", cmd: "headline" },
  { id: "voice",       label: "Brand Voice Gate",     sub: "0-10 SA-on-brand score with rubric",       Icon: ShieldCheck,       href: "/copy-studio/voice",       section: "WRITE", cmd: "voice" },
  { id: "captions",    label: "Captions",             sub: "Per-platform captions via Capper",         Icon: Captions,          href: "/copy-studio/captions",    section: "WRITE", cmd: "captions" },
  { id: "repurpose",   label: "Repurpose Engine",     sub: "One draft → thread / post / caption pack", Icon: Recycle,           href: "/copy-studio/repurpose",   section: "WRITE", cmd: "repurpose" },
  { id: "launch",      label: "Multi-Platform Launch",sub: "Distribution Pack composer + Buffer",      Icon: Send,              href: "/copy-studio/launch",      section: "SHIP",  cmd: "launch" },
  { id: "thread",      label: "Thread Builder",       sub: "Segment, reorder, ship as a thread",       Icon: MessageSquareQuote,href: "/copy-studio/thread",      section: "SHIP",  cmd: "thread" },
  { id: "newsletter",  label: "Newsletter Composer",  sub: "Sectioned editor → MDX → docx / html",     Icon: Newspaper,         href: "/copy-studio/newsletter",  section: "SHIP",  cmd: "newsletter" },
  { id: "seo",         label: "SEO / Metadata",       sub: "Title, meta, OG, Twitter card, JSON-LD",   Icon: Tags,              href: "/copy-studio/seo",         section: "SHIP",  cmd: "seo" },
];

// ─── Page ──────────────────────────────────────────────────────────
export default function CopyStudioPage() {
  const [ok, setOk] = useState(false);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch {}
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  useEffect(() => {
    if (!ok) return;
    refreshDrafts();
  }, [ok, showDeleted]);

  async function refreshDrafts() {
    const all = await listDrafts({ includeDeleted: showDeleted });
    setDrafts(all);
  }

  if (!ok) return null;

  return (
    <CopyShell>
      <Hero />
      <CommandPalette tools={TOOLS} onRoute={(href) => router.push(href)} />

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 28px 48px" }}>
        <ToolSection title="WRITE" emoji="✍️" tools={TOOLS.filter(t => t.section === "WRITE")} />
        <div style={{ height: 36 }} />
        <ToolSection title="SHIP" emoji="🚀" tools={TOOLS.filter(t => t.section === "SHIP")} />

        <RecentDraftsStrip
          drafts={drafts}
          showDeleted={showDeleted}
          onToggleDeleted={() => setShowDeleted(s => !s)}
          onSoftDelete={async (id) => { await softDelete(id); await refreshDrafts(); }}
          onRestore={async (id) => { await restoreDraft(id); await refreshDrafts(); }}
        />
      </div>
    </CopyShell>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────
function Hero() {
  return (
    <div style={{ position: "relative", padding: "56px 28px 36px", overflow: "hidden" }}>
      {/* Animated mesh glow · CSS-only conic + linear stack */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background:
          "radial-gradient(ellipse 60% 50% at 18% 10%, rgba(247,176,65,0.22) 0%, transparent 60%)," +
          "radial-gradient(ellipse 55% 60% at 80% 20%, rgba(162,75,201,0.18) 0%, transparent 60%)," +
          "radial-gradient(ellipse 70% 50% at 50% 90%, rgba(224,85,107,0.16) 0%, transparent 60%)",
        animation: "copyMeshDrift 18s ease-in-out infinite alternate",
      }} />
      <style>{`@keyframes copyMeshDrift { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-2%, 2%, 0); } }`}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ fontFamily: mn, fontSize: 10.5, color: COPY_SOLID, letterSpacing: 4, textTransform: "uppercase", marginBottom: 18, fontWeight: 800 }}>
          The Words
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: gf, fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 900,
          letterSpacing: -1.5, lineHeight: 1.04,
          background: COPY_GRADIENT,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          maxWidth: 980,
        }}>Write it once. Ship it everywhere.</h1>
        <div style={{ fontFamily: ft, fontSize: 16, color: D.txm, marginTop: 16, maxWidth: 720, lineHeight: 1.55 }}>
          Brief to draft, headline to hook, voice-graded and packed for every platform — the whole writing desk in one shell.
        </div>
      </div>
    </div>
  );
}

// ─── Command palette ──────────────────────────────────────────────
function CommandPalette({ tools, onRoute }: { tools: ToolCard[]; onRoute: (href: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function go(href: string) { setOpen(false); setValue(""); onRoute(href); }

  // Bare prompt slot (always visible). Click → expand into the cmdk popover.
  return (
    <div style={{ position: "relative", zIndex: 3, padding: "0 28px", maxWidth: 1240, margin: "0 auto" }}>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%", padding: "14px 18px",
          background: "rgba(13,13,18,0.78)",
          border: "1px solid " + D.border,
          borderRadius: 12, color: D.txm, textAlign: "left", cursor: "text",
          display: "flex", alignItems: "center", gap: 10,
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = COPY_SOLID + "55"; e.currentTarget.style.boxShadow = "0 0 26px " + COPY_GLOW; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.boxShadow = "none"; }}
      >
        <Search size={16} strokeWidth={1.6} color={COPY_SOLID} />
        <span style={{ fontFamily: ft, fontSize: 14 }}>Search anything · "X thread on TSMC capex", "voice check this draft"…</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, padding: "2px 6px", borderRadius: 4, border: "1px solid " + D.border }}>⌘</span>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, padding: "2px 6px", borderRadius: 4, border: "1px solid " + D.border }}>K</span>
        </span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(6,6,12,0.78)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 16px 16px",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 640, maxWidth: "100%", background: "#0D0D12",
            border: "1px solid " + D.border, borderRadius: 14,
            boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 64px " + COPY_GLOW,
            overflow: "hidden",
          }}>
            <Command label="CopySTUDIO" shouldFilter>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 10 }}>
                <Search size={15} strokeWidth={1.6} color={COPY_SOLID} />
                <Command.Input
                  autoFocus
                  value={value}
                  onValueChange={setValue}
                  placeholder="Type a module or describe a draft…"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 15 }}
                />
                <kbd style={{ fontFamily: mn, fontSize: 10, color: D.txd, padding: "2px 6px", borderRadius: 4, border: "1px solid " + D.border }}>esc</kbd>
              </div>
              <Command.List style={{ maxHeight: 360, overflow: "auto", padding: 6 }}>
                <Command.Empty>
                  {value.trim().length > 6 ? (
                    <button onClick={() => go("/copy-studio/draft?seed=" + encodeURIComponent(value))} style={paletteRowStyle()}>
                      <Sparkles size={14} color={COPY_SOLID} strokeWidth={1.8} />
                      <span style={{ fontFamily: ft, fontSize: 13.5, color: D.tx }}>Seed a draft from “{value.slice(0, 60)}”</span>
                      <ArrowRight size={13} color={D.txd} style={{ marginLeft: "auto" }} />
                    </button>
                  ) : (
                    <div style={{ padding: 20, textAlign: "center", fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 0.5 }}>No match. Keep typing…</div>
                  )}
                </Command.Empty>
                <Command.Group heading="Modules">
                  {tools.map(t => (
                    <Command.Item key={t.id} value={t.cmd + " " + t.label + " " + t.sub} onSelect={() => go(t.href)}>
                      <PaletteRow Icon={t.Icon} label={t.label} sub={t.sub} />
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </div>
  );
}

function paletteRowStyle(): React.CSSProperties {
  return {
    width: "100%", display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", background: "transparent",
    border: "none", borderRadius: 8, cursor: "pointer", color: D.tx, textAlign: "left",
  };
}

function PaletteRow({ Icon, label, sub }: { Icon: typeof FilePen; label: string; sub: string }) {
  return (
    <div style={paletteRowStyle()}>
      <Icon size={14} color={COPY_SOLID} strokeWidth={1.8} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: ft, fontSize: 13.5, color: D.tx, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: ft, fontSize: 11.5, color: D.txm }}>{sub}</span>
      </span>
      <ArrowRight size={13} color={D.txd} />
    </div>
  );
}

// ─── Tool section ─────────────────────────────────────────────────
function ToolSection({ title, emoji, tools }: { title: string; emoji: string; tools: ToolCard[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "rgba(255,255,255,0.3)", fontFamily: mn, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <span>{title}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {tools.map(t => <ToolCardItem key={t.id} card={t} />)}
      </div>
    </div>
  );
}

function ToolCardItem({ card }: { card: ToolCard }) {
  const [hover, setHover] = useState(false);
  return (
    <Link href={card.href} style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: "#0D0D12",
          border: "1px solid " + (hover ? COPY_SOLID + "55" : "rgba(255,255,255,0.12)"),
          borderRadius: 14, padding: 20,
          transform: hover ? "translateY(-2px)" : "translateY(0)",
          boxShadow: hover ? "0 0 28px " + COPY_GLOW + ", 0 10px 30px -12px rgba(0,0,0,0.6)" : "0 2px 8px rgba(0,0,0,0.18)",
          transition: "transform 140ms ease, border-color 160ms ease, box-shadow 160ms ease",
          cursor: "pointer", color: D.tx, height: "100%",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: hover ? COPY_SOLID + "1F" : COPY_SOLID + "12",
          border: "1px solid " + COPY_SOLID + (hover ? "55" : "33"),
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <card.Icon size={18} strokeWidth={1.8} color={COPY_SOLID} />
        </div>
        <div style={{ fontFamily: gf, fontSize: 17, fontWeight: 900, color: D.tx, letterSpacing: -0.2 }}>{card.label}</div>
        <div style={{ fontFamily: ft, fontSize: 12.5, color: "#4E4B56", lineHeight: 1.4 }}>{card.sub}</div>
      </div>
    </Link>
  );
}

// ─── Recent drafts strip ──────────────────────────────────────────
function RecentDraftsStrip({ drafts, showDeleted, onToggleDeleted, onSoftDelete, onRestore }: {
  drafts: DraftRecord[];
  showDeleted: boolean;
  onToggleDeleted: () => void;
  onSoftDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}) {
  const items = useMemo(() => drafts.slice(0, 16), [drafts]);
  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "rgba(255,255,255,0.3)", fontFamily: mn, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
        <span>Recent Drafts</span>
        <button onClick={onToggleDeleted} style={{
          marginLeft: "auto", background: "transparent", border: "1px solid " + D.border, borderRadius: 6,
          color: showDeleted ? COPY_SOLID : D.txm, fontFamily: mn, fontSize: 9.5, letterSpacing: 1.4, padding: "4px 9px", cursor: "pointer",
        }}>{showDeleted ? "Hide trash" : "Show trash"}</button>
        <Link href="/copy-studio/draft" style={{
          background: COPY_SOLID, color: "#060608", borderRadius: 6, padding: "5px 10px",
          fontFamily: mn, fontSize: 10, letterSpacing: 1.4, textDecoration: "none", fontWeight: 800,
          display: "inline-flex", alignItems: "center", gap: 5,
        }}><Plus size={11} strokeWidth={2.2} /> New draft</Link>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "26px", textAlign: "center", fontFamily: ft, fontSize: 13, color: D.txm, background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 12 }}>
          No drafts yet. Pop open the Draft module and start writing — autosaves land here.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {items.map(d => (
            <RecentCard key={d.id} draft={d} onSoftDelete={onSoftDelete} onRestore={onRestore} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecentCard({ draft, onSoftDelete, onRestore }: { draft: DraftRecord; onSoftDelete: (id: string) => Promise<void>; onRestore: (id: string) => Promise<void> }) {
  const [hover, setHover] = useState(false);
  const isDeleted = !!draft.deletedAt;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#0D0D12", border: "1px solid " + (hover && !isDeleted ? COPY_SOLID + "55" : "rgba(255,255,255,0.12)"),
        borderRadius: 12, padding: 14, opacity: isDeleted ? 0.55 : 1,
        transition: "border-color 0.16s ease, transform 0.12s ease",
        transform: hover && !isDeleted ? "translateY(-1px)" : "translateY(0)",
        position: "relative", overflow: "hidden",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: COPY_SOLID, padding: "2px 7px", borderRadius: 999, background: COPY_SOLID + "12", border: "1px solid " + COPY_SOLID + "33", letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 700 }}>{draft.platform}</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginLeft: "auto" }}>{relativeTime(draft.updatedAt)}</span>
      </div>
      <Link href={"/copy-studio/draft?id=" + draft.id} style={{ textDecoration: "none" }}>
        <div style={{ fontFamily: gf, fontSize: 15, fontWeight: 700, color: D.tx, letterSpacing: -0.2, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.title || "Untitled"}</div>
      </Link>
      <div style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 30 }}>
        {(draft.bodyHTML ? stripTagsBrief(draft.bodyHTML) : "Empty draft.")}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {isDeleted ? (
          <button onClick={() => onRestore(draft.id)} style={smallActionStyle()}><RotateCcw size={10} /> Restore</button>
        ) : (
          <button onClick={async () => { if (window.confirm("Move \"" + (draft.title || "Untitled") + "\" to trash?")) await onSoftDelete(draft.id); }} style={Object.assign({}, smallActionStyle(), { color: D.coral, borderColor: D.coral + "44" })}><Trash2 size={10} /> Trash</button>
        )}
      </div>
    </div>
  );
}

function smallActionStyle(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 8px", borderRadius: 6, background: "transparent",
    border: "1px solid " + D.border, color: D.txm, cursor: "pointer",
    fontFamily: mn, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700,
  };
}

function stripTagsBrief(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
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
