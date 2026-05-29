// Task Board Design Lab — APP mockups (round 2).
// Three directions that look like real, best-in-class task management apps —
// not editorial pages. References: Linear, Things 3, Amie, Height.
//
// Open at:  http://localhost:3000/design-lab/taskboard

"use client";

import { useState } from "react";

// ─── tokens ───
const D = {
  bg: "#06060C", card: "#0B0B12", surface: "#0F0F18", hover: "#13131D",
  border: "rgba(255,255,255,0.06)", borderStrong: "rgba(255,255,255,0.10)",
  tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56", txdd: "#36333C",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A",
};
const ft = "'Outfit',sans-serif";
const mn = "'JetBrains Mono',monospace";

// ─── data ───
type Task = { id: string; title: string; cat: string; person: string; due: string; pri: "P0" | "P1" | "P2" | "P3"; tag?: "OVERDUE" | "TODAY"; sub?: [number, number] };
const T: Task[] = [
  { id: "T-101", title: "Redo ClusterMax ribbons (participant + basic) and ship to print", cat: "Design", person: "Akash", due: "Today", pri: "P0", tag: "TODAY", sub: [2, 5] },
  { id: "T-102", title: "SA Weekly ep. 47 podcast cover + thumbnails", cat: "Podcast", person: "Daksh", due: "Today", pri: "P0", tag: "TODAY", sub: [0, 3] },
  { id: "T-103", title: "Onboard Michelle to Figma, Polotno, Blob access", cat: "Access", person: "Akash", due: "1d late", pri: "P0", tag: "OVERDUE", sub: [1, 4] },
  { id: "T-104", title: "Source B-roll for Nvidia keynote teaser", cat: "Video", person: "Vansh", due: "Sat", pri: "P1", sub: [0, 2] },
  { id: "T-105", title: "Update SemiAnalysis brand guidelines doc", cat: "Brand", person: "Akash", due: "Sun", pri: "P1" },
  { id: "T-106", title: "Ribbon mockups for Q3 events lineup", cat: "Events", person: "Max", due: "Jun 4", pri: "P2", sub: [0, 6] },
  { id: "T-107", title: "Weekly newsletter banner refresh", cat: "Marketing", person: "Daksh", due: "—", pri: "P3" },
  { id: "T-108", title: "Audit SA Spectrum palette across decks", cat: "Brand", person: "Michelle", due: "—", pri: "P3" },
];

const CC: Record<string, string> = {
  Design: D.amber, Podcast: D.crimson, Access: D.cyan, Video: D.coral,
  Brand: D.violet, Events: D.amber, Marketing: D.blue, Research: D.blue, Admin: D.txm,
};
const PC: Record<string, string> = {
  Akash: D.amber, Daksh: D.blue, Vansh: D.teal, Max: D.violet, Michelle: D.coral,
};
const PRI_COLOR = { P0: D.coral, P1: D.amber, P2: D.blue, P3: D.txd };

function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const bg = PC[name] || D.txd;
  return <div style={{ width: size, height: size, borderRadius: size, background: bg, color: "#0A0A0F", fontWeight: 800, fontSize: size * 0.42, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, flexShrink: 0 }}>{name[0]}</div>;
}

function StatusCircle({ done = false, size = 14 }: { done?: boolean; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size, border: "1.5px solid " + (done ? D.teal : D.txd), background: done ? D.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {done && <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L5 9.5L10 3.5" stroke="#0A0A0F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
  );
}

function PriPill({ pri }: { pri: Task["pri"] }) {
  const c = PRI_COLOR[pri];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px 2px 6px", background: "transparent", border: "1px solid " + c + "55", borderRadius: 5, fontFamily: mn, fontSize: 10, color: c, fontWeight: 600, letterSpacing: 0.5 }}>
      <span style={{ width: 6, height: 6, background: c, borderRadius: 1 }} />{pri}
    </span>
  );
}

