"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";

// ─── Studio palette ───
// PRODUCE amber, DESIGN green, COPY coral E0556B, INTELLIGENCE violet/cyan, POAST main D.amber
var STUDIO_META: Record<string, { label: string; color: string; accent: string }> = {
  produce:      { label: "PRODUCE STUDIO",     color: D.amber,  accent: "rgba(247,176,65,0.10)" },
  design:       { label: "DESIGN STUDIO",      color: "#2EAD8E", accent: "rgba(46,173,142,0.10)" },
  copy:         { label: "COPY STUDIO",        color: "#E0556B", accent: "rgba(224,85,107,0.10)" },
  intelligence: { label: "INTELLIGENCE SUITE", color: "#905CCB", accent: "rgba(144,92,203,0.10)" },
  poast:        { label: "POAST SHELL",        color: D.amber,  accent: "rgba(247,176,65,0.10)" },
};

type StatusKind = "live" | "beta" | "wip";

var STATUS_META: Record<StatusKind, { label: string; color: string }> = {
  live: { label: "Live",   color: "#2EAD8E" },
  beta: { label: "Beta",   color: "#F7B041" },
  wip:  { label: "WIP",    color: "#D1334A" },
};

interface RouteEntry {
  id: string;
  label: string;
  path: string;
  studio: keyof typeof STUDIO_META;
  status: StatusKind;
  description: string;
}

