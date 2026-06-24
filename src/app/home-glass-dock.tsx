"use client";

import React from "react";
import {
  Home,
  Zap,
  Radio,
  GanttChart,
  Headphones,
  Newspaper,
  LayoutGrid,
  Captions,
  Brain,
  Clapperboard,
  Film,
  Type,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";

// ═══ GLASS HOVER BAR (the "dock") ═══
// Faithful port of the mockup glass `.dock` (~/poast-welcome-3.0 concepts/glass.html):
// a centered floating liquid-glass pill of 50px tool items with mono tooltips, a
// separator, a `.cur` active state, and a flyout (opened from the grid item) that
// holds the rest of the tools + Settings. Shown on BOTH Reflect homes (Clarity +
// Depth). Mounted as a viewport sibling (not inside the transformed content
// wrapper) so its position:fixed resolves to the viewport, not the .poast-fadein
// containing block — same reason Asset Library is hoisted out.

interface DockItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  href?: string;
}

// Pinned quick-launch row (left → separator → grid/more).
const PINNED: DockItem[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "sloptop", label: "Slop Top", Icon: Zap },
  { id: "weekly", label: "SA Weekly", Icon: Radio },
  { id: "chart2", label: "POAST Studio", Icon: GanttChart, href: "/charts" },
  { id: "fk", label: "Fab Knowledge", Icon: Headphones },
  { id: "news", label: "News Flow", Icon: Newspaper },
];

// The grid item's flyout — the rest of the workspace + Settings.
const MORE: DockItem[] = [
  { id: "carousel", label: "Carousel", Icon: LayoutGrid },
  { id: "captions", label: "Capper", Icon: Captions },
  { id: "intelligence-suite", label: "Intelligence", Icon: Brain, href: "/intelligence-suite" },
  { id: "p2p", label: "Press to Premier", Icon: Clapperboard },
  { id: "broll", label: "B-Roll", Icon: Film },
  { id: "copy-studio", label: "CopySTUDIO", Icon: Type, href: "/copy-studio" },
  { id: "assets", label: "Asset Library", Icon: Library },
];

const DOCK_CSS = `
@keyframes gdkRise { from { opacity: 0; transform: translateX(-50%) translateY(18px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@keyframes gdkFly { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.gdk-wrap { position: fixed; left: 50%; bottom: 24px; z-index: 95; transform: translateX(-50%); animation: gdkRise .6s cubic-bezier(.2,.7,.3,1) .15s both; }
.gdk-dock {
  display: flex; align-items: center; gap: 6px; padding: 9px 11px; border-radius: 22px;
  background: linear-gradient(140deg, rgba(26,24,40,calc(var(--glass-op,0.18) + 0.34)), rgba(8,6,16,calc(var(--glass-op,0.18) + 0.22)));
  backdrop-filter: blur(calc(var(--frost,2px) + 12px)) saturate(160%) brightness(1.05);
  -webkit-backdrop-filter: blur(calc(var(--frost,2px) + 12px)) saturate(160%) brightness(1.05);
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: inset 1.4px 1.4px 0 rgba(255,255,255,0.30), inset -1px -2px 5px rgba(255,255,255,0.05), 0 26px 64px rgba(0,0,0,0.55);
}
.gdk-di {
  position: relative; width: 50px; height: 50px; border-radius: 14px; display: grid; place-items: center;
  color: rgba(255,255,255,0.82); cursor: pointer; border: 1px solid transparent; background: transparent;
  transition: all .16s; -webkit-tap-highlight-color: transparent;
}
.gdk-di:hover { color: #fff; background: rgba(255,255,255,0.12); transform: translateY(-3px); }
.gdk-di.cur { color: #fff; background: rgba(255,255,255,0.16); }
.gdk-di.open { color: #fff; background: rgba(255,255,255,0.16); }
.gdk-tip {
  position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%) translateY(4px);
  opacity: 0; pointer-events: none; font-family: var(--mn,monospace); font-size: 9px; letter-spacing: .4px;
  color: #fff; background: rgba(10,8,18,0.92); border: 1px solid rgba(255,255,255,0.14); border-radius: 7px;
  padding: 4px 8px; white-space: nowrap; transition: all .15s;
}
.gdk-di:hover .gdk-tip { opacity: 1; transform: translateX(-50%) translateY(0); }
.gdk-sep { width: 1px; height: 30px; background: rgba(255,255,255,0.16); margin: 0 5px; flex: none; }
.gdk-fly {
  position: absolute; right: 0; bottom: calc(100% + 14px); min-width: 232px; padding: 8px; border-radius: 16px;
  background: rgba(16,14,26,0.95); backdrop-filter: blur(20px) saturate(1.3); -webkit-backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 30px 72px rgba(0,0,0,0.6);
  display: flex; flex-direction: column; gap: 2px; animation: gdkFly .16s ease-out both;
}
.gdk-fi {
  display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 10px; cursor: pointer;
  color: rgba(255,255,255,0.78); font-family: var(--ft,sans-serif); font-size: 13px; font-weight: 500; transition: all .14s;
}
.gdk-fi:hover { background: rgba(255,255,255,0.06); color: #fff; }
.gdk-fsep { height: 1px; margin: 5px 6px; background: rgba(255,255,255,0.1); }
@media (prefers-reduced-motion: reduce) { .gdk-wrap, .gdk-fly { animation: none !important; } }
`;

export default function GlassDock({
  onNavigate,
  active = "home",
}: {
  onNavigate: (id: string) => void;
  active?: string;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // Dismiss the flyout on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = (item: DockItem) => {
    if (item.href) window.open(item.href, "_blank");
    else onNavigate(item.id);
    setOpen(false);
  };

  return (
    <div className="gdk-wrap" ref={wrapRef}>
      <style dangerouslySetInnerHTML={{ __html: DOCK_CSS }} />
      <div className="gdk-dock" role="toolbar" aria-label="Quick launch">
        {PINNED.map((item) => {
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              className={"gdk-di" + (active === item.id ? " cur" : "")}
              onClick={() => go(item)}
              aria-label={item.label}
            >
              <Icon size={21} strokeWidth={1.7} />
              <span className="gdk-tip">{item.label}</span>
            </button>
          );
        })}

        <span className="gdk-sep" />

        {/* Grid / more — opens the flyout with the rest of the tools + Settings */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className={"gdk-di" + (open ? " open" : "")}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="More tools"
          >
            <LayoutGrid size={21} strokeWidth={1.7} />
            <span className="gdk-tip">More</span>
          </button>
          {open && (
            <div className="gdk-fly" role="menu">
              {MORE.map((item) => {
                const Icon = item.Icon;
                return (
                  <div key={item.id} className="gdk-fi" role="menuitem" tabIndex={0} onClick={() => go(item)}>
                    <Icon size={15} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
              <div className="gdk-fsep" />
              <div className="gdk-fi" role="menuitem" tabIndex={0} onClick={() => go({ id: "settings", label: "Settings", Icon: Settings })}>
                <Settings size={15} strokeWidth={1.8} />
                <span>Settings</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