function CatPill({ cat }: { cat: string }) {
  const c = CC[cat] || D.txd;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", background: c + "14", border: "1px solid " + c + "30", borderRadius: 999, fontSize: 11, color: c, fontWeight: 500, fontFamily: ft }}>
      <span style={{ width: 5, height: 5, background: c, borderRadius: 5 }} />{cat}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OPTION A — LINEAR PRO
// Dense, sharp, keyboard-first. Sidebar with views and workspaces.
// Filter bar with chips. Row-per-task with status circle, ID, title,
// inline meta chips, avatar, due. Hover states. Group headers.
// ═══════════════════════════════════════════════════════════════════
function OptionA() {
  const groups = [
    { label: "Overdue", count: T.filter((t) => t.tag === "OVERDUE").length, items: T.filter((t) => t.tag === "OVERDUE"), color: D.coral },
    { label: "Today", count: T.filter((t) => t.tag === "TODAY").length, items: T.filter((t) => t.tag === "TODAY"), color: D.amber },
    { label: "This week", count: T.filter((t) => !t.tag && ["Sat", "Sun"].includes(t.due)).length, items: T.filter((t) => !t.tag && ["Sat", "Sun"].includes(t.due)), color: D.blue },
    { label: "Later", count: T.filter((t) => !t.tag && !["Sat", "Sun"].includes(t.due)).length, items: T.filter((t) => !t.tag && !["Sat", "Sun"].includes(t.due)), color: D.txd },
  ];

  return (
    <div style={{ background: D.bg, color: D.tx, fontFamily: ft, minHeight: "100vh", display: "flex" }}>
      {/* SIDEBAR */}
      <aside style={{ width: 240, borderRight: "1px solid " + D.border, padding: "12px 0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "8px 14px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0A0F", fontWeight: 900, fontSize: 13, fontFamily: ft }}>S</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>SemiAnalysis</div>
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: "auto", opacity: 0.5 }}><path d="M2 3l3 4 3-4" stroke="currentColor" fill="none" strokeWidth="1.4" /></svg>
        </div>

        {/* command k */}
        <div style={{ margin: "4px 10px 16px", padding: "7px 11px", background: D.surface, border: "1px solid " + D.border, borderRadius: 7, display: "flex", alignItems: "center", gap: 9, color: D.txm, fontSize: 12 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          Search
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, padding: "2px 5px", border: "1px solid " + D.border, borderRadius: 4, color: D.txd }}>⌘K</span>
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, color: D.txd, letterSpacing: 1, padding: "0 16px 6px", textTransform: "uppercase" }}>Your views</div>
        {[
          { i: "▦", l: "Today", n: 3, active: true },
          { i: "◐", l: "Inbox", n: 12 },
          { i: "▤", l: "Upcoming", n: 5 },
          { i: "◍", l: "Assigned to me", n: 4 },
          { i: "✓", l: "Completed", n: 47 },
        ].map((v, i) => (
          <div key={i} style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer", background: v.active ? D.surface : "transparent", borderLeft: "2px solid " + (v.active ? D.amber : "transparent"), color: v.active ? D.tx : D.txm, fontSize: 13, fontWeight: v.active ? 600 : 400 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{v.i}</span>
            <span>{v.l}</span>
            <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{v.n}</span>
          </div>
        ))}

        <div style={{ fontSize: 10, fontWeight: 600, color: D.txd, letterSpacing: 1, padding: "20px 16px 6px", textTransform: "uppercase" }}>Categories</div>
        {Object.keys(CC).slice(0, 7).map((c) => (
          <div key={c} style={{ padding: "5px 14px", display: "flex", alignItems: "center", gap: 11, color: D.txm, fontSize: 12, cursor: "pointer" }}>
            <span style={{ width: 7, height: 7, background: CC[c], borderRadius: 7 }} />
            <span>{c}</span>
            <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{T.filter((t) => t.cat === c).length}</span>
          </div>
        ))}

        <div style={{ marginTop: "auto", padding: "12px 14px", borderTop: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 9 }}>
          <Avatar name="Akash" size={26} />
          <div style={{ fontSize: 12 }}>
            <div>Akash Patel</div>
            <div style={{ color: D.txd, fontSize: 10 }}>Director</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* topbar */}
        <div style={{ padding: "0 24px", borderBottom: "1px solid " + D.border, height: 48, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Today</span>
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>{T.length} open</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 11px", background: "transparent", border: "1px solid " + D.border, borderRadius: 6, color: D.txm, fontSize: 12, cursor: "pointer", fontFamily: ft }}>+ New task</button>
            <button style={{ padding: "5px 11px", background: D.amber, border: "1px solid " + D.amber, borderRadius: 6, color: "#0A0A0F", fontSize: 12, cursor: "pointer", fontFamily: ft, fontWeight: 600 }}>Quick add</button>
          </div>
        </div>

        {/* filter bar */}
        <div style={{ padding: "10px 24px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {["Filter", "Group: Status", "Sort: Priority", "Akash"].map((f, i) => (
            <span key={i} style={{ padding: "4px 9px", background: i === 3 ? D.amber + "20" : D.surface, border: "1px solid " + (i === 3 ? D.amber + "40" : D.border), borderRadius: 5, fontSize: 11, color: i === 3 ? D.amber : D.txm, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {i === 3 && <span style={{ width: 5, height: 5, background: D.amber, borderRadius: 5 }} />}
              {f}
              <svg width="8" height="8" viewBox="0 0 10 10" style={{ opacity: 0.5 }}><path d="M2 3l3 4 3-4" stroke="currentColor" fill="none" strokeWidth="1.4" /></svg>
            </span>
          ))}
        </div>

        {/* list */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {groups.map((g) => g.items.length > 0 && (
            <div key={g.label}>
              <div style={{ padding: "12px 24px 8px", display: "flex", alignItems: "center", gap: 9, background: D.bg, position: "sticky", top: 0, zIndex: 2, borderBottom: "1px solid " + D.border }}>
                <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3l3 4 3-4" stroke={D.txm} fill="none" strokeWidth="1.4" /></svg>
                <span style={{ width: 7, height: 7, background: g.color, borderRadius: 7 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: D.tx }}>{g.label}</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{g.count}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: D.txd, cursor: "pointer" }}>+ Add task</span>
              </div>
              {g.items.map((t) => (
                <div key={t.id} style={{ padding: "9px 24px", display: "flex", alignItems: "center", gap: 11, borderBottom: "1px solid " + D.border, cursor: "pointer", minHeight: 38 }}>
                  <StatusCircle />
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, minWidth: 42 }}>{t.id}</span>
                  <PriPill pri={t.pri} />
                  <span style={{ fontSize: 13.5, color: D.tx, flex: 1, fontWeight: 400, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  {t.sub && (
                    <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txm, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" stroke={D.txd} strokeWidth="1.3" fill="none" /><path d={`M6 6 L 6 1.5 A 4.5 4.5 0 ${t.sub[0] / t.sub[1] > 0.5 ? 1 : 0} 1 ${6 + 4.5 * Math.sin((t.sub[0] / t.sub[1]) * 2 * Math.PI)} ${6 - 4.5 * Math.cos((t.sub[0] / t.sub[1]) * 2 * Math.PI)} Z`} fill={D.teal} />
                      </svg>
                      {t.sub[0]}/{t.sub[1]}
                    </span>
                  )}
                  <CatPill cat={t.cat} />
                  <span style={{ fontSize: 11.5, color: t.tag === "OVERDUE" ? D.coral : t.tag === "TODAY" ? D.amber : D.txm, fontWeight: t.tag ? 600 : 400, minWidth: 60, textAlign: "right" }}>{t.due}</span>
                  <Avatar name={t.person} size={22} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* footer */}
        <div style={{ padding: "8px 24px", borderTop: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: D.txd, background: D.bg }}>
          <span><kbd style={{ fontFamily: mn, padding: "1px 5px", border: "1px solid " + D.border, borderRadius: 3, fontSize: 9 }}>C</kbd> create</span>
          <span><kbd style={{ fontFamily: mn, padding: "1px 5px", border: "1px solid " + D.border, borderRadius: 3, fontSize: 9 }}>⌘K</kbd> command</span>
          <span><kbd style={{ fontFamily: mn, padding: "1px 5px", border: "1px solid " + D.border, borderRadius: 3, fontSize: 9 }}>F</kbd> filter</span>
          <span style={{ marginLeft: "auto" }}>8 tasks · 3 due today</span>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OPTION B — SOFT FOCUS (Things 3 inspired)
// Calm, warm-dark canvas. Today as hero. Lots of generous spacing.
// Beautiful single-column reading flow. Soft chips. Looks expensive
// but unmistakably an app — sidebar, sections, scheduling.
// ═══════════════════════════════════════════════════════════════════
function OptionB() {
  return (
    <div style={{ background: "#0B0C12", color: D.tx, fontFamily: ft, minHeight: "100vh", display: "flex" }}>
      {/* slim sidebar */}
      <aside style={{ width: 64, borderRight: "1px solid " + D.border, padding: "16px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0A0F", fontWeight: 900, fontSize: 15, marginBottom: 16 }}>S</div>
        {[
          { i: "★", active: true, c: D.amber },
          { i: "☰", c: D.txm },
          { i: "▤", c: D.txm },
          { i: "◐", c: D.txm },
          { i: "✓", c: D.txm },
        ].map((b, i) => (
          <div key={i} style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: b.active ? D.amber : D.txd, background: b.active ? "rgba(247,176,65,0.10)" : "transparent", cursor: "pointer" }}>{b.i}</div>
        ))}
        <div style={{ marginTop: "auto" }}>
          <Avatar name="Akash" size={32} />
        </div>
      </aside>

      {/* second nav: lists */}
      <aside style={{ width: 220, borderRight: "1px solid " + D.border, padding: "26px 18px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: D.txd, letterSpacing: 1.4, marginBottom: 14, textTransform: "uppercase" }}>Lists</div>
        {[
          { i: "★", l: "Today", n: 3, active: true, c: D.amber },
          { i: "▦", l: "Upcoming", n: 5, c: D.blue },
          { i: "☰", l: "Anytime", n: 4, c: D.txm },
          { i: "◌", l: "Someday", n: 11, c: D.txm },
          { i: "✓", l: "Logbook", n: 47, c: D.teal },
        ].map((b, i) => (
          <div key={i} style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 11, borderRadius: 8, background: b.active ? "rgba(247,176,65,0.10)" : "transparent", color: b.active ? D.tx : D.txm, fontSize: 13.5, marginBottom: 2, cursor: "pointer", fontWeight: b.active ? 600 : 400 }}>
            <span style={{ color: b.c, width: 14 }}>{b.i}</span>
            <span>{b.l}</span>
            <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{b.n}</span>
          </div>
        ))}

        <div style={{ fontSize: 11, fontWeight: 700, color: D.txd, letterSpacing: 1.4, margin: "28px 0 14px", textTransform: "uppercase" }}>Projects</div>
        {["ClusterMax launch", "SA Weekly", "Q3 events", "Brand refresh"].map((p, i) => (
          <div key={i} style={{ padding: "8px 11px", display: "flex", alignItems: "center", gap: 11, fontSize: 13, color: D.txm, cursor: "pointer" }}>
            <span style={{ width: 6, height: 6, background: [D.amber, D.crimson, D.violet, D.cyan][i], borderRadius: 6 }} />
            <span>{p}</span>
          </div>
        ))}
      </aside>

      {/* main */}
      <main style={{ flex: 1, padding: "60px 80px 100px", maxWidth: 880, margin: "0 auto" }}>
        {/* date + greeting */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, rgba(247,176,65,0.20), rgba(247,176,65,0.04))", border: "1px solid rgba(247,176,65,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: D.amber, fontSize: 22 }}>★</div>
          <div>
            <div style={{ fontSize: 11, color: D.txd, letterSpacing: 1.5, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Thursday · May 28</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>Today</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={{ padding: "8px 12px", background: "transparent", border: "1px solid " + D.border, borderRadius: 8, color: D.txm, fontSize: 12, cursor: "pointer", fontFamily: ft }}>Filter</button>
            <button style={{ padding: "8px 14px", background: D.amber, border: "none", borderRadius: 8, color: "#0A0A0F", fontSize: 12, cursor: "pointer", fontFamily: ft, fontWeight: 600 }}>+ New To-Do</button>
          </div>
        </div>

        <div style={{ fontSize: 14, color: D.txm, lineHeight: 1.6, marginBottom: 44, marginLeft: 58 }}>
          3 to ship today. 1 already late. Five more wait in the queue. <span style={{ color: D.txd }}>Total pace looks good — finish overdue first.</span>
        </div>

        {/* overdue */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, background: D.coral, borderRadius: 8 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.coral, letterSpacing: 0.5 }}>Overdue</span>
            <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>1</span>
            <div style={{ flex: 1, height: 1, background: D.border, marginLeft: 8 }} />
          </div>
          {T.filter((t) => t.tag === "OVERDUE").map((t) => <SoftRow key={t.id} t={t} />)}
        </div>

        {/* today */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, background: D.amber, borderRadius: 8 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.amber, letterSpacing: 0.5 }}>Today</span>
            <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>2</span>
            <div style={{ flex: 1, height: 1, background: D.border, marginLeft: 8 }} />
          </div>
          {T.filter((t) => t.tag === "TODAY").map((t) => <SoftRow key={t.id} t={t} />)}
        </div>

        {/* this week */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, background: D.blue, borderRadius: 8 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.blue, letterSpacing: 0.5 }}>This week</span>
            <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>2</span>
            <div style={{ flex: 1, height: 1, background: D.border, marginLeft: 8 }} />
          </div>
          {T.filter((t) => !t.tag && ["Sat", "Sun"].includes(t.due)).map((t) => <SoftRow key={t.id} t={t} />)}
        </div>

        {/* later */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, background: D.txd, borderRadius: 8 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.txm, letterSpacing: 0.5 }}>Later</span>
            <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>3</span>
            <div style={{ flex: 1, height: 1, background: D.border, marginLeft: 8 }} />
          </div>
          {T.filter((t) => !t.tag && !["Sat", "Sun"].includes(t.due)).map((t) => <SoftRow key={t.id} t={t} />)}
        </div>
      </main>
    </div>
  );
}

function SoftRow({ t }: { t: Task }) {
  return (
    <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, borderRadius: 12, cursor: "pointer", marginBottom: 4, transition: "background 0.15s" }}>
      <StatusCircle size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, color: D.tx, fontWeight: 500, lineHeight: 1.4, marginBottom: 6 }}>{t.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: D.txd }}>
          <CatPill cat={t.cat} />
          {t.sub && <span style={{ fontFamily: mn }}>{t.sub[0]}/{t.sub[1]} steps</span>}
          {t.due !== "—" && <span style={{ color: t.tag === "OVERDUE" ? D.coral : t.tag === "TODAY" ? D.amber : D.txm }}>{t.due}</span>}
        </div>
      </div>
      <Avatar name={t.person} size={26} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OPTION C — STUDIO (Amie / Height premium)