var ROUTES: RouteEntry[] = [
  // ─── PRODUCE STUDIO ───
  { id: "prod-hub",          label: "Produce Hub",          path: "/production-studio",                    studio: "produce", status: "live", description: "Production studio hub — landing + nav for all production tools." },
  { id: "prod-brief",        label: "Brief Builder",        path: "/production-studio/brief-builder",      studio: "produce", status: "live", description: "Episode brief generator for SA Weekly pre-production." },
  { id: "prod-timeline",     label: "Timeline (OpenCut)",   path: "/production-studio/timeline",           studio: "produce", status: "live", description: "Embedded OpenCut video editor iframe." },
  { id: "prod-autocap",      label: "Auto-Caption",         path: "/production-studio/auto-caption",       studio: "produce", status: "live", description: "Whisper-style auto-caption pipeline for raw video." },
  { id: "prod-shorts",       label: "Shorts Formatter",     path: "/production-studio/shorts-formatter",   studio: "produce", status: "live", description: "Format long-form clips into 9:16 shorts with captions." },
  { id: "prod-chapters",     label: "Chapter Generator",    path: "/production-studio/chapter-generator",  studio: "produce", status: "live", description: "Auto-generate YouTube chapter markers from transcript." },
  { id: "prod-broll",        label: "B-Roll Library",       path: "/production-studio/b-roll-library",     studio: "produce", status: "live", description: "Searchable B-roll asset library for editors." },
  { id: "prod-render",       label: "Render Queue",         path: "/production-studio/render-queue",       studio: "produce", status: "live", description: "Background render job queue + progress monitor." },
  { id: "prod-kit",          label: "Episode Kit Builder",  path: "/production-studio/episode-kit-builder", studio: "produce", status: "live", description: "Bundle thumb, title, description, chapters for an episode." },
  { id: "prod-record",       label: "Recording Room",       path: "/production-studio/recording-room",     studio: "produce", status: "live", description: "Browser-based multi-track recording session." },
  { id: "prod-audio",        label: "Audio Editor",         path: "/production-studio/audio-editor",       studio: "produce", status: "live", description: "Waveform-based audio editor for podcast cuts." },
  { id: "prod-clean",        label: "Transcript Cleaner",   path: "/production-studio/transcript-cleaner", studio: "produce", status: "live", description: "Clean up auto-transcripts (filler, speakers, punctuation)." },
  { id: "prod-rss",          label: "RSS Manager",          path: "/production-studio/rss-manager",        studio: "produce", status: "live", description: "Manage podcast RSS feeds + episode publishing." },

  // ─── DESIGN STUDIO ───
  { id: "design-hub",        label: "Design Hub",           path: "/design-studio",                        studio: "design",  status: "live", description: "Design studio hub — projects + tool launcher." },
  { id: "design-canvas",     label: "Canvas Editor",        path: "/design-studio/canvas-editor",          studio: "design",  status: "live", description: "Fabric.js powered raster/vector canvas editor." },
  { id: "design-doc",        label: "Doc Editor",           path: "/design-studio/doc-editor",             studio: "design",  status: "live", description: "Tiptap rich-text editor for long-form docs." },
  { id: "design-custom",     label: "Custom Canvas",        path: "/design-studio/custom-canvas",          studio: "design",  status: "live", description: "Excalidraw-style freeform whiteboard." },

  // ─── COPY STUDIO ───
  { id: "copy-hub",          label: "Copy Hub",             path: "/copy-studio",                          studio: "copy",    status: "live", description: "Copy studio hub — all writing tools in one shell." },
  { id: "copy-draft",        label: "Draft",                path: "/copy-studio/draft",                    studio: "copy",    status: "live", description: "General-purpose AI draft surface with voice + analysis." },
  { id: "copy-headline",     label: "Headline",             path: "/copy-studio/headline",                 studio: "copy",    status: "live", description: "Headline doctor — variants, hooks, score." },
  { id: "copy-voice",        label: "Voice",                path: "/copy-studio/voice",                    studio: "copy",    status: "live", description: "Brand voice scorer + rewriter." },
  { id: "copy-captions",     label: "Captions",             path: "/copy-studio/captions",                 studio: "copy",    status: "live", description: "Per-platform caption generator." },
  { id: "copy-repurpose",    label: "Repurpose",            path: "/copy-studio/repurpose",                studio: "copy",    status: "live", description: "Repurpose a single piece across formats / platforms." },
  { id: "copy-launch",       label: "Launch",               path: "/copy-studio/launch",                   studio: "copy",    status: "live", description: "Launch-day post bundle (announcement, thread, email)." },
  { id: "copy-thread",       label: "Thread",               path: "/copy-studio/thread",                   studio: "copy",    status: "live", description: "X / LinkedIn thread builder with hook + close." },
  { id: "copy-newsletter",   label: "Newsletter",           path: "/copy-studio/newsletter",               studio: "copy",    status: "live", description: "Newsletter draft surface (intro, sections, CTA)." },
  { id: "copy-seo",          label: "SEO",                  path: "/copy-studio/seo",                      studio: "copy",    status: "live", description: "SEO title / meta / outline generator." },

  // ─── INTELLIGENCE SUITE ───
  { id: "intel-hub",         label: "Command Center",       path: "/intelligence-suite",                   studio: "intelligence", status: "live", description: "Intelligence Suite hub — full command center widget deck." },
  { id: "intel-trends",      label: "Trends",               path: "/intelligence-suite/trends",            studio: "intelligence", status: "live", description: "Story / trend radar across topics + sources." },
  { id: "intel-ideas",       label: "Ideas",                path: "/intelligence-suite/ideas",             studio: "intelligence", status: "live", description: "Ideation board — capture, score, promote ideas." },
  { id: "intel-signals",     label: "Signals",              path: "/intelligence-suite/signals",           studio: "intelligence", status: "live", description: "Real-time signal feed across watched sources." },
  { id: "intel-watch",       label: "Watchlist (Markets)",  path: "/intelligence-suite/watchlist",         studio: "intelligence", status: "live", description: "Market watchlist + alert rules." },
  { id: "intel-comp",        label: "Competitive",          path: "/intelligence-suite/competitive",       studio: "intelligence", status: "live", description: "Competitive radar — track rival publishers + outputs." },
  { id: "intel-brief",       label: "Morning Brief",        path: "/intelligence-suite/brief",             studio: "intelligence", status: "live", description: "Auto-generated morning intelligence brief." },
  { id: "intel-notes",       label: "Notes",                path: "/intelligence-suite/notes",             studio: "intelligence", status: "live", description: "Persistent research notes + tags." },

  // ─── POAST SHELL ───
  { id: "poast-root",        label: "POAST App (Shell)",    path: "/",                                     studio: "poast",   status: "live", description: "Main app shell with sidebar + dashboard." },
  { id: "poast-charts",      label: "Charts",               path: "/charts",                               studio: "poast",   status: "live", description: "POAST chart maker — standalone studio." },
  { id: "poast-assets",      label: "Asset Library",        path: "/asset-library",                        studio: "poast",   status: "live", description: "SemiAnalysis style guide + asset browser." },
  { id: "poast-board",       label: "Task Board",           path: "/board",                                studio: "poast",   status: "live", description: "Kanban-style task board for the POAST team." },
];

var STUDIO_ORDER: Array<keyof typeof STUDIO_META> = ["produce", "design", "copy", "intelligence", "poast"];

type StatusFilter = "all" | StatusKind;