// Today as a hero block with the week strip below. Tasks live in
// colorful cards with category bands. Bold gradient header.
// Modern SaaS-app polish + workhorse density underneath.
// ═══════════════════════════════════════════════════════════════════
function OptionC() {
  const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = T.filter((t) => t.tag);

  return (
    <div style={{ background: D.bg, color: D.tx, fontFamily: ft, minHeight: "100vh", display: "flex" }}>
      {/* sidebar */}
      <aside style={{ width: 240, padding: "20px 16px", borderRight: "1px solid " + D.border, flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0A0F", fontWeight: 900, fontSize: 14 }}>S</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Studio</div>
        </div>

        <button style={{ padding: "10px 14px", background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")", border: "none", borderRadius: 10, color: "#0A0A0F", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 18, fontFamily: ft }}>
          <span style={{ fontSize: 16 }}>+</span> New task
        </button>

        {[
          { i: "✦", l: "Today", n: 3, c: D.amber, active: true },
          { i: "▤", l: "Upcoming", n: 5, c: D.blue },
          { i: "◍", l: "All tasks", n: 12, c: D.txm },
          { i: "✓", l: "Done", n: 47, c: D.teal },
        ].map((v, i) => (
          <div key={i} style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 11, borderRadius: 9, background: v.active ? "rgba(247,176,65,0.08)" : "transparent", color: v.active ? D.tx : D.txm, fontSize: 13, marginBottom: 2, cursor: "pointer", fontWeight: v.active ? 600 : 400 }}>
            <span style={{ color: v.c, width: 14 }}>{v.i}</span>
            <span>{v.l}</span>
            <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{v.n}</span>
          </div>
        ))}

        <div style={{ fontSize: 10, fontWeight: 700, color: D.txd, letterSpacing: 1.5, margin: "24px 11px 10px", textTransform: "uppercase" }}>Categories</div>
        {Object.keys(CC).slice(0, 6).map((c) => (
          <div key={c} style={{ padding: "7px 11px", display: "flex", alignItems: "center", gap: 11, fontSize: 12.5, color: D.txm, cursor: "pointer" }}>
            <span style={{ width: 14, height: 14, background: CC[c] + "20", border: "1px solid " + CC[c] + "60", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 5, height: 5, background: CC[c], borderRadius: 5 }} />
            </span>
            <span>{c}</span>
            <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{T.filter((t) => t.cat === c).length}</span>
          </div>
        ))}

        <div style={{ marginTop: "auto", padding: "10px 11px", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid " + D.border, paddingTop: 14 }}>
          <Avatar name="Akash" size={28} />
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600 }}>Akash Patel</div>
            <div style={{ color: D.txd, fontSize: 10 }}>Pro · 6 seats</div>
          </div>
        </div>
      </aside>

      {/* main */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {/* hero */}
        <section style={{ position: "relative", padding: "40px 44px 30px", overflow: "hidden", borderBottom: "1px solid " + D.border }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(700px 400px at 90% -10%, rgba(247,176,65,0.12), transparent 60%), radial-gradient(500px 300px at -5% 110%, rgba(144,92,203,0.10), transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 26 }}>
            <div>
              <div style={{ fontSize: 11, color: D.amber, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Thursday, May 28</div>
              <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, margin: 0, marginBottom: 6 }}>Good afternoon, Akash.</h1>
              <div style={{ fontSize: 14, color: D.txm }}>3 things due today — let&apos;s ship them.</div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {[
                { l: "Overdue", v: 1, c: D.coral },
                { l: "Today", v: 2, c: D.amber },
                { l: "This week", v: 4, c: D.blue },
              ].map((s) => (
                <div key={s.l} style={{ padding: "12px 18px", background: D.card, border: "1px solid " + D.border, borderRadius: 11, minWidth: 90 }}>
                  <div style={{ fontSize: 10, color: D.txd, letterSpacing: 1, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{s.l}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.c, lineHeight: 1, letterSpacing: -0.5 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* week strip */}
          <div style={{ position: "relative", display: "flex", gap: 8 }}>
            {week.map((d, i) => {
              const isToday = i === 3;
              const isWeekend = i >= 5;
              const cnt = i === 3 ? 3 : i === 4 ? 0 : i === 5 ? 1 : i === 6 ? 1 : 0;
              return (
                <div key={d} style={{ flex: 1, padding: "12px 14px", background: isToday ? "rgba(247,176,65,0.10)" : D.card, border: "1px solid " + (isToday ? D.amber + "40" : D.border), borderRadius: 10, cursor: "pointer" }}>
                  <div style={{ fontSize: 10, color: isToday ? D.amber : D.txd, letterSpacing: 1, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{d}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: isToday ? D.tx : isWeekend ? D.txm : D.tx, letterSpacing: -0.5 }}>{26 + i}</span>
                    {cnt > 0 && <span style={{ fontSize: 11, color: D.txm, fontFamily: mn }}>{cnt}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* hot seat cards */}
        <section style={{ padding: "32px 44px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Hot seat</h2>
            <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>{today.length} items</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: D.txm, cursor: "pointer" }}>View all →</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
            {today.map((t) => (
              <div key={t.id} style={{ position: "relative", padding: "20px 22px", background: D.card, border: "1px solid " + (t.tag === "OVERDUE" ? "rgba(224,99,71,0.30)" : D.border), borderRadius: 14, cursor: "pointer", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: CC[t.cat] }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <CatPill cat={t.cat} />
                  {t.tag === "OVERDUE" && <span style={{ fontSize: 10.5, color: D.coral, fontWeight: 700, letterSpacing: 0.5 }}>● 1 DAY LATE</span>}
                  {t.tag === "TODAY" && <span style={{ fontSize: 10.5, color: D.amber, fontWeight: 700, letterSpacing: 0.5 }}>● TODAY</span>}
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.35, color: D.tx, marginBottom: 14 }}>{t.title}</div>
                {t.sub && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ height: 4, background: D.surface, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: ((t.sub[0] / t.sub[1]) * 100) + "%", background: D.teal, borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: D.txd, marginTop: 6, fontFamily: mn }}>{t.sub[0]} of {t.sub[1]} steps</div>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: "1px solid " + D.border }}>
                  <Avatar name={t.person} size={24} />
                  <span style={{ fontSize: 12.5, color: D.txm }}>{t.person}</span>
                  <PriPill pri={t.pri} />
                  <span style={{ marginLeft: "auto", fontSize: 11, color: D.txd, fontFamily: mn }}>{t.id}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* queue */}
        <section style={{ padding: "0 44px 60px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Queue</h2>
            <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>{T.length - today.length} items</span>
          </div>
          <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
            {T.filter((t) => !t.tag).map((t, i, arr) => (
              <div key={t.id} style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < arr.length - 1 ? "1px solid " + D.border : "none", cursor: "pointer" }}>
                <StatusCircle />
                <span style={{ fontSize: 14, color: D.tx, flex: 1, fontWeight: 500 }}>{t.title}</span>
                <CatPill cat={t.cat} />
                <PriPill pri={t.pri} />
                <span style={{ fontSize: 12, color: D.txm, minWidth: 50, textAlign: "right", fontFamily: mn }}>{t.due}</span>
                <Avatar name={t.person} size={22} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE — switcher
// ═══════════════════════════════════════════════════════════════════
const META = {
  A: { name: "Linear Pro", note: "dense · sharp · keyboard-first · sidebar + grouped list" },
  B: { name: "Soft Focus", note: "Things 3 vibe · calm · generous · single column" },
  C: { name: "Studio", note: "Amie / Height premium · hero + week strip + colorful cards" },
};

export default function DesignLabTaskboard() {
  const [opt, setOpt] = useState<"A" | "B" | "C">("A");

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: 4, padding: 5, background: "rgba(6,6,12,0.94)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, boxShadow: "0 12px 40px rgba(0,0,0,0.7)" }}>
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 2.5, color: D.amber, padding: "0 14px 0 18px", fontWeight: 700 }}>LAB</span>
        {(["A", "B", "C"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setOpt(k)}
            style={{
              padding: "9px 18px",
              background: opt === k ? D.amber : "transparent",
              color: opt === k ? "#0A0A0F" : D.txm,
              border: "none",
              borderRadius: 999,
              fontFamily: ft,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: 0.3,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {k} · {META[k].name}
          </button>
        ))}
      </div>

      <div style={{ position: "fixed", top: 65, left: "50%", transform: "translateX(-50%)", zIndex: 9998, fontFamily: mn, fontSize: 10, letterSpacing: 1.5, color: D.txm, background: "rgba(6,6,12,0.7)", backdropFilter: "blur(10px)", padding: "5px 16px", borderRadius: 6 }}>
        {META[opt].note}
      </div>

      {opt === "A" && <OptionA />}
      {opt === "B" && <OptionB />}
      {opt === "C" && <OptionC />}
    </div>
  );
}