export default function PoastStatusPage() {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];
  var _query = useState(""), query = _query[0], setQuery = _query[1];
  var _filter = useState<StatusFilter>("all"), filter = _filter[0], setFilter = _filter[1];
  var _hover = useState<string | null>(null), hover = _hover[0], setHover = _hover[1];

  useEffect(function() {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  var filtered = useMemo(function() {
    var q = query.trim().toLowerCase();
    return ROUTES.filter(function(r) {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.label.toLowerCase().indexOf(q) !== -1 ||
        r.path.toLowerCase().indexOf(q) !== -1 ||
        r.description.toLowerCase().indexOf(q) !== -1 ||
        STUDIO_META[r.studio].label.toLowerCase().indexOf(q) !== -1
      );
    });
  }, [query, filter]);

  var liveCount = ROUTES.filter(function(r) { return r.status === "live"; }).length;
  var totalCount = ROUTES.length;

  if (!ok) return null;

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, paddingBottom: 80 }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes statusDotPulse{0%,100%{opacity:1}50%{opacity:0.55}}" }} />

      {/* Header */}
      <div style={{ borderBottom: "1px solid " + D.border, background: D.surface, padding: "32px 40px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.amber, boxShadow: "0 0 10px " + D.amber + "80" }} />
            <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: "0.12em", fontWeight: 700 }}>POAST · STATUS DASHBOARD</span>
          </div>
          <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 700, margin: 0, color: D.tx, letterSpacing: "-0.02em" }}>
            Route Inventory
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
            <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>
              {liveCount} of {totalCount} routes live
            </span>
            <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>·</span>
            <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>{new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: D.bg + "F0", backdropFilter: "blur(12px)", borderBottom: "1px solid " + D.border, padding: "16px 40px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ flex: "1 1 320px", minWidth: 240, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: D.txd }} />
            <input
              type="text"
              value={query}
              onChange={function(e) { setQuery(e.target.value); }}
              placeholder="Filter routes…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: D.card, border: "1px solid " + D.border, borderRadius: 8,
                padding: "10px 12px 10px 36px",
                fontFamily: mn, fontSize: 12, color: D.tx,
                outline: "none",
              }}
            />
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "live", "beta", "wip"] as StatusFilter[]).map(function(f) {
              var active = filter === f;
              var color = f === "all" ? D.amber : STATUS_META[f as StatusKind].color;
              var label = f === "all" ? "All" : STATUS_META[f as StatusKind].label;
              return (
                <button
                  key={f}
                  onClick={function() { setFilter(f); }}
                  style={{
                    background: active ? color + "20" : "transparent",
                    border: "1px solid " + (active ? color : D.border),
                    color: active ? color : D.txm,
                    fontFamily: mn, fontSize: 11, fontWeight: 600,
                    padding: "8px 14px", borderRadius: 6,
                    cursor: "pointer", letterSpacing: "0.04em",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Studio sections */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px" }}>
        {STUDIO_ORDER.map(function(studioKey) {
          var meta = STUDIO_META[studioKey];
          var entries = filtered.filter(function(r) { return r.studio === studioKey; });
          if (entries.length === 0) return null;
          return (
            <section key={studioKey} style={{ marginBottom: 40 }}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 4, height: 14, background: meta.color, borderRadius: 2 }} />
                <span style={{ fontFamily: mn, fontSize: 10, color: meta.color, letterSpacing: "0.14em", fontWeight: 700 }}>
                  {meta.label}
                </span>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
                  {entries.length} route{entries.length === 1 ? "" : "s"}
                </span>
                <div style={{ flex: 1, height: 1, background: D.border }} />
              </div>

              {/* Cards grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {entries.map(function(r) {
                  var sm = STATUS_META[r.status];
                  var isHover = hover === r.id;
                  return (
                    <a
                      key={r.id}
                      href={r.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={function() { setHover(r.id); }}
                      onMouseLeave={function() { setHover(null); }}
                      style={{
                        display: "block",
                        background: isHover ? D.hover : D.card,
                        border: "1px solid " + (isHover ? meta.color + "60" : D.border),
                        borderLeft: "3px solid " + meta.color,
                        borderRadius: 8,
                        padding: "14px 16px",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "all 0.15s ease",
                        position: "relative",
                        boxShadow: isHover ? "0 4px 18px rgba(0,0,0,0.4)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Status dot + label */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <div
                              style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: sm.color,
                                boxShadow: "0 0 6px " + sm.color + "70",
                                animation: r.status === "wip" ? "statusDotPulse 1.4s ease-in-out infinite" : undefined,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 600, color: D.tx, letterSpacing: "-0.01em" }}>
                              {r.label}
                            </span>
                          </div>
                          {/* Path */}
                          <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.path}
                          </div>
                          {/* Description */}
                          <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.45 }}>
                            {r.description}
                          </div>
                        </div>
                        <ArrowUpRight
                          size={16}
                          style={{
                            color: isHover ? meta.color : D.txd,
                            flexShrink: 0,
                            marginTop: 2,
                            transition: "transform 0.15s ease",
                            transform: isHover ? "translate(2px,-2px)" : "translate(0,0)",
                          }}
                        />
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: mn, fontSize: 12, color: D.txd }}>
            No routes match &ldquo;{query}&rdquo;.
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 40, padding: "16px 20px", border: "1px solid " + D.border, borderRadius: 8, background: D.card }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: "0.12em", marginBottom: 10, fontWeight: 700 }}>
            STATUS LEGEND
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {(Object.keys(STATUS_META) as StatusKind[]).map(function(s) {
              var sm = STATUS_META[s];
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: sm.color, boxShadow: "0 0 6px " + sm.color + "70" }} />
                  <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>
                    <span style={{ color: sm.color, fontWeight: 600 }}>{sm.label}</span>
                    <span style={{ color: D.txd }}> &mdash; {s === "live" ? "fully built" : s === "beta" ? "shipping, may have gaps" : "placeholder / broken"}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
