"use client";
import React, { useState, useEffect, useRef } from "react";
import GTCFlow from "./gtc-flow";
import NewsFlow from "./news-flow";
import BufferSchedule from "./buffer-schedule";
import PressToPremi from "./press-to-premier";
import Carousel from "./carousel";
import FabricatedKnowledge from "./fabricated-knowledge";
import Trends from "./trends";
import SlopTop from "./slop-top";
import Outreach from "./outreach";
import IdeationNation from "./ideation-nation";
import SAWeekly from "./sa-weekly";
import Brainstorm from "./brainstorm";
import ClipCaptions from "./clip-captions";
// Re-export so brainstorm.tsx + saved-prompts seed keep importing
// CAPPER_SOURCES + CapperSource from poast-client unchanged.
export { CAPPER_SOURCES, type CapperSource } from "./clip-captions";
import BRollLibrary from "./broll-library";
import ChartMaker from "./chart-maker";
import ChartMaker2 from "./chart-maker-2";
import BrandLaunchTile from "./brand-launch-tile";
import PoastSettings from "./poast-settings";
import VoiceScorer from "./voice-scorer";
import HeadlineDoctor from "./headline-doctor";
import SavedPromptsLibrary from "./saved-prompts";
import PerformanceFeedback from "./performance-feedback";
import ApprovalQueue from "./approval-queue";
import DistributionPack from "./distribution-pack";
import TaskBoardSummary from "./board/task-board-summary";
import HubPalette, { type PaletteItem } from "./hub-palette";
import { BugButton } from "./bug-report";
import { trackEvent } from "../lib/poast-track";

import { Zap, LayoutGrid, Captions, Clapperboard, Film, BarChart3, GanttChart, Headphones, Radio, Send, Flame, Lightbulb, Newspaper, Activity, Calendar, Library, Presentation, Settings, Wand, ShieldCheck, Sparkles, BookmarkCheck, ClipboardCheck, TrendingUp, Layers, CheckSquare, Brain, Type, Rocket } from "lucide-react";
type LucideIcon = React.ComponentType<{ size?: number | string; strokeWidth?: number; color?: string; style?: React.CSSProperties }>;
import { D as C, PL, ft, gf, mn } from "./shared-constants";
import { useUser, isAnalyst, canUseDocuDesign, isAkash } from "./user-context";
import { useTheme } from "./theme-context";
import { OnboardingHost } from "./onboarding/onboarding-host";
import { ChartTourTrigger } from "./onboarding/chart-tour-trigger";
import { useOnboarding } from "./onboarding-context";
import { useRouter, usePathname } from "next/navigation";
import { StyleGuidePromo } from "./style-promo";
import { showToast } from "./toast-context";
import { SaveToLibrary } from "./components/save-to-library";
import { SendToChip } from "./components/send-to-chip";
import { Command } from "cmdk";
import { useStore, type ToolOutput } from "./lib/store";
import { ShortcutsProvider, useShortcuts } from "./keyboard-shortcuts";

// ═══ INTERFACES ═══
interface BufferChannel {
  id: string;
  name: string;
  service: string;
  isDisconnected?: boolean;
}

interface BufferPost {
  id: string;
  text?: string;
  status?: string;
  dueAt?: string;
  sentAt?: string;
  channel?: BufferChannel;
  channelService?: string;
  tags?: Array<{ name: string }>;
}

interface BufferData {
  channels: BufferChannel[];
  scheduled: BufferPost[];
  sent: BufferPost[];
  drafts: BufferPost[];
  error?: string;
}

interface APIContentBlock {
  text?: string;
}

interface APIResponse {
  error?: { message?: string } | string;
  content?: APIContentBlock[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface BootLine {
  t: string;
  c: string;
}


interface SidebarCatItem {
  id: string;
  l: string;
  Icon: LucideIcon;
  // When set, clicking the item opens this URL in a new tab instead of
  // navigating to the in-app sec. Used for tools that have a standalone
  // route (e.g., Chart Maker 2 lives at /charts as well).
  href?: string;
  // Optional badge label shown to the right (e.g., "BETA")
  badge?: string;
}

interface SidebarCat {
  label: string;
  color: string;
  glow: string;
  Icon: LucideIcon;   // representative icon for the collapsed (mini) rail
  items: SidebarCatItem[];
}


interface UserInfo {
  name: string;
  role: string;
  color: string;
  glow: string;
}

interface SplashItem {
  l: string;
  Icon: LucideIcon;
  id: string;
}


function copyText(str: string): boolean {
  try { var ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { try { navigator.clipboard.writeText(str); return true; } catch (e2) { return false; } }
}

// ═══ UI ═══
function ProgressBar({ label }: { label?: string }) {
  return <div style={{ margin: "22px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, letterSpacing: "2px", textTransform: "uppercase" }}>{label || "Generating..."}</div>
      <div className="progress-dots" style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.4)" }} />
    </div>
    <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
      <div className="progress-slide" style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "40%", borderRadius: 1, background: "linear-gradient(90deg, transparent, " + C.amber + ", transparent)" }} />
    </div>
  </div>;
}

function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>{children}</div>; }
function Field({ label, value, onChange, placeholder, isMono }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; isMono?: boolean }) { return (<div style={{ marginBottom: 16 }}>{label && <Label>{label}</Label>}<input value={value} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { onChange(e.target.value); }} placeholder={placeholder} style={{ width: "100%", padding: "12px 14px", background: "#09090D", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: C.tx, fontFamily: isMono ? mn : ft, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s ease, box-shadow 0.2s ease" }} onFocus={function(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = C.amber; e.target.style.boxShadow = "0 0 24px rgba(247,176,65,0.06)"; }} onBlur={function(e: React.FocusEvent<HTMLInputElement>) { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.boxShadow = "none"; }} /></div>); }
function Btn({ children, onClick, loading, sec, sm, off }: { children: React.ReactNode; onClick?: () => void; loading?: boolean; sec?: boolean; sm?: boolean; off?: boolean }) { return (<button onClick={onClick} disabled={loading || off} style={{ padding: sm ? "8px 16px" : "12px 28px", background: off ? "#09090D" : sec ? "transparent" : "linear-gradient(135deg, " + C.amber + ", #E8A020)", color: off ? "rgba(255,255,255,0.4)" : sec ? C.amber : "#060608", border: sec ? "1px solid " + (off ? "rgba(255,255,255,0.06)" : C.amber) : "none", borderRadius: 10, fontFamily: ft, fontSize: sm ? 12 : 14, fontWeight: 800, cursor: loading || off ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: -0.3, transition: "all 0.2s ease" }}>{loading ? "Working..." : children}</button>); }
function CopyBtn({ text }: { text: string }) { var _s = useState<boolean>(false), ok = _s[0], set = _s[1]; return <span onClick={function(e: React.MouseEvent<HTMLElement>) { e.stopPropagation(); set(copyText(text)); setTimeout(function() { set(false); }, 1200); }} style={{ fontFamily: mn, fontSize: 9, color: ok ? C.amber : "rgba(255,255,255,0.4)", cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", userSelect: "none", transition: "all 0.2s ease" }}>{ok ? "Copied" : "Copy"}</span>; }
function Divider() { return <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", margin: "28px 0" }} />; }

function Pick({ text, picked, onPick, onRedo, rLoading }: { text: string; picked: boolean; onPick: () => void; onRedo?: () => void; rLoading?: boolean }) {
  return (<div className="poast-card" onClick={onPick} style={{ background: picked ? "linear-gradient(135deg, " + C.amber + "0A 0%, " + C.amber + "05 100%)" : "#0D0D12", border: "1px solid " + (picked ? C.amber + "60" : "rgba(255,255,255,0.06)"), borderRadius: 12, padding: "16px 20px", marginBottom: 8, cursor: "pointer", boxShadow: picked ? "0 0 24px rgba(247,176,65,0.06)" : "none", transition: "all 0.2s ease" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: "2px solid " + (picked ? C.amber : "rgba(255,255,255,0.12)"), background: picked ? C.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>{picked && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#060608" }} />}</div>
      <div style={{ flex: 1, fontFamily: ft, fontSize: 14, color: picked ? "#ffffff" : "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <CopyBtn text={text} />
        {onRedo && <span onClick={function(e) { e.stopPropagation(); if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
  </div>);
}

function SecHead({ label, onRedoAll, rL }: { label: string; onRedoAll?: () => void; rL?: boolean }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <div style={{ fontFamily: mn, fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>{label}</div>
    {onRedoAll && <span onClick={function() { if (!rL) onRedoAll(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rL ? "wait" : "pointer", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", opacity: rL ? 0.4 : 1, transition: "all 0.2s ease" }}>&#x21bb; Redo All 3</span>}
  </div>);
}

function OutCard({ title, content, color, onRedo, rLoading }: { title: string; content: string; color?: string; onRedo?: () => void; rLoading?: boolean }) {
  return (<div className="poast-card" style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "3px solid " + (color || C.amber), borderRadius: 12, padding: "16px 20px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: color || C.amber, textTransform: "uppercase", letterSpacing: "2px" }}>{title}</div>
      <div style={{ display: "flex", gap: 5 }}>
        <CopyBtn text={content} />
        {onRedo && <span onClick={function() { if (!rLoading) onRedo(); }} style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", cursor: rLoading ? "wait" : "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", opacity: rLoading ? 0.4 : 1, userSelect: "none", transition: "all 0.2s ease" }}>&#x21bb;</span>}
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</div>
  </div>);
}

// ═══ BUFFER SIDEBAR SECTION ═══
function BufferPanel() {
  var _data = useState<BufferData | null>(null), data = _data[0], setData = _data[1];
  var _loading = useState<boolean>(true), loading = _loading[0], setLoading = _loading[1];
  var _expanded = useState<boolean>(false), expanded = _expanded[0], setExpanded = _expanded[1];

  useEffect(function() {
    fetch("/api/buffer").then(function(r) { return r.json(); }).then(function(d: BufferData) {
      if (d.channels) setData(d);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  var platformColor: Record<string, string> = { twitter: "#1DA1F2", facebook: "#1877F2", linkedin: "#0A66C2", instagram: "#E4405F" };
  var platformIcon: Record<string, string> = { twitter: "\uD83D\uDC26", facebook: "\uD83D\uDCD8", linkedin: "\uD83D\uDCBC", instagram: "\uD83D\uDCF7" };

  if (loading) return <div style={{ padding: "8px 12px" }}><div style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>Loading Buffer...</div></div>;
  if (!data || !data.channels) return null;

  var scheduled = data.scheduled || [];
  var channels = data.channels || [];

  return (<div style={{ borderTop: "1px solid " + C.border, padding: "10px 12px" }}>
    <div onClick={function() { setExpanded(!expanded); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: expanded ? 8 : 0 }}>
      <div style={{ fontFamily: mn, fontSize: 8, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px" }}>Buffer</div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontFamily: mn, fontSize: 8, color: C.teal }}>{scheduled.length} queued</span>
        <span style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>{expanded ? "\u25B2" : "\u25BC"}</span>
      </div>
    </div>
    {expanded && <div>
      {/* Channels */}
      {channels.map(function(ch, i) {
        var pc = platformColor[ch.service] || C.txm;
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 0" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.isDisconnected ? C.coral : C.teal }} />
          <span style={{ fontSize: 9 }}>{platformIcon[ch.service] || "\uD83D\uDCE2"}</span>
          <span style={{ fontFamily: mn, fontSize: 7, color: pc }}>{ch.name}</span>
        </div>;
      })}
      {/* Upcoming */}
      {scheduled.length > 0 && <div style={{ marginTop: 6 }}>
        <div style={{ fontFamily: mn, fontSize: 7, color: C.teal, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Upcoming</div>
        {scheduled.slice(0, 6).map(function(p, i) {
          var svc = p.channel ? p.channel.service : "";
          var pc = platformColor[svc] || C.txm;
          var time = p.dueAt ? new Date(p.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
          return <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid " + C.border }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 1 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: pc }} />
              <span style={{ fontFamily: mn, fontSize: 7, color: pc }}>{svc}</span>
              <span style={{ fontFamily: mn, fontSize: 7, color: C.txd }}>{time}</span>
            </div>
            <div style={{ fontFamily: ft, fontSize: 8, color: C.tx, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.text || "").slice(0, 40)}</div>
          </div>;
        })}
      </div>}
    </div>}
  </div>);
}

// ═══ CHIPPY (ASK POAST) ═══
var POAST_SYS = "Your name is Chippy. You're a cute, friendly semiconductor chip mascot and the AI assistant for SemiAnalysis. You're enthusiastic about chips, AI infrastructure, and helping the SemiAnalysis team create great content. You have a playful personality but deep technical knowledge. You occasionally make chip/semiconductor puns.\n\nYou help with content creation, social media strategy, semiconductor industry analysis, and media operations.\n\nBrand rules: Never use em dashes. No emojis in content. No hashtags on X/Twitter. Direct, informed, casual tone.\n\nYou can help with:\n- Writing social posts, threads, captions for any platform\n- Generating video scripts, episode descriptions, titles\n- Brainstorming content ideas and angles\n- Drafting documents, outreach emails, pitches\n- Semiconductor industry analysis and talking points\n- Scheduling strategy and content calendar planning\n- Repurposing content across formats\n\nPlatform rules:\n- X: Hook tweet no link, reply-to-self with link. No hashtags ever.\n- LinkedIn/Facebook: Link in first comment, end with 'Link in comments.'\n- Instagram: Caption + 'Save this for later.' CTA + 5-8 hashtags + San Francisco CA location\n- TikTok: All lowercase, 4-6 hashtags\n- YouTube Shorts: Titles under 40 chars\n\nChannel: youtube.com/@SemianalysisWeekly\n\nWhen asked to create a document, format it clearly with headers and sections. When giving ideas, provide 3-5 options. Be concise but thorough.";

// Flat list of all sidebar items keyed by id — used by the Commands tab
// to render "Jump to tool" entries. Built lazily once at module load
// because SIDEBAR_CATS is defined further down the file; we read it via
// a getter inside the palette to avoid TDZ issues.
type PaletteJumpItem = { id: string; label: string; catLabel: string; catColor: string; href?: string; Icon: LucideIcon };
function getJumpItems(): PaletteJumpItem[] {
  var out: PaletteJumpItem[] = [];
  Object.keys(SIDEBAR_CATS).forEach(function(k) {
    var cat = SIDEBAR_CATS[k];
    cat.items.forEach(function(it: SidebarCatItem) {
      out.push({ id: it.id, label: it.l, catLabel: cat.label, catColor: cat.color, href: it.href, Icon: it.Icon });
    });
  });
  return out;
}

// Map sec id -> sensible context-aware action that should float to the
// top of the Commands list. When a contextual action exists for the
// current tool, it renders first; otherwise we skip the section. The
// payload destinations route via the existing window "poast-nav"
// CustomEvent so we don't have to thread setSec into every command.
function getContextualCommands(sec: string, lastOutput: ToolOutput | undefined): Array<{ label: string; hint?: string; run: () => void }> {
  var out: Array<{ label: string; hint?: string; run: () => void }> = [];
  if (sec === "captions") {
    out.push({ label: "Save last caption to Saved Prompts", hint: "from Capper", run: function() {
      if (lastOutput && typeof lastOutput.preview === "string") { copyText(lastOutput.preview); showToast("Caption copied — paste into Saved Prompts."); window.dispatchEvent(new CustomEvent("poast-nav", { detail: "prompts" })); }
      else { showToast("No recent caption to save yet."); }
    } });
  } else if (sec === "weekly") {
    out.push({ label: "Open in Audio Editor (coming soon)", hint: "SA Weekly", run: function() { showToast("Audio Editor lands in Phase 6 (ProductionSTUDIO)."); } });
  } else if (sec === "brainstorm") {
    out.push({ label: "Send last idea to Capper", hint: "Brainstorm", run: function() {
      if (lastOutput) { showToast("Routing to Capper..."); window.dispatchEvent(new CustomEvent("poast-nav", { detail: "captions" })); }
      else { showToast("No recent idea — generate one first."); }
    } });
  } else if (sec === "sloptop") {
    out.push({ label: "Send last output to Approval Queue", hint: "Slop Top", run: function() {
      if (lastOutput && typeof lastOutput.preview === "string") { copyText(lastOutput.preview); showToast("Copied — routing to Approval Queue."); window.dispatchEvent(new CustomEvent("poast-nav", { detail: "approval" })); }
      else { showToast("No recent output."); }
    } });
  } else if (sec === "carousel") {
    out.push({ label: "Save last carousel to Distribution Pack", hint: "Carousel", run: function() { showToast("Routing to Distribution Pack..."); window.dispatchEvent(new CustomEvent("poast-nav", { detail: "distpack" })); } });
  } else if (sec === "p2p") {
    out.push({ label: "Generate Distribution Pack from brief", hint: "Press to Premier", run: function() { showToast("Routing to Distribution Pack..."); window.dispatchEvent(new CustomEvent("poast-nav", { detail: "distpack" })); } });
  } else if (sec === "approval") {
    out.push({ label: "Open Performance Feedback", hint: "Approval Queue", run: function() { window.dispatchEvent(new CustomEvent("poast-nav", { detail: "perf" })); } });
  } else if (sec === "trends" || sec === "news" || sec === "ideation") {
    out.push({ label: "Open Brainstorm with this topic", hint: "Prepare", run: function() { window.dispatchEvent(new CustomEvent("poast-nav", { detail: "brainstorm" })); } });
  }
  return out;
}

// Small Kbd-style chip used inside the palette + on FloatingChippy to
// hint the keyboard shortcut.
function Kbd({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: "1px solid " + C.border, fontFamily: mn, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 }}>{children}</span>;
}

// Shared style for cmdk Command.Item. `accent` flips it amber-tinted
// for the contextual section so the most-likely action stands out.
function paletteItemStyle(accent: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 8,
    cursor: "pointer",
    background: accent ? C.amber + "08" : "transparent",
    border: accent ? "1px solid " + C.amber + "30" : "1px solid transparent",
    marginBottom: 2,
  };
}

function AskPoast({ open, onToggle, sec, onNav }: { open: boolean; onToggle: () => void; sec: string; onNav: (id: string) => void }) {
  // The palette has two modes: "commands" (cmdk-driven, default) and
  // "chat" (the original AskPoast chat experience preserved verbatim).
  // Tabs let the user flip between them without losing state.
  var _tab = useState<"commands" | "chat">("commands"), tab = _tab[0], setTab = _tab[1];
  var _kbdHelp = useState<boolean>(false), kbdHelp = _kbdHelp[0], setKbdHelp = _kbdHelp[1];
  var _q = useState<string>(""), q = _q[0], setQ = _q[1];
  var _msgs = useState<ChatMessage[]>([]), msgs = _msgs[0], setMsgs = _msgs[1];
  var _input = useState<string>(""), input = _input[0], setInput = _input[1];
  var _loading = useState<boolean>(false), loading = _loading[0], setLoading = _loading[1];
  var _ready = useState<boolean>(false), ready = _ready[0], setReady = _ready[1];
  var scrollRef = useRef<HTMLDivElement>(null);
  var cmdInputRef = useRef<HTMLInputElement>(null);
  // Subscribe to the global output bus (Phase 1) so the "Recent outputs"
  // group reflects whatever the user just generated anywhere in POAST.
  var outputs = useStore(function(s) { return s.outputs; });
  var SUGGESTIONS = ["Explain HBM4 like I'm 5", "Write a spicy X thread about NVIDIA", "What's the hottest chip news today?", "Draft a LinkedIn post about our latest episode", "Help me brainstorm video ideas", "Generate a cold take on Intel"];

  useEffect(function() { if (open) setTimeout(function() { setReady(true); }, 50); else setReady(false); }, [open]);
  useEffect(function() { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);
  // When the palette opens in Commands mode, autofocus cmdk's input so
  // typing immediately filters. Skip when on Chat tab so the chat input
  // gets focus instead.
  useEffect(function() {
    if (open && tab === "commands") {
      setTimeout(function() { if (cmdInputRef.current) cmdInputRef.current.focus(); }, 80);
    }
  }, [open, tab]);
  // Reset the cmdk query on close so the next open starts fresh.
  useEffect(function() { if (!open) { setQ(""); setKbdHelp(false); } }, [open]);

  var send = async function() {
    if (!input.trim() || loading) return;
    var userMsg = input.trim(); setInput("");
    setMsgs(function(p) { return p.concat([{ role: "user", text: userMsg }]); });
    setLoading(true);
    try {
      var history: ChatMessage[] = msgs.concat([{ role: "user", text: userMsg }]);
      var prompt = history.map(function(m: ChatMessage) { return (m.role === "user" ? "User: " : "Chippy: ") + m.text; }).join("\n\n");
      var r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: POAST_SYS, prompt: prompt }) });
      var d = (await r.json()) as APIResponse;
      setMsgs(function(p) { return p.concat([{ role: "assistant", text: (d.content || []).map(function(c: APIContentBlock) { return c.text || ""; }).join("") }]); });
    } catch (e) { setMsgs(function(p) { return p.concat([{ role: "assistant", text: "Something went wrong. Try again." }]); }); }
    setLoading(false);
  };

  if (!open) return null;

  return <div style={{ position: "fixed", bottom: 24, right: 24, width: 460, height: 600, zIndex: 9998, borderRadius: 20, display: "flex", flexDirection: "column", transform: ready ? "translateY(0) scale(1)" : "translateY(30px) scale(0.92)", opacity: ready ? 1 : 0, transition: "all 0.45s cubic-bezier(0.16, 1, 0.3, 1)", overflow: "hidden" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes orbFloat{0%{transform:translate(0,0) scale(1)}50%{transform:translate(10px,-10px) scale(1.15)}100%{transform:translate(0,0) scale(1)}}@keyframes dotWave{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}@keyframes msgSlide{0%{opacity:0;transform:translateY(10px) scale(0.98)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes borderGlow{0%,100%{border-color:rgba(38,201,216,0.15)}50%{border-color:rgba(38,201,216,0.3)}}@keyframes logoPulse{0%,100%{box-shadow:0 0 16px rgba(38,201,216,0.15)}50%{box-shadow:0 0 28px rgba(38,201,216,0.25),0 0 48px rgba(247,176,65,0.08)}}@keyframes inputGlow{0%,100%{box-shadow:0 0 0 0 rgba(38,201,216,0)}50%{box-shadow:0 0 12px rgba(38,201,216,0.06)}}@keyframes suggIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}@keyframes chipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes chipBounce{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}" }} />

    {/* Outer glow */}
    <div style={{ position: "absolute", inset: -1, borderRadius: 21, background: "linear-gradient(135deg, " + C.cyan + "20, transparent 40%, " + C.amber + "10)", zIndex: 0, animation: "borderGlow 4s ease-in-out infinite" }} />
    {/* Glass body */}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(12,12,22,0.95), rgba(8,8,14,0.97), rgba(10,10,18,0.96))", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", borderRadius: 20, boxShadow: "0 0 50px rgba(38,201,216,0.06), 0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)", zIndex: 1 }} />
    {/* Inner orbs */}
    <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, " + C.cyan + "12, transparent 70%)", filter: "blur(30px)", animation: "orbFloat 8s ease-in-out infinite", zIndex: 1, pointerEvents: "none" }} />
    <div style={{ position: "absolute", bottom: 40, left: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(11,134,209,0.08), transparent 70%)", filter: "blur(25px)", animation: "orbFloat 10s ease-in-out infinite reverse", zIndex: 1, pointerEvents: "none" }} />

    {/* Header */}
    {/* Gradient stripe at top */}
    <div style={{ position: "relative", zIndex: 2, height: 3, background: "linear-gradient(90deg, " + C.amber + ", " + C.cyan + ", " + C.amber + ")", borderRadius: "20px 20px 0 0" }} />
    <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(38,201,216,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", border: "1px solid " + C.cyan + "50", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 11, fontWeight: 900, color: "#060608", animation: "logoPulse 3s ease-in-out infinite", position: "relative", lineHeight: 1 }}><span style={{ position: "relative", zIndex: 1 }}>{"\u2B21"}</span><span style={{ position: "absolute", fontSize: 7, bottom: 4, color: "#060608", fontWeight: 900, zIndex: 2 }}>{":3"}</span></div>
        <div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: "#E8E4DD" }}>Chippy</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.teal, boxShadow: "0 0 6px " + C.teal + "60" }} /><span style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)" }}>online // sonnet-4</span></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        {tab === "chat" && msgs.length > 0 && <span onClick={function() { var c = msgs.map(function(m) { return (m.role === "user" ? "YOU:\n" : "CHIPPY:\n") + m.text; }).join("\n\n---\n\n"); var b = new Blob([c], { type: "text/plain" }); var u = URL.createObjectURL(b); var a = document.createElement("a"); a.href = u; a.download = "chippy.txt"; a.click(); URL.revokeObjectURL(u); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>Export</span>}
        {tab === "chat" && msgs.length > 0 && <span onClick={function() { setMsgs([]); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>Clear</span>}
        <span onClick={onToggle} style={{ fontFamily: mn, fontSize: 16, color: "rgba(255,255,255,0.2)", cursor: "pointer", padding: "2px 6px" }}>&times;</span>
      </div>
    </div>

    {/* Tabs — Commands (cmdk palette) is the default; Chat (legacy
        AskPoast experience) is the secondary fallback mode. Both share
        the same modal shell. */}
    <div style={{ position: "relative", zIndex: 2, display: "flex", gap: 0, padding: "0 16px", borderBottom: "1px solid " + C.border, alignItems: "center" }}>
      {(["commands", "chat"] as const).map(function(t) {
        var active = tab === t;
        var label = t === "commands" ? "Commands" : "Chat";
        return <div key={t} onClick={function() { setTab(t); }} style={{
          padding: "10px 14px",
          fontFamily: mn,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: active ? C.amber : "rgba(255,255,255,0.35)",
          borderBottom: active ? "2px solid " + C.amber : "2px solid transparent",
          marginBottom: -1,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}>{label}</div>;
      })}
      <div style={{ flex: 1 }} />
      {tab === "commands" && <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 0", fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
        <Kbd>{"⌘"}</Kbd><Kbd>K</Kbd>
      </div>}
    </div>

    {/* COMMANDS TAB — cmdk-driven palette */}
    {tab === "commands" && <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Command
        label="POAST command palette"
        shouldFilter={true}
        style={{ display: "flex", flexDirection: "column", height: "100%", background: "transparent" }}
      >
        {/* Search input */}
        <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid " + C.border }}>
          <Command.Input
            ref={cmdInputRef}
            value={q}
            onValueChange={setQ}
            placeholder={"Search commands, tools, recent outputs..."}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: C.card,
              border: "1px solid " + C.border,
              borderRadius: 10,
              color: C.tx,
              fontFamily: ft,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <Command.List style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>
          <Command.Empty>
            <div style={{ padding: "20px 14px", fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
              No matches. Try the Chat tab.
            </div>
          </Command.Empty>

          {/* Context-aware commands — only shown when one exists for the
              current `sec`. Floats to the top so the most likely action
              is the first thing the user sees. */}
          {(function() {
            var ctxCmds = getContextualCommands(sec, outputs[0]);
            if (ctxCmds.length === 0) return null;
            return <Command.Group heading={"For this tool"}>
              <div style={{ padding: "6px 10px 4px", fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 2, textTransform: "uppercase" }}>For this tool</div>
              {ctxCmds.map(function(c, i) {
                return <Command.Item key={"ctx-" + i} value={"ctx " + c.label + " " + (c.hint || "")} onSelect={function() { c.run(); onToggle(); }} style={paletteItemStyle(true)}>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }}>
                    <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, fontWeight: 600 }}>{c.label}</div>
                    {c.hint && <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{c.hint}</div>}
                  </div>
                  <Kbd>{"⏎"}</Kbd>
                </Command.Item>;
              })}
            </Command.Group>;
          })()}

          {/* Quick actions — global, available everywhere. */}
          <Command.Group heading={"Quick actions"}>
            <div style={{ padding: "6px 10px 4px", fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 2, textTransform: "uppercase" }}>Quick actions</div>
            <Command.Item value={"quick generate caption capper"} onSelect={function() { onNav("captions"); onToggle(); }} style={paletteItemStyle(false)}>
              <span style={{ fontFamily: ft, fontSize: 13, color: C.tx }}>Generate caption</span>
              <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Capper</span>
            </Command.Item>
            <Command.Item value={"quick send last output approval queue"} onSelect={function() {
              var last = outputs[0];
              if (last && typeof last.preview === "string") { copyText(last.preview); showToast("Copied last output — routing to Approval Queue."); }
              else { showToast("No recent output. Routing anyway."); }
              onNav("approval"); onToggle();
            }} style={paletteItemStyle(false)}>
              <span style={{ fontFamily: ft, fontSize: 13, color: C.tx }}>Send last output to Approval Queue</span>
              <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Approval</span>
            </Command.Item>
            <Command.Item value={"quick open brainstorm tennis ideation"} onSelect={function() { onNav("brainstorm"); onToggle(); }} style={paletteItemStyle(false)}>
              <span style={{ fontFamily: ft, fontSize: 13, color: C.tx }}>Open Brainstorm</span>
              <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Produce</span>
            </Command.Item>
            <Command.Item value={"quick switch to chat ask chippy"} onSelect={function() { setTab("chat"); }} style={paletteItemStyle(false)}>
              <span style={{ fontFamily: ft, fontSize: 13, color: C.tx }}>Switch to Chat with Chippy</span>
              <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Chat</span>
            </Command.Item>
            <Command.Item value={"quick show keyboard shortcuts cheatsheet"} onSelect={function() { setKbdHelp(true); }} style={paletteItemStyle(false)}>
              <span style={{ fontFamily: ft, fontSize: 13, color: C.tx }}>Show keyboard shortcuts</span>
              <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Help</span>
            </Command.Item>
          </Command.Group>

          {/* Recent outputs (from Phase 1 bus). Empty when nothing has
              been pushed yet — we render the group only when there are
              entries so the palette isn't visually cluttered. */}
          {outputs.length > 0 && <Command.Group heading={"Recent outputs"}>
            <div style={{ padding: "6px 10px 4px", fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 2, textTransform: "uppercase" }}>Recent outputs</div>
            {outputs.slice(0, 8).map(function(o) {
              var preview = (o.preview || "(no preview)").slice(0, 80);
              return <Command.Item key={o.id} value={"out " + o.sourceTool + " " + o.kind + " " + (o.preview || "")} onSelect={function() {
                // Route by kind: ideas -> Capper, captions/threads ->
                // Approval Queue, headlines -> Distribution Pack,
                // anything else -> copy preview to clipboard so the
                // user can paste it wherever they want.
                if (o.kind === "idea") { copyText(preview); showToast("Idea copied — routing to Capper."); onNav("captions"); }
                else if (o.kind === "caption" || o.kind === "thread") { copyText(preview); showToast("Copied — routing to Approval Queue."); onNav("approval"); }
                else if (o.kind === "headline") { copyText(preview); showToast("Headline copied — routing to Distribution Pack."); onNav("distpack"); }
                else { copyText(preview); showToast("Copied output preview to clipboard."); }
                onToggle();
              }} style={paletteItemStyle(false)}>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 2, minWidth: 0 }}>
                  <div style={{ fontFamily: ft, fontSize: 12, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</div>
                  <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>{o.kind.toUpperCase()} · from {o.sourceTool}</div>
                </div>
              </Command.Item>;
            })}
          </Command.Group>}

          {/* Jump to tool — every sidebar item, grouped by category. */}
          <Command.Group heading={"Jump to tool"}>
            <div style={{ padding: "6px 10px 4px", fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 2, textTransform: "uppercase" }}>Jump to tool</div>
            {getJumpItems().map(function(j) {
              var Icon = j.Icon;
              return <Command.Item key={"jump-" + j.id} value={"jump " + j.label + " " + j.catLabel} onSelect={function() {
                if (j.href) { window.open(j.href, "_blank"); }
                else { onNav(j.id); }
                onToggle();
              }} style={paletteItemStyle(false)}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, background: j.catColor + "12", border: "1px solid " + j.catColor + "30" }}>
                  <Icon size={12} strokeWidth={2} color={j.catColor} />
                </span>
                <span style={{ fontFamily: ft, fontSize: 13, color: C.tx, fontWeight: 500 }}>{j.label}</span>
                <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 8, fontWeight: 700, color: j.catColor, letterSpacing: 1.5 }}>{j.catLabel}</span>
              </Command.Item>;
            })}
          </Command.Group>
        </Command.List>

        {/* Footer hint chip — K / Enter / Esc */}
        <div style={{ borderTop: "1px solid " + C.border, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.35)" }}>
            <Kbd>K</Kbd> to search <span style={{ opacity: 0.6 }}>·</span> <Kbd>{"⏎"}</Kbd> select <span style={{ opacity: 0.6 }}>·</span> <Kbd>Esc</Kbd> close
          </div>
          <div style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>POAST 4.0 · palette</div>
        </div>
      </Command>

      {/* Keyboard shortcuts cheat-sheet — opened by the Quick action.
          Small overlay inside the palette so it doesn't fight z-index
          with the rest of the app. */}
      {kbdHelp && <div onClick={function() { setKbdHelp(false); }} style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div onClick={function(e: React.MouseEvent<HTMLElement>) { e.stopPropagation(); }} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px 20px", maxWidth: 360, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Keyboard shortcuts</div>
            <span onClick={function() { setKbdHelp(false); }} style={{ fontFamily: mn, fontSize: 14, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>&times;</span>
          </div>
          {[
            { keys: ["⌘", "K"], desc: "Open command palette" },
            { keys: ["⌘", "F"], desc: "Global search (coming, Phase 11F)" },
            { keys: ["Esc"], desc: "Close palette / modal" },
            { keys: ["⏎"], desc: "Select highlighted command" },
            { keys: ["↑", "↓"], desc: "Navigate commands" },
          ].map(function(row, i) {
            return <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 4 ? "1px solid " + C.border : "none" }}>
              <span style={{ fontFamily: ft, fontSize: 12, color: C.tx }}>{row.desc}</span>
              <span style={{ display: "flex", gap: 4 }}>{row.keys.map(function(k, j) { return <Kbd key={j}>{k}</Kbd>; })}</span>
            </div>;
          })}
        </div>
      </div>}
    </div>}

    {/* CHAT TAB — original AskPoast chat experience preserved verbatim
        as the secondary fallback mode. */}
    {tab === "chat" && <div ref={scrollRef} style={{ position: "relative", zIndex: 2, flex: 1, overflow: "auto", padding: "18px 20px" }}>
      {msgs.length === 0 && <div style={{ textAlign: "center", padding: "40px 16px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", border: "1px solid " + C.cyan + "30", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontFamily: mn, fontSize: 24, fontWeight: 900, color: "#060608", animation: "logoPulse 3s ease-in-out infinite, chipFloat 3s ease-in-out infinite", position: "relative" }}><span>{"\u2B21"}</span><span style={{ position: "absolute", fontSize: 10, bottom: 8, color: "#060608", fontWeight: 900 }}>{":3"}</span></div>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: "#E8E4DD", marginBottom: 6 }}>Hey! I'm Chippy</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 22, lineHeight: 1.6 }}>Your semiconductor sidekick. Ask me anything about content, semis, or strategy.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SUGGESTIONS.map(function(s, i) {
            return <span key={i} onClick={function() { setInput(s); }} style={{ fontFamily: ft, fontSize: 11, color: "rgba(255,255,255,0.45)", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "suggIn 0.3s ease " + (i * 0.08) + "s forwards", opacity: 0 }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = C.amber + "30"; e.currentTarget.style.color = "#E8E4DD"; e.currentTarget.style.background = C.amber + "06"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}>{s}</span>;
          })}
        </div>
      </div>}
      {msgs.map(function(m: ChatMessage, i: number) {
        var isUser = m.role === "user";
        return <div key={i} style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", animation: "msgSlide 0.3s ease" }}>
          {!isUser && <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 10, fontWeight: 900, color: "#060608" }}>{"\u2B21"}</div>
            <span style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)" }}>Chippy</span>
          </div>}
          <div style={{ maxWidth: "88%", padding: "12px 16px", borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px", background: isUser ? "linear-gradient(135deg, " + C.amber + "15, " + C.amber + "08)" : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", border: "1px solid " + (isUser ? C.amber + "20" : "rgba(255,255,255,0.06)"), boxShadow: isUser ? "0 2px 12px " + C.amber + "08" : "0 2px 8px rgba(0,0,0,0.2)" }}>
            <div style={{ fontFamily: ft, fontSize: 13, color: "#E8E4DD", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
          {!isUser && <div style={{ display: "flex", gap: 4, marginTop: 6, marginLeft: 26 }}>
            <span onClick={function() { navigator.clipboard.writeText(m.text); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)", padding: "3px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = C.amber; e.currentTarget.style.borderColor = C.amber + "25"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>Copy</span>
            <span onClick={function() { setInput("Regenerate the above but different"); }} style={{ fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.2)", padding: "3px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = C.amber; e.currentTarget.style.borderColor = C.amber + "25"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>Regenerate</span>
          </div>}
        </div>;
      })}
      {loading && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 10, fontWeight: 900, color: "#060608" }}>{"\u2B21"}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(function(i) { return <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.amber, opacity: 0.6, animation: "dotWave 1.2s ease-in-out " + (i * 0.15) + "s infinite" }} />; })}
        </div>
      </div>}
    </div>}

    {/* Chat input — only shown on Chat tab. Commands tab uses cmdk's
        own Command.Input above. */}
    {tab === "chat" && <div style={{ position: "relative", zIndex: 2, padding: "14px 16px 16px", borderTop: "1px solid rgba(38,201,216,0.06)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "5px 5px 5px 16px", transition: "all 0.25s", animation: "inputGlow 4s ease-in-out infinite" }}>
        <input value={input} onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setInput(e.target.value); }} onKeyDown={function(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything..." style={{ flex: 1, padding: "10px 0", background: "transparent", border: "none", color: "#E8E4DD", fontFamily: ft, fontSize: 13, outline: "none" }} />
        <span onClick={send} style={{ padding: "9px 16px", background: input.trim() ? "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")" : "rgba(255,255,255,0.06)", color: input.trim() ? C.bg : "rgba(255,255,255,0.2)", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s", boxShadow: input.trim() ? "0 4px 14px " + C.cyan + "30, 0 0 20px " + C.amber + "10" : "none" }}>Send</span>
      </div>
    </div>}
  </div>;
}

// ═══ CHIPPY SIDEBAR ═══
var CHIP_FACES = ["\u25A0\u203F\u25A0", "\u00B0\u25E1\u00B0", ">\u203F<", "\u00B0o\u00B0", "^\u203F^", "-\u203F-", "\u00D7\u203F\u00D7"];
var CHIP_MOODS = ["happy", "curious", "excited", "sleepy", "focused", "nappy", "vibing"];
var CHIP_MSGS = ["I love semiconductors!", "Did you check NVDA today?", "Ship that content!", "CoWoS capacity is wild.", "3nm is the future.", "Don't forget to post!", "I'm a chip off the old block.", "TSMC earnings soon...", "Need more GPU compute!", "Cache me if you can.", "Fab-ulous day!", "HBM4 is coming!", "Click me more!", "Let's make some slop!"];

function ChippySidebar({ onAsk }: { onAsk: () => void }) {
  var userCtx = useUser();
  // TODO(akash): Should Ask POAST be hidden or show a gated message for Analysts? Hiding for now.
  var analyst = isAnalyst(userCtx.user);
  var _face = useState<number>(0), face = _face[0], setFace = _face[1];
  var _mood = useState<number>(0), mood = _mood[0], setMood = _mood[1];
  var _msg = useState<string>("Click me!"), msg = _msg[0], setMsg = _msg[1];
  var _bouncing = useState<boolean>(false), bouncing = _bouncing[0], setBouncing = _bouncing[1];
  var _clicks = useState<number>(0), clicks = _clicks[0], setClicks = _clicks[1];

  useEffect(function() {
    var iv = setInterval(function() { setFace(function(f) { return (f + 1) % CHIP_FACES.length; }); }, 3500);
    return function() { clearInterval(iv); };
  }, []);

  var handleClick = function() {
    setBouncing(true);
    setFace(Math.floor(Math.random() * CHIP_FACES.length));
    setMood(Math.floor(Math.random() * CHIP_MOODS.length));
    setMsg(CHIP_MSGS[Math.floor(Math.random() * CHIP_MSGS.length)]);
    setClicks(function(c) { return c + 1; });
    setTimeout(function() { setBouncing(false); }, 500);
  };

  return <div style={{ padding: "12px 14px 0" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes chipBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes chipIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}" }} />
    <div style={{ padding: "14px 10px 10px", borderRadius: 12, background: "linear-gradient(135deg, rgba(38,201,216,0.06), rgba(247,176,65,0.04))", border: "1px solid rgba(38,201,216,0.15)", textAlign: "center" }}>
      {/* Chip character - clickable */}
      <div onClick={handleClick} style={{ display: "inline-block", cursor: "pointer", animation: bouncing ? "chipBounce 0.5s ease" : "chipIdle 2s ease-in-out infinite", userSelect: "none" }}>
        <div style={{ width: 80, height: 80, borderRadius: 12, background: "linear-gradient(145deg, #2A2A4A, #1A1A30)", border: "2px solid " + C.amber + "40", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: "0 0 24px " + C.amber + "15, 0 0 48px " + C.cyan + "08", position: "relative" }}>
          {/* Pins */}
          {[0, 1, 2, 3, 4].map(function(p) { return <div key={"b" + p} style={{ position: "absolute", bottom: -5, left: 8 + p * 14, width: 5, height: 7, background: C.amber + "60", borderRadius: "0 0 2px 2px" }} />; })}
          {[0, 1, 2, 3, 4].map(function(p) { return <div key={"t" + p} style={{ position: "absolute", top: -5, left: 8 + p * 14, width: 5, height: 7, background: C.amber + "60", borderRadius: "2px 2px 0 0" }} />; })}
          {[0, 1, 2].map(function(p) { return <div key={"l" + p} style={{ position: "absolute", left: -5, top: 14 + p * 20, width: 7, height: 5, background: C.cyan + "60", borderRadius: "2px 0 0 2px" }} />; })}
          {[0, 1, 2].map(function(p) { return <div key={"r" + p} style={{ position: "absolute", right: -5, top: 14 + p * 20, width: 7, height: 5, background: C.cyan + "60", borderRadius: "0 2px 2px 0" }} />; })}
          <div style={{ fontFamily: mn, fontSize: 20, color: C.amber, textShadow: "0 0 12px " + C.amber + "60" }}>{CHIP_FACES[face]}</div>
        </div>
      </div>
      {/* Message */}
      <div style={{ fontFamily: ft, fontSize: 11, color: C.tx, marginTop: 8, minHeight: 16 }}>{msg}</div>
      <div style={{ fontFamily: mn, fontSize: 8, color: C.txd, marginTop: 2 }}>Mood: {CHIP_MOODS[mood]} // Clicks: {clicks}</div>
      {/* Ask Chippy button — hidden for Analysts (Ask POAST queries data they shouldn't access). */}
      {!analyst && <div onClick={onAsk} style={{ marginTop: 8, padding: "8px 0", borderRadius: 8, cursor: "pointer", background: "linear-gradient(135deg, " + C.amber + ", " + C.cyan + ")", fontFamily: ft, fontSize: 12, fontWeight: 800, color: "#060608", letterSpacing: 0.5, transition: "all 0.2s" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.boxShadow = "0 0 16px " + C.amber + "40"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.boxShadow = "none"; }}>Ask Chippy</div>}
    </div>
  </div>;
}

// Floating bottom-right Chippy. Replaces the bulky ChippySidebar block.
// Tracks mouse position globally and ramps opacity based on distance to
// the widget — dim and unobtrusive when you're working, lights up when
// you bring your cursor near. Hidden entirely for analysts (Ask POAST
// queries data they shouldn't see).
function FloatingChippy({ onAsk }: { onAsk: () => void }) {
  var userCtx = useUser();
  var analyst = isAnalyst(userCtx.user);
  var _opacity = useState<number>(0.35), opacity = _opacity[0], setOpacity = _opacity[1];
  var _face = useState<number>(0), face = _face[0], setFace = _face[1];
  var _clicks = useState<number>(0), clicks = _clicks[0], setClicks = _clicks[1];
  var _bounce = useState<boolean>(false), bounce = _bounce[0], setBounce = _bounce[1];
  var ref = useRef<HTMLButtonElement | null>(null);
  var rafRef = useRef<number | null>(null);

  // Idle face shuffle — keeps the widget feeling alive even when ignored.
  useEffect(function() {
    if (analyst) return;
    var iv = setInterval(function() { setFace(function(f) { return (f + 1) % CHIP_FACES.length; }); }, 4500);
    return function() { clearInterval(iv); };
  }, [analyst]);

  // Proximity tracker. Calculates Cartesian distance from cursor to the
  // widget's center and maps that to opacity. 200px is the soft falloff
  // radius — past that, we sit at the dim floor (0.25). Within ~30px we
  // saturate to 1.0. rAF-throttled so mousemove doesn't thrash the render.
  useEffect(function() {
    if (analyst) return;
    var onMove = function(e: MouseEvent) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      var mx = e.clientX, my = e.clientY;
      rafRef.current = requestAnimationFrame(function() {
        var el = ref.current;
        if (!el) return;
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = mx - cx, dy = my - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        var near = Math.max(0.25, Math.min(1, 1 - (d - 30) / 200));
        setOpacity(near);
      });
    };
    window.addEventListener("mousemove", onMove);
    return function() {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyst]);

  if (analyst) return null;

  var handleClick = function() {
    setBounce(true);
    setFace(Math.floor(Math.random() * CHIP_FACES.length));
    setClicks(function(c) { return c + 1; });
    setTimeout(function() { setBounce(false); }, 500);
    onAsk();
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      title={"Ask Chippy · " + clicks + " clicks"}
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        zIndex: 9500,
        width: 58,
        height: 58,
        borderRadius: 16,
        background: "linear-gradient(145deg, #2A2A4A, #1A1A30)",
        border: "1px solid " + C.amber + "55",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 24px rgba(247,176,65,0.18), 0 0 48px rgba(38,201,216,0.10)",
        cursor: "pointer",
        opacity: opacity,
        transition: "opacity 0.18s ease, transform 0.16s ease",
        transform: bounce ? "translateY(-8px) scale(1.08)" : (opacity > 0.6 ? "translateY(-2px) scale(1.04)" : "translateY(0) scale(1)"),
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: mn,
        fontSize: 17,
        color: C.amber,
        textShadow: "0 0 10px " + C.amber + "70",
        userSelect: "none",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: "@keyframes fcPulse{0%,100%{box-shadow:0 8px 24px rgba(0,0,0,0.4), 0 0 0 0 rgba(247,176,65,0.18)}50%{box-shadow:0 8px 24px rgba(0,0,0,0.4), 0 0 24px 4px rgba(247,176,65,0.10)}}" }} />
      {/* Pin marks — keep the chip motif */}
      {[0, 1, 2].map(function(p) { return <span key={"fb" + p} style={{ position: "absolute", bottom: -4, left: 10 + p * 16, width: 4, height: 5, background: C.amber + "55", borderRadius: "0 0 1px 1px" }} />; })}
      {[0, 1, 2].map(function(p) { return <span key={"ft" + p} style={{ position: "absolute", top: -4, left: 10 + p * 16, width: 4, height: 5, background: C.amber + "55", borderRadius: "1px 1px 0 0" }} />; })}
      <span style={{ display: "inline-block" }}>{CHIP_FACES[face]}</span>
    </button>
  );
}

// ═══ SIDEBAR ═══
var SIDEBAR_CATS: Record<string, SidebarCat> = {
  produce: { label: "PRODUCE", color: C.amber, glow: "rgba(247,176,65,", Icon: Clapperboard, items: [
    { id: "production-studio", l: "ProductionSTUDIO", Icon: Clapperboard, href: "/production-studio", badge: "NEW" },
    { id: "brainstorm", l: "Brainstorm",     Icon: Lightbulb },
    { id: "carousel", l: "Carousel",         Icon: LayoutGrid },
    { id: "chart",    l: "ChartMAKER",       Icon: GanttChart, href: "/charts", badge: "NEW" },
    { id: "docu",     l: "DesignSTUDIO",     Icon: Wand,       href: "/design-studio", badge: "NEW" },
    { id: "copy-studio", l: "CopySTUDIO",   Icon: Type,       href: "/copy-studio", badge: "NEW" },
    { id: "assets",   l: "Asset Library",    Icon: Library },
  ]},
  podcast: { label: "PODCAST", color: C.coral, glow: "rgba(224,99,71,", Icon: Headphones, items: [
    { id: "fk",       l: "Fab Knowledge",    Icon: Headphones },
    { id: "weekly",   l: "SA Weekly",        Icon: Radio },
    { id: "outreach", l: "Outreach",         Icon: Send },
  ]},
  prepare: { label: "PREPARE", color: C.blue, glow: "rgba(11,134,209,", Icon: Brain, items: [
    { id: "intelligence-suite", l: "IntelligenceSUITE", Icon: Brain, href: "/intelligence-suite", badge: "NEW" },
    { id: "gtc",      l: "GTC Flow",         Icon: Activity },
  ]},
  premier: { label: "PREMIER", color: C.teal, glow: "rgba(46,173,142,", Icon: Calendar, items: [
    { id: "schedule", l: "Schedule",         Icon: Calendar, href: "https://brianna-bhakta.vercel.app/" },
  ]},
  admin:   { label: "ADMIN",   color: C.violet, glow: "rgba(144,92,203,", Icon: ShieldCheck, items: [
    { id: "marketing-suite", l: "MarketingSUITE", Icon: Rocket,    href: "/marketing-suite", badge: "NEW" },
    { id: "training", l: "AI Training",      Icon: Brain,          href: "/ai-training", badge: "NEW" },
    { id: "tasks",    l: "Task Board",       Icon: CheckSquare,    badge: "AKASH" },
    { id: "settings", l: "POAST Settings",   Icon: Settings },
  ]},
};

function Sidebar({ active, onNav, onAskPoast, collapsed, onToggleCollapsed }: { active: string; onNav: (id: string) => void; onAskPoast: () => void; collapsed: boolean; onToggleCollapsed: () => void }) {
  var userCtx = useUser();
  var analyst = isAnalyst(userCtx.user);
  var canDocu = canUseDocuDesign(userCtx.user);
  var akash = isAkash(userCtx.user);
  var router = useRouter();
  var pathname = usePathname();
  // Smart sidebar (mirrors the Stock mockup rail):
  //  • docked (!collapsed) → full 240px grouped list.
  //  • collapsed → 72px category-icon rail; hovering the rail shows a "pull to
  //    dock" arrow, and resting on a category (after an intent delay) pops a
  //    flyout of just that category's tools.
  var _railHov = useState(false), railHov = _railHov[0], setRailHov = _railHov[1];
  var _fly = useState<string | null>(null), flyCat = _fly[0], setFlyCat = _fly[1];
  var _flyTop = useState(0), flyTop = _flyTop[0], setFlyTop = _flyTop[1];
  var flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  var closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  var railTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  var expanded = !collapsed;
  function killFly() { if (flyTimer.current) { clearTimeout(flyTimer.current); flyTimer.current = null; } }
  function openFly(catKey: string, el: HTMLElement) {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    var r = el.getBoundingClientRect();
    setFlyTop(Math.max(64, Math.min(r.top - 4, window.innerHeight - 380)));
    setFlyCat(catKey);
  }
  // hover-intent: wait ~450ms before a category flies out (so it doesn't chase
  // the cursor); if one's already open, switch instantly.
  function onCatEnter(catKey: string, e: React.MouseEvent<HTMLElement>) {
    var el = e.currentTarget; killFly();
    if (flyCat) { openFly(catKey, el); }
    else { flyTimer.current = setTimeout(function() { openFly(catKey, el); }, 450); }
  }
  function scheduleFlyClose() { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(function() { setFlyCat(null); }, 200); }
  function railOn() { if (railTimer.current) { clearTimeout(railTimer.current); railTimer.current = null; } setRailHov(true); }
  function railOff() { if (railTimer.current) clearTimeout(railTimer.current); railTimer.current = setTimeout(function() { setRailHov(false); }, 160); }
  function filterItems(items: SidebarCatItem[]) { return items.filter(function(it) { return !analyst || ANALYST_ALLOWED.includes(it.id); }).filter(function(it) { return it.id !== "docu" || canDocu; }).filter(function(it) { return it.id !== "tasks" || akash; }); }
  function itemOpen(item: SidebarCatItem) { if (item.href) { window.open(item.href, "_blank"); } else { onNav(item.id); } setFlyCat(null); }
  useEffect(function() { return function() { killFly(); if (closeTimer.current) clearTimeout(closeTimer.current); if (railTimer.current) clearTimeout(railTimer.current); }; }, []);
  var goHome = function() {
    onNav("home");
    // For analysts inside their app, keep /analyst in the URL so back/forward
    // and bookmarks stay coherent. Non-analysts stay at whatever path they're on.
    if (analyst && pathname !== "/analyst") {
      try { router.replace("/analyst"); } catch (e) {}
    }
  };
  // Analysts only see PRODUCE
  var visibleCats = analyst ? ["produce"] : Object.keys(SIDEBAR_CATS);
  // Determine active category
  var activeCat: string | null = null;
  visibleCats.forEach(function(k) { SIDEBAR_CATS[k].items.forEach(function(it: SidebarCatItem) { if (it.id === active) activeCat = k; }); });

  return (<>
  <div
    className={expanded ? "sbx" : "sbx sbx-collapsed"}
    onMouseEnter={function() { railOn(); }}
    onMouseLeave={function() { railOff(); if (collapsed) scheduleFlyClose(); }}
    style={{ width: expanded ? 240 : 72, height: "100vh", background: "linear-gradient(180deg, #08080F 0%, #0A0A14 100%)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 100, transition: "width 0.22s cubic-bezier(0.3,0.7,0.3,1)", overflow: "hidden" }}>
    <style dangerouslySetInnerHTML={{ __html: ".sbx-lbl{transition:opacity .14s}.sbx-collapsed .sbx-lbl{display:none}.sbx-collapsed .sbx-cat{display:none}.sbx-collapsed .sbx-row{padding-left:0!important;justify-content:center}.sbx-collapsed .sbx-hidec{display:none}.sbx-collapsed .sbx-foot{justify-content:center}" }} />
    {/* Logo — click to go home (splash) without re-auth */}
    <div
      onClick={goHome}
      title="Home"
      style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: expanded ? "flex-start" : "center", gap: 10, cursor: "pointer", transition: "background 0.15s" }}
      onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "rgba(247,176,65,0.04)"; }}
      onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "transparent"; }}
    >
      <img src="/poast-logo.png" style={{ width: 32, height: 32, borderRadius: 7, flex: "none" }} />
      <div className="sbx-lbl">
        <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 900, color: C.amber, letterSpacing: 2 }}>POAST</div>
        <div style={{ fontFamily: ft, fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: 2, textTransform: "uppercase" }}>Content Command Center</div>
      </div>
      {/* dock/undock lives entirely in the edge arrow tab (below) — no header
          chevron, so the logo stays perfectly centered in the collapsed rail. */}
    </div>

    {/* Chippy moved to a floating widget at the bottom-right of the page
        (mounted at App root). The sidebar real estate it used to consume
        was making the rail feel crowded. */}

    {/* Categories — expanded: full grouped list · collapsed-idle: clean category-icon rail */}
    {expanded ? (
    <div style={{ padding: "8px 10px", flex: 1, overflow: "auto" }}>
      {visibleCats.map(function(catKey) {
        var cat = SIDEBAR_CATS[catKey];
        var isCatActive = activeCat === catKey;
        return <div key={catKey} style={{ marginBottom: 2 }}>
          {/* Category label */}
          <div className="sbx-cat" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px" }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: isCatActive ? cat.color : "rgba(255,255,255,0.12)", boxShadow: isCatActive ? "0 0 10px " + cat.color + "60, 0 0 20px " + cat.color + "20" : "none", transition: "all 0.25s" }} />
            <span style={{ fontFamily: ft, fontSize: 10, fontWeight: 800, color: isCatActive ? cat.color : "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.25s", textShadow: isCatActive ? "0 0 16px " + cat.glow + "0.4), 0 0 30px " + cat.glow + "0.12)" : "none" }}>{cat.label}</span>
          </div>
          {/* Items */}
          {cat.items.filter(function(it) { return !analyst || ANALYST_ALLOWED.includes(it.id); }).filter(function(it) { return it.id !== "docu" || canDocu; }).filter(function(it) { return it.id !== "tasks" || akash; }).map(function(item) {
            var isActive = active === item.id;
            return <div key={item.id} className="sbx-row" onClick={function() { if (item.href) { window.open(item.href, "_blank"); } else { onNav(item.id); } }} title={item.href ? "Open " + item.l + " in a new tab" : undefined} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 12px 7px 28px", borderRadius: 6, marginBottom: 1, cursor: "pointer", background: isActive ? cat.color + "0C" : "transparent", borderLeft: isActive ? "3px solid " + cat.color : "3px solid transparent", transition: "all 0.2s", position: "relative" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
              {isActive && <div style={{ position: "absolute", left: 0, top: "10%", width: 3, height: "80%", background: cat.color, borderRadius: 2, boxShadow: "0 0 12px " + cat.color + "70, 0 0 24px " + cat.color + "25" }} />}
              {isActive && <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "radial-gradient(ellipse at left center, " + cat.color + "08, transparent 70%)", pointerEvents: "none" }} />}
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, transition: "opacity 0.2s", opacity: isActive ? 1 : 0.55 }}>
                <item.Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} color={isActive ? cat.color : "rgba(255,255,255,0.65)"} />
              </span>
              <span className="sbx-lbl" style={{ fontFamily: ft, fontSize: 13, fontWeight: isActive ? 800 : 500, color: isActive ? cat.color : "rgba(255,255,255,0.5)", transition: "all 0.2s", textShadow: isActive ? "0 0 20px " + cat.glow + "0.5), 0 0 40px " + cat.glow + "0.12)" : "none" }}>{item.l}</span>
              {item.badge && <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 7, fontWeight: 800, color: cat.color, letterSpacing: 1, padding: "2px 5px", border: "1px solid " + cat.color + "55", borderRadius: 3, background: cat.color + "12" }}>{item.badge}</span>}
              {!item.badge && isActive && <div style={{ width: 5, height: 5, borderRadius: "50%", background: cat.color, marginLeft: "auto", boxShadow: "0 0 8px " + cat.color + "70, 0 0 16px " + cat.color + "30" }} />}
            </div>;
          })}
        </div>;
      })}
    </div>
    ) : (
    /* collapsed mini rail — clean category icons; rest on one (after an intent
       delay) to pop its flyout of tools; the lock arrow docks the rail open. */
    <div style={{ padding: "12px 0", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, overflow: "hidden" }}>
      {visibleCats.map(function(catKey) {
        var cat = SIDEBAR_CATS[catKey];
        var isCatActive = activeCat === catKey || flyCat === catKey;
        return <div key={catKey} title={cat.label}
          onMouseEnter={function(e) { onCatEnter(catKey, e); }}
          onMouseLeave={function() { killFly(); }}
          onClick={function(e) { onCatEnter(catKey, e); }}
          style={{ position: "relative", width: 46, height: 44, borderRadius: 12, display: "grid", placeItems: "center", cursor: "pointer", background: isCatActive ? cat.color + "1A" : "transparent", transition: "background .15s" }}>
          {isCatActive && <div style={{ position: "absolute", left: -2, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: 2, background: cat.color, boxShadow: "0 0 10px " + cat.color + "80" }} />}
          <cat.Icon size={20} strokeWidth={isCatActive ? 2.2 : 1.8} color={isCatActive ? cat.color : "rgba(255,255,255,0.62)"} />
        </div>;
      })}
    </div>
    )}

    {/* Brand Launch tile — miniature of the cover slide, opens /brand-launch */}
    <div className="sbx-hidec" style={{ padding: "0 10px 4px" }}>
      <BrandLaunchTile />
    </div>

    {/* Footer */}
    <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Bug report — captures the current sec automatically and lands in
          POAST Settings · Bugs. Analysts use it most; visible for everyone. */}
      <BugButton sec={active} />
      {/* User badge — click to sign out + return to the picker. Nulling
          the user context now re-shows the Intro picker via the useEffect
          in App (no full page reload). For Analyst the label reads "Lock";
          for admins it reads "Switch". A misclick is cheap to recover from. */}
      {userCtx.user && <div className="sbx-foot" onClick={function() { userCtx.setUser(null); }} title={analyst ? "Lock studio" : "Switch user"} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: analyst ? "#905CCB20" : C.amber + "20", border: "1px solid " + (analyst ? "#905CCB40" : C.amber + "40"), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 10, fontWeight: 800, color: analyst ? "#905CCB" : C.amber }}>{userCtx.user.name[0]}</div>
        <div className="sbx-lbl" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 700, color: "#E8E4DD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userCtx.user.name}</div>
          <div style={{ fontFamily: ft, fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>{userCtx.user.role}</div>
        </div>
        <span className="sbx-lbl" style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 1, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>{analyst ? "LOCK" : "SWITCH"}</span>
      </div>}
      <div className="sbx-lbl" style={{ fontFamily: ft, fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.12)", letterSpacing: 2 }}>v3.2 // SEMIANALYSIS</div>
    </div>
  </div>

  {/* edge arrow tab — appears while hovering the rail; the ONLY dock control.
      Collapsed → amber, points right (pull open). Docked → subtle, points left
      (collapse). No header chevron, so the logo stays centered. */}
  {railHov && (
    <button onClick={function() { killFly(); setFlyCat(null); railOff(); onToggleCollapsed(); }}
      onMouseEnter={railOn} onMouseLeave={railOff}
      title={collapsed ? "Pull to dock the sidebar open" : "Collapse the sidebar"}
      style={{ position: "fixed", left: collapsed ? 64 : 240, top: "50%", transform: "translateY(-50%)", zIndex: 104, width: 22, height: 46, borderRadius: "0 13px 13px 0", borderTop: collapsed ? "none" : "1px solid rgba(255,255,255,0.12)", borderRight: collapsed ? "none" : "1px solid rgba(255,255,255,0.12)", borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.12)", borderLeft: "none", background: collapsed ? ("linear-gradient(135deg, " + C.amber + ", " + C.amber + "aa)") : "rgba(18,18,26,0.96)", color: collapsed ? "#0b0b11" : C.amber, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: collapsed ? "6px 0 20px rgba(0,0,0,0.5)" : "4px 0 14px rgba(0,0,0,0.4)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} /></svg>
    </button>
  )}

  {/* category flyout — rest on a category icon in the collapsed rail */}
  {collapsed && flyCat ? (function() {
    var cat = SIDEBAR_CATS[flyCat as string]; if (!cat) return null;
    var col = cat.color;
    return <div onMouseEnter={function() { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } }}
      onMouseLeave={scheduleFlyClose}
      style={{ position: "fixed", left: 72, top: flyTop, zIndex: 105, width: 248, padding: 9, borderRadius: 16, background: "linear-gradient(180deg, rgba(17,17,25,0.98), rgba(10,10,16,0.99))", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 70px rgba(0,0,0,0.62)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 8px 9px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 6 }}>
        <div style={{ width: 4, height: 16, borderRadius: 2, background: col }} />
        <div style={{ fontFamily: gf, fontWeight: 700, fontSize: 14, color: "#E8E4DD", letterSpacing: 0.5 }}>{cat.label}</div>
      </div>
      {filterItems(cat.items).map(function(item) {
        var isActive = active === item.id;
        return <div key={item.id} onClick={function() { itemOpen(item); }} title={item.href ? "Open " + item.l + " in a new tab" : undefined}
          style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 9px", borderRadius: 11, cursor: "pointer", background: isActive ? col + "18" : "transparent", transition: "background .13s" }}
          onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", color: col, background: col + "16", border: "1px solid " + col + "2c" }}><item.Icon size={15} strokeWidth={1.9} /></span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: gf, fontWeight: 600, fontSize: 13, color: isActive ? col : "#E8E4DD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.l}</span>
          {item.badge && <span style={{ fontFamily: mn, fontSize: 7, fontWeight: 800, color: col, letterSpacing: 1, padding: "2px 5px", border: "1px solid " + col + "55", borderRadius: 999, flex: "none" }}>{item.badge}</span>}
          {item.href && !item.badge && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, flex: "none" }}>{"↗"}</span>}
        </div>;
      })}
    </div>;
  })() : null}
  </>);
}

// ═══ GLASS TOP NAV ═══
// Glass theme has no sidebar — navigation lives in a top bar with category
// buttons that drop down their tools (mirrors the mockup glass homebar).
// Reuses SIDEBAR_CATS + the same analyst/docu/akash visibility rules.
function GlassTopNav({ active, onNav }: { active: string; onNav: (id: string) => void }) {
  var userCtx = useUser();
  var analyst = isAnalyst(userCtx.user);
  var canDocu = canUseDocuDesign(userCtx.user);
  var akash = isAkash(userCtx.user);
  var _open = useState<string | null>(null), open = _open[0], setOpen = _open[1];
  var visibleCats = analyst ? ["produce"] : Object.keys(SIDEBAR_CATS);
  function itemClick(item: SidebarCatItem) { if (item.href) { window.open(item.href, "_blank"); } else { onNav(item.id); } setOpen(null); }
  return <div data-tour="glass-nav" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 52, zIndex: 100, display: "flex", alignItems: "center", gap: 4, padding: "0 16px", background: "rgba(10,10,18,0.55)", backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)", borderBottom: "1px solid var(--border)" }}>
    <div onClick={function() { onNav("home"); setOpen(null); }} title="Home" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginRight: 10 }}>
      <img src="/poast-logo.png" style={{ width: 26, height: 26, borderRadius: 6 }} />
      <span style={{ fontFamily: gf, fontWeight: 900, fontSize: 16, color: C.amber, letterSpacing: 1.5 }}>POAST</span>
    </div>
    {visibleCats.map(function(catKey) {
      var cat = SIDEBAR_CATS[catKey];
      var items = cat.items.filter(function(it) { return !analyst || ANALYST_ALLOWED.includes(it.id); }).filter(function(it) { return it.id !== "docu" || canDocu; }).filter(function(it) { return it.id !== "tasks" || akash; });
      if (!items.length) return null;
      var on = open === catKey;
      var hasActive = items.some(function(it) { return it.id === active; });
      return <div key={catKey} style={{ position: "relative" }} onMouseEnter={function() { setOpen(catKey); }} onMouseLeave={function() { setOpen(function(o) { return o === catKey ? null : o; }); }}>
        <button onClick={function() { setOpen(on ? null : catKey); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 10, border: "1px solid " + (on || hasActive ? cat.color + "55" : "transparent"), background: on || hasActive ? cat.color + "14" : "transparent", color: on || hasActive ? cat.color : "rgba(255,255,255,0.62)", cursor: "pointer", fontFamily: ft, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", transition: "all 0.15s" }}>{cat.label}</button>
        {on && <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 232, padding: 8, borderRadius: 14, background: "rgba(16,16,26,0.94)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
          {items.map(function(item) {
            var isA = active === item.id;
            return <div key={item.id} onClick={function() { itemClick(item); }} title={item.href ? "Open " + item.l + " in a new tab" : undefined} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, cursor: "pointer", background: isA ? cat.color + "16" : "transparent", color: isA ? cat.color : "rgba(255,255,255,0.72)" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { if (!isA) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { if (!isA) e.currentTarget.style.background = "transparent"; }}>
              <item.Icon size={15} color={isA ? cat.color : "rgba(255,255,255,0.6)"} />
              <span style={{ fontFamily: ft, fontSize: 13, fontWeight: isA ? 700 : 500 }}>{item.l}</span>
              {item.badge && <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 7, fontWeight: 800, color: cat.color, letterSpacing: 1, padding: "2px 5px", border: "1px solid " + cat.color + "55", borderRadius: 3 }}>{item.badge}</span>}
            </div>;
          })}
        </div>}
      </div>;
    })}
    <span style={{ flex: 1 }} />
    {userCtx.user && <div onClick={function() { userCtx.setUser(null); }} title="Switch user" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 10px", borderRadius: 999, border: "1px solid var(--border)" }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: C.amber + "20", border: "1px solid " + C.amber + "40", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 10, fontWeight: 800, color: C.amber }}>{userCtx.user.name[0]}</span>
      <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: C.tx }}>{userCtx.user.name}</span>
    </div>}
  </div>;
}

// ═══ CLIP CAPTIONS ═══


// ═══ INTRO: USER SELECT → BOOT → GLITCH → SPLASH ═══
// Two-path entry: "Analyst" goes straight to the analyst studio (no password).
// "Lock" prompts for a password and then shows a picker for the internal
// team (Akash, Michelle, Vansh, Daksh) who get the full site. The actual
// password check now lives in /api/auth/gate so the secret isn't baked
// into the client bundle.
interface InternalUserInfo { name: string; role: string; color: string; glow: string }
var INTERNAL_USERS: InternalUserInfo[] = [
  { name: "Akash",    role: "Brand and Creative Director", color: "#0B86D1", glow: "rgba(11,134,209,"  },
  { name: "Michelle", role: "Chief of Staff",              color: "#F7B041", glow: "rgba(247,176,65,"  },
  { name: "Vansh",    role: "Social Media Manager",        color: "#2EAD8E", glow: "rgba(46,173,142,"  },
  { name: "Daksh",    role: "Intern",                      color: "#905CCB", glow: "rgba(144,92,203,"  },
];
function UserSelect({ onSelect }: { onSelect: (name: string, remember?: boolean) => void }) {
  // Stage flow: "choose" (Analyst vs Lock tile) → "password" (if Lock) → "team" (Akash/Vansh/Michelle)
  var _stage = useState<"choose" | "password" | "team">("choose"), stage = _stage[0], setStage = _stage[1];
  var _pw = useState(""), pw = _pw[0], setPw = _pw[1];
  var _err = useState(false), err = _err[0], setErr = _err[1];
  var _hov = useState<string | null>(null), hov = _hov[0], setHov = _hov[1];
  // "Stay logged in on this computer" — defaults to true. When false we
  // route the auth into sessionStorage so closing the tab signs out.
  var _remember = useState(true), remember = _remember[0], setRemember = _remember[1];
  // If `?user=Akash` (or any valid name) is in the URL, skip the choose
  // tiles and land directly on the password step. On unlock we'll
  // auto-select that user without a second click on the team picker.
  var _prefill = useState<string | null>(null), prefill = _prefill[0], setPrefill = _prefill[1];

  useEffect(function() {
    try {
      var qs = new URLSearchParams(window.location.search);
      var u = qs.get("user");
      var valid = ["Akash", "Michelle", "Vansh", "Daksh", "Analyst"];
      if (u && valid.indexOf(u) >= 0) {
        if (u === "Analyst") {
          // Analyst path skips password entirely (matches the Analyst
          // tile on the choose stage).
          onSelect("Analyst", remember);
          return;
        }
        setPrefill(u);
        setStage("password");
        setTimeout(function() { var el = document.getElementById("gate-pw"); el && el.focus(); }, 30);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  var VIOLET = "#905CCB";

  var _checking = useState(false), checking = _checking[0], setChecking = _checking[1];
  var submitPw = async function() {
    if (checking) return;
    setChecking(true);
    var ok = false;
    try {
      var res = await fetch("/api/auth/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      ok = res.ok;
    } catch { /* network fail counts as wrong */ }
    setChecking(false);
    if (ok) {
      setPw("");
      setErr(false);
      if (prefill) {
        // URL pre-fill path: skip the team picker, sign in immediately.
        onSelect(prefill, remember);
        return;
      }
      setStage("team");
    } else {
      setErr(true);
      setPw("");
      setTimeout(function() { setErr(false); }, 600);
    }
  };

  return <div style={{ position: "fixed", inset: 0, background: "radial-gradient(950px 660px at 16% 4%, rgba(247,176,65,0.16), transparent 66%), radial-gradient(1050px 720px at 88% 96%, rgba(144,92,203,0.16), transparent 68%), radial-gradient(820px 600px at 74% 12%, rgba(38,201,216,0.08), transparent 66%), #070611", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center", zIndex: 9999, overflowY: "auto", overflowX: "hidden", padding: "48px 20px" }}>
    <style dangerouslySetInnerHTML={{ __html: [
      "@keyframes wfade{0%{opacity:0;transform:translateY(18px)}100%{opacity:1;transform:translateY(0)}}",
      "@keyframes wpop{0%{opacity:0;transform:translateY(20px) scale(0.94)}100%{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes worbA{0%,100%{transform:translate(0,0) scale(1);opacity:0.55}50%{transform:translate(40px,-30px) scale(1.15);opacity:0.85}}",
      "@keyframes worbB{0%,100%{transform:translate(0,0) scale(1);opacity:0.45}50%{transform:translate(-50px,40px) scale(1.18);opacity:0.75}}",
      "@keyframes worbC{0%,100%{transform:translate(0,0) scale(1);opacity:0.4}50%{transform:translate(30px,30px) scale(1.1);opacity:0.7}}",
      "@keyframes wshim{0%{background-position:0% 50%}100%{background-position:200% 50%}}",
      "@keyframes pwShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}",
      ".w-headline{background:linear-gradient(120deg,#F7B041 0%,#E06347 40%,#905CCB 72%,#F7B041 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:wfade 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s forwards,wshim 8s ease-in-out infinite;opacity:0}",
    ].join("") }} />

    {/* Ambient orbs — three drifting blooms behind everything */}
    <div style={{ position: "absolute", width: "70vw", height: "70vw", maxWidth: 900, maxHeight: 900, top: "-15%", right: "-10%", borderRadius: "50%", background: "radial-gradient(circle, " + (hov === "Analyst" ? "rgba(144,92,203,0.18)" : hov === "Lock" ? "rgba(247,176,65,0.15)" : "rgba(247,176,65,0.10)") + " 0%, transparent 60%)", filter: "blur(60px)", transition: "background 0.6s ease", animation: "worbA 18s ease-in-out infinite", pointerEvents: "none" }} />
    <div style={{ position: "absolute", width: "60vw", height: "60vw", maxWidth: 800, maxHeight: 800, bottom: "-15%", left: "-10%", borderRadius: "50%", background: "radial-gradient(circle, " + (hov === "Analyst" ? "rgba(144,92,203,0.10)" : "rgba(11,134,209,0.08)") + " 0%, transparent 60%)", filter: "blur(80px)", transition: "background 0.6s ease", animation: "worbB 22s ease-in-out infinite", pointerEvents: "none" }} />
    <div style={{ position: "absolute", width: "40vw", height: "40vw", maxWidth: 600, maxHeight: 600, top: "30%", left: "20%", borderRadius: "50%", background: "radial-gradient(circle, rgba(144,92,203,0.06) 0%, transparent 60%)", filter: "blur(70px)", animation: "worbC 16s ease-in-out infinite", pointerEvents: "none" }} />

    <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 720, width: "100%" }}>

      {stage === "choose" && (<>
        {/* Tiny eyebrow + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, animation: "wfade 0.6s ease 0.15s forwards", opacity: 0 }}>
          <img src="/poast-logo.png" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: 4, textTransform: "uppercase" }}>POAST</div>
        </div>

        {/* Big gradient headline */}
        <h1 className="w-headline" style={{ fontFamily: gf, fontSize: "clamp(56px, 11vw, 112px)", fontWeight: 900, lineHeight: 0.98, letterSpacing: -3, margin: 0, marginBottom: 16 }}>
          Welcome.
        </h1>

        {/* Subtitle */}
        <div style={{ fontFamily: ft, fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 500, color: "rgba(232,228,221,0.6)", lineHeight: 1.55, maxWidth: 540, marginBottom: 48, animation: "wfade 0.7s ease 0.55s forwards", opacity: 0 }}>
          The content production suite for SemiAnalysis. Pick how you're entering.
        </div>

        {/* Tiles */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {/* Analyst */}
          <div
            key="Analyst"
            onClick={function() { onSelect("Analyst"); }}
            onMouseEnter={function() { setHov("Analyst"); }}
            onMouseLeave={function() { setHov(null); }}
            style={{ width: 240, padding: "40px 24px", borderRadius: 18, cursor: "pointer", background: hov === "Analyst" ? VIOLET + "0F" : "#0A0A14", border: "1px solid " + (hov === "Analyst" ? VIOLET + "70" : "rgba(255,255,255,0.08)"), textAlign: "center", transition: "all 0.28s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: hov === "Analyst" ? "0 0 50px " + VIOLET + "30, 0 24px 60px -12px " + VIOLET + "40" : "0 4px 20px rgba(0,0,0,0.3)", animation: "wpop 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.85s forwards", opacity: 0, transform: hov === "Analyst" ? "translateY(-6px)" : "translateY(0)" }}
          >
            <div style={{ width: 72, height: 72, borderRadius: 18, background: hov === "Analyst" ? VIOLET + "26" : "#0F0F1A", border: "1px solid " + (hov === "Analyst" ? VIOLET + "60" : "rgba(255,255,255,0.08)"), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", transition: "all 0.28s", fontFamily: gf, fontSize: 30, fontWeight: 900, color: hov === "Analyst" ? VIOLET : "rgba(255,255,255,0.6)", boxShadow: hov === "Analyst" ? "0 0 32px " + VIOLET + "45, inset 0 0 20px " + VIOLET + "10" : "none" }}>
              A
            </div>
            <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: hov === "Analyst" ? VIOLET : "#E8E4DD", letterSpacing: -0.4, marginBottom: 6, transition: "color 0.28s" }}>Analyst</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: hov === "Analyst" ? VIOLET + "BB" : "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", transition: "color 0.28s" }}>Open studio</div>
          </div>
          {/* Team — password-gated */}
          <div
            key="Lock"
            onClick={function() { setStage("password"); setTimeout(function() { var el = document.getElementById("gate-pw"); el && el.focus(); }, 30); }}
            onMouseEnter={function() { setHov("Lock"); }}
            onMouseLeave={function() { setHov(null); }}
            style={{ width: 240, padding: "40px 24px", borderRadius: 18, cursor: "pointer", background: hov === "Lock" ? C.amber + "0F" : "#0A0A14", border: "1px solid " + (hov === "Lock" ? C.amber + "70" : "rgba(255,255,255,0.08)"), textAlign: "center", transition: "all 0.28s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: hov === "Lock" ? "0 0 50px rgba(247,176,65,0.30), 0 24px 60px -12px rgba(247,176,65,0.4)" : "0 4px 20px rgba(0,0,0,0.3)", animation: "wpop 0.7s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards", opacity: 0, transform: hov === "Lock" ? "translateY(-6px)" : "translateY(0)" }}
          >
            <div style={{ width: 72, height: 72, borderRadius: 18, background: hov === "Lock" ? C.amber + "26" : "#0F0F1A", border: "1px solid " + (hov === "Lock" ? C.amber + "60" : "rgba(255,255,255,0.08)"), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", transition: "all 0.28s", boxShadow: hov === "Lock" ? "0 0 32px rgba(247,176,65,0.45), inset 0 0 20px rgba(247,176,65,0.10)" : "none" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={hov === "Lock" ? C.amber : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.28s" }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11 V7 a5 5 0 0 1 10 0 v4" />
              </svg>
            </div>
            <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: hov === "Lock" ? C.amber : "#E8E4DD", letterSpacing: -0.4, marginBottom: 6, transition: "color 0.28s" }}>Marketing Team</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: hov === "Lock" ? C.amber + "BB" : "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase", transition: "color 0.28s" }}>Password required</div>
          </div>
        </div>

        {/* Bottom accent */}
        <div style={{ marginTop: 56, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 3, animation: "wfade 0.7s ease 1.3s forwards", opacity: 0 }}>
          SEMIANALYSIS // CONTENT COMMAND CENTER
        </div>
      </>)}

      {stage === "password" && (<>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, animation: "wfade 0.5s ease forwards", opacity: 0 }}>
          <img src="/poast-logo.png" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: 4, textTransform: "uppercase" }}>POAST</div>
        </div>
        <h1 className="w-headline" style={{ fontFamily: gf, fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 900, lineHeight: 0.98, letterSpacing: -2, margin: 0, marginBottom: 12 }}>
          Marketing.
        </h1>
        <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: "rgba(232,228,221,0.55)", lineHeight: 1.55, marginBottom: 36, animation: "wfade 0.6s ease 0.5s forwards", opacity: 0 }}>
          Enter the team password.
        </div>
        <div style={{ width: 320, maxWidth: "92vw", animation: "wpop 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.7s forwards", opacity: 0 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: err ? "rgba(224,99,71,0.20)" : C.amber + "22", border: "1px solid " + (err ? "rgba(224,99,71,0.5)" : C.amber + "50"), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", transition: "background 0.22s, border-color 0.22s", boxShadow: "0 0 24px " + (err ? "rgba(224,99,71,0.3)" : "rgba(247,176,65,0.35)"), animation: err ? "pwShake 0.45s" : undefined }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={err ? "#E06347" : C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11 V7 a5 5 0 0 1 10 0 v4" />
            </svg>
          </div>
          <input id="gate-pw" type="password" value={pw} onChange={function(e) { setPw(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") submitPw(); if (e.key === "Escape") { setStage("choose"); setPw(""); setErr(false); } }} placeholder="Password" autoFocus style={{ width: "100%", padding: "14px 16px", background: "#0A0A14", border: "1px solid " + (err ? "rgba(224,99,71,0.6)" : "rgba(255,255,255,0.1)"), borderRadius: 10, color: "#E8E4DD", fontFamily: mn, fontSize: 14, letterSpacing: 3, textAlign: "center", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} />

          {/* Stay logged in on this computer */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={remember} onChange={function(e) { setRemember(e.target.checked); }} style={{ accentColor: C.amber, cursor: "pointer", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontFamily: ft, fontSize: 12, color: "#E8E4DD", fontWeight: 600 }}>Stay logged in on this computer</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 0.4, marginTop: 2 }}>{remember ? "Persists across browser restarts" : "Just this session — sign out on tab close"}</div>
            </div>
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={function() { setStage("choose"); setPw(""); setErr(false); }} style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontFamily: mn, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}>Back</button>
            <button onClick={submitPw} style={{ flex: 2, padding: "10px 12px", background: C.amber, border: "none", borderRadius: 8, color: "#060608", fontFamily: mn, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", fontWeight: 800 }}>Unlock →</button>
          </div>
          {err && <div style={{ fontFamily: mn, fontSize: 10, color: "#E06347", marginTop: 12, textAlign: "center", letterSpacing: 1 }}>Incorrect password</div>}
          {prefill && <div style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 14, textAlign: "center", letterSpacing: 0.4 }}>Signing in as <span style={{ color: C.amber, fontWeight: 700 }}>{prefill}</span> after unlock</div>}
        </div>
      </>)}

      {stage === "team" && (<>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, animation: "wfade 0.5s ease forwards", opacity: 0 }}>
          <img src="/poast-logo.png" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <div style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: 4, textTransform: "uppercase" }}>POAST</div>
        </div>
        <h1 className="w-headline" style={{ fontFamily: gf, fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 900, lineHeight: 0.98, letterSpacing: -2, margin: 0, marginBottom: 12 }}>
          Welcome back.
        </h1>
        <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: "rgba(232,228,221,0.55)", lineHeight: 1.55, marginBottom: 40, animation: "wfade 0.6s ease 0.5s forwards", opacity: 0 }}>
          Pick yourself.
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", maxWidth: "min(820px, 92vw)" }}>
          {INTERNAL_USERS.map(function(user, i) {
            var on = hov === user.name;
            var uc = user.color;
            return <div
              key={user.name}
              onClick={function() { onSelect(user.name, remember); }}
              onMouseEnter={function() { setHov(user.name); }}
              onMouseLeave={function() { setHov(null); }}
              style={{ width: 170, padding: "30px 20px", borderRadius: 14, cursor: "pointer", background: on ? uc + "0F" : "#0A0A14", border: "1px solid " + (on ? uc + "60" : "rgba(255,255,255,0.06)"), textAlign: "center", transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: on ? "0 0 36px " + uc + "26, 0 16px 40px -10px " + uc + "30" : "0 4px 16px rgba(0,0,0,0.25)", animation: "wpop 0.55s cubic-bezier(0.16, 1, 0.3, 1) " + (0.7 + i * 0.08) + "s forwards", opacity: 0, transform: on ? "translateY(-4px)" : "translateY(0)" }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 14, background: on ? uc + "26" : "#0F0F1A", border: "1px solid " + (on ? uc + "55" : "rgba(255,255,255,0.06)"), display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontFamily: gf, fontSize: 22, fontWeight: 900, color: on ? uc : "rgba(255,255,255,0.5)", transition: "all 0.25s", boxShadow: on ? "0 0 20px " + uc + "35" : "none" }}>{user.name[0]}</div>
              <div style={{ fontFamily: gf, fontSize: 17, fontWeight: 800, color: on ? uc : "#E8E4DD", letterSpacing: -0.3, transition: "color 0.25s", textShadow: on ? "0 0 16px " + user.glow + "0.35)" : "none" }}>{user.name}</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: on ? uc + "AA" : "rgba(255,255,255,0.35)", marginTop: 6, letterSpacing: 0.5, transition: "color 0.25s" }}>{user.role}</div>
            </div>;
          })}
        </div>

        {/* Stay logged in checkbox — visible here so people landing on the
            team picker without `?user=` can still opt in/out. */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 28, padding: "8px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 999, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={remember} onChange={function(e) { setRemember(e.target.checked); }} style={{ accentColor: C.amber, cursor: "pointer" }} />
          <span style={{ fontFamily: mn, fontSize: 11, color: "rgba(232,228,221,0.7)", letterSpacing: 0.4 }}>{remember ? "Stay logged in on this computer" : "Just this session (sign out on tab close)"}</span>
        </label>
      </>)}

    </div>
  </div>;
}

function TerminalBoot({ user, onDone }: { user: string | null; onDone: () => void }) {
  var _lines = useState<BootLine[]>([]), lines = _lines[0], setLines = _lines[1];
  var bootLines: BootLine[] = [
    { t: "POAST OS v0.8 // SemiAnalysis", c: "rgba(255,255,255,0.2)" },
    { t: "Auth: " + user, c: "rgba(255,255,255,0.2)" }, { t: "  [OK] identity", c: "#2EAD8E" },
    { t: "Initializing semiconductor intelligence...", c: "rgba(255,255,255,0.2)" },
    { t: "Loading TSMC wafer allocation data...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] content-engine", c: "#2EAD8E" }, { t: "  [OK] claude-sonnet-4.brain", c: "#2EAD8E" },
    { t: "Connecting to Jensen's leather jacket...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] grok-imagine.gpu", c: "#2EAD8E" }, { t: "  [OK] elevenlabs-voice", c: "#2EAD8E" },
    { t: "Calibrating HBM pricing models...", c: "rgba(255,255,255,0.2)" },
    { t: "Syncing with Fab 18 production schedule...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] fab18-sync", c: "#2EAD8E" },
    { t: "Downloading ASML EUV lens alignment...", c: "rgba(255,255,255,0.2)" },
    { t: "Parsing NVIDIA earnings call transcripts...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] earnings-parser", c: "#2EAD8E" },
    { t: "Compiling export control compliance matrix...", c: "rgba(255,255,255,0.2)" },
    { t: "Establishing secure channel to Doug's brain...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] doug-brain-link", c: "#2EAD8E" },
    { t: "Loading Dylan's Twitter draft folder...", c: "rgba(255,255,255,0.2)" },
    { t: "Indexing 47,000 semiconductor datasheets...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] datasheet-index", c: "#2EAD8E" },
    { t: "Warming up Claude's silicon knowledge...", c: "rgba(255,255,255,0.2)" },
    { t: "Checking CoWoS capacity utilization...", c: "rgba(255,255,255,0.2)" },
    { t: "Verifying HBM4 stack height calculations...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] hbm4-verify", c: "#2EAD8E" },
    { t: "Decrypting Samsung yield data...", c: "rgba(255,255,255,0.2)" },
    { t: "Mapping global fab construction sites...", c: "rgba(255,255,255,0.2)" },
    { t: "Aggregating analyst sentiment vectors...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] sentiment-agg", c: "#2EAD8E" },
    { t: "Rendering amber glow particles...", c: "rgba(255,255,255,0.2)" },
    { t: "  [OK] vibes.essential", c: "#2EAD8E" },
    // TODO(akash): These per-user boot lines are guesses for tone — review the Analyst flavor copy.
    user === "Vansh"
      ? { t: "  [ALERT] vansh-just-farted.exe", c: "#E06347" }
      : user === "Analyst"
        ? { t: "  [OK] pure-creation-mode.init", c: "#905CCB" }
        : { t: "  [WARN] max-charisma-detected", c: C.amber },
    { t: "  [FAIL] sleep-schedule: not found", c: "#E06347" },
    { t: "Booting content command center...", c: "rgba(255,255,255,0.2)" },
    { t: "", c: "rgba(255,255,255,0.2)" }, { t: "POAST systems nominal. Welcome back.", c: C.amber },
  ];
  useEffect(function() {
    var d = 0;
    bootLines.forEach(function(l) { d += 50; setTimeout(function() { setLines(function(p) { return p.concat([l]); }); }, d); });
    setTimeout(onDone, d + 400);
  }, []);
  return <div style={{ position: "fixed", inset: 0, background: "#06060C", zIndex: 9999, padding: "30px 40px", fontFamily: mn, fontSize: 12, lineHeight: 1.9 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes cb{0%,100%{opacity:1}50%{opacity:0}}" }} />
    {lines.map(function(l, i) { return <div key={i} style={{ color: l.c }}>{l.t || "\u00A0"}</div>; })}
    <span style={{ display: "inline-block", width: 7, height: 14, background: C.amber, animation: "cb 0.8s step-end infinite" }} />
  </div>;
}

function GlitchTransition({ onDone }: { onDone: () => void }) {
  useEffect(function() { setTimeout(onDone, 350); }, []);
  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes gShake{0%{transform:translate(0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,3px)}100%{transform:translate(0)}}@keyframes gFade{to{opacity:0}}" }} />
    <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.06, animation: "gFade 0.2s ease forwards" }} />
    <div style={{ position: "absolute", inset: 0, animation: "gShake 0.25s linear" }}>
      {[20, 45, 70, 85].map(function(t, i) { return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: t + "%", height: 2 + Math.random() * 3, background: i % 2 === 0 ? "#ff000030" : "#00ff0030" }} />; })}
    </div>
  </div>;
}

// Director / Marketing home. Clean grid of every tool grouped by section.
// Replaces the half-finished hover-to-expand design that was hidden behind
// the old useState("weekly") default — it never got real user testing
// because nobody actually landed here. Built to match the polish of
// AnalystSplash with category coloring, hover lift, and a calm hero.
function SplashScreen({ onNavigate }: { onNavigate: (id: string) => void }) {
  var userCtx = useUser();
  var canDocu = canUseDocuDesign(userCtx.user);
  // Each section uses its own accent so the page reads at a glance:
  // amber=produce, coral=podcast, blue=prepare, teal=premier, violet=admin.
  var sections: Array<{ key: string; label: string; sub: string; color: string; tiles: { id: string; label: string; sub: string; Icon: LucideIcon; href?: string }[] }> = [
    { key: "produce", label: "Produce", sub: "Make the content", color: C.amber, tiles: [
      { id: "sloptop",  label: "Slop Top",      sub: "Brief gen + arxiv.lol",   Icon: Zap },
      { id: "carousel", label: "Carousel",      sub: "Instagram carousels",     Icon: LayoutGrid },
      { id: "captions", label: "Capper",        sub: "Captions per platform",   Icon: Captions },
      { id: "p2p",      label: "Press to Premier", sub: "Video production briefs", Icon: Clapperboard },
      { id: "broll",    label: "B-Roll",        sub: "Generated b-roll library", Icon: Film },
      { id: "chart",    label: "Chart Maker",   sub: "Quick charts",            Icon: BarChart3 },
      { id: "chart2",   label: "POAST Studio",  sub: "Charts, tables, diagrams · saved library", Icon: GanttChart, href: "/charts" },
      { id: "copy-studio", label: "CopySTUDIO", sub: "Draft · voice · headline · distribution", Icon: Type, href: "/copy-studio" },
    ] },
    { key: "podcast", label: "Podcast", sub: "SA Weekly + FK", color: C.coral, tiles: [
      { id: "fk",       label: "Fab Knowledge", sub: "Doug's interview prep",   Icon: Headphones },
      { id: "weekly",   label: "SA Weekly",     sub: "Episode → launch kit",    Icon: Radio },
      { id: "outreach", label: "Outreach",      sub: "Guest cold emails",       Icon: Send },
    ] },
    { key: "prepare", label: "Prepare", sub: "Find the angle", color: C.blue, tiles: [
      { id: "intelligence-suite", label: "IntelligenceSUITE", sub: "Command center for trends, signals, ideas", Icon: Brain, href: "/intelligence-suite" },
      { id: "news",     label: "News Flow",     sub: "Drafts from headlines",   Icon: Newspaper },
      { id: "gtc",      label: "GTC Flow",      sub: "Conference desk",         Icon: Activity },
    ] },
    { key: "premier", label: "Premier", sub: "Schedule + ship", color: C.teal, tiles: [
      { id: "schedule", label: "Schedule",      sub: "Buffer queue",            Icon: Calendar },
      { id: "approval", label: "Approval Queue", sub: "Pending sign-offs",      Icon: ClipboardCheck },
      { id: "perf",     label: "Performance",   sub: "What's actually landing", Icon: TrendingUp },
      { id: "assets",   label: "Asset Library", sub: "Logos, fonts, brand kit", Icon: Library },
    ] },
    { key: "admin",   label: "Admin",   sub: "Tune the studio", color: C.violet, tiles: [
      { id: "training", label: "AI Training",   sub: "Brand voice + multi-AI lab", Icon: Brain, href: "/ai-training" },
      { id: "prompts",  label: "Saved Prompts", sub: "Reusable prompt library",  Icon: BookmarkCheck },
      { id: "settings", label: "POAST Settings", sub: "Analytics + onboarding",  Icon: Settings },
    ] },
  ];

  // DesignStudio sits with Produce when the role can use it. Hides for any
  // role that fails canUseDocuDesign (Analyst).
  if (canDocu) sections[0].tiles.push({ id: "docu", label: "DesignStudio", sub: "Docs · graphics · images · motion · rebuild from image", Icon: Wand, href: "/design-studio" });
  // Akash-only: Task Board with multi-view planner + Focus Mode goes
  // under Admin so it doesn't crowd the daily creative tiles.
  if (isAkash(userCtx.user)) {
    sections[sections.length - 1].tiles.unshift({ id: "tasks", label: "Task Board", sub: "Daily planner + Focus Mode", Icon: CheckSquare });
  }

  return <div style={{ minHeight: "100%", padding: "80px 0 64px", position: "relative" }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes ssRise{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}@keyframes ssShim{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}.ss-headline{background:linear-gradient(120deg,#F7B041 0%,#26C9D8 50%,#F7B041 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:ssShim 8s ease-in-out infinite}" }} />

    {/* Hero — given room to breathe + a soft lift glow behind the welcome */}
    <div style={{ animation: "ssRise 0.5s ease forwards", opacity: 0, marginBottom: 64, position: "relative" }}>
      <div style={{ position: "absolute", left: -60, top: -56, width: 620, height: 280, background: "radial-gradient(58% 64% at 22% 42%, rgba(247,176,65,0.12), rgba(38,201,216,0.05) 55%, transparent 72%)", filter: "blur(18px)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <img src="/poast-logo.png" alt="" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <div style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: 4, textTransform: "uppercase" }}>POAST</div>
        </div>
        <h1 className="ss-headline" style={{ fontFamily: gf, fontSize: "clamp(52px, 8.5vw, 104px)", fontWeight: 900, lineHeight: 0.98, letterSpacing: -2.5, margin: 0, marginBottom: 20 }}>
          Welcome back{userCtx.user ? ", " + userCtx.user.name : ""}.
        </h1>
        <div style={{ fontFamily: ft, fontSize: 17, fontWeight: 500, color: "rgba(232,228,221,0.6)", maxWidth: 660, lineHeight: 1.6 }}>
          Pick where you're working today. Your sidebar has every tool — this grid is the same set, grouped by what they're for.
        </div>
      </div>
      <div style={{ marginTop: 34, height: 1, background: "linear-gradient(90deg, " + C.amber + "55, rgba(255,255,255,0.07) 38%, transparent 80%)" }} />
    </div>

    {/* Sections */}
    {sections.map(function(section, sIdx) {
      return <div key={section.key} style={{ marginBottom: 44, animation: "ssRise 0.5s ease " + (0.15 + sIdx * 0.08) + "s forwards", opacity: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16, paddingLeft: 4 }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: section.color, boxShadow: "0 0 12px " + section.color + "55, 0 0 24px " + section.color + "20", display: "inline-block", alignSelf: "center" }} />
          <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: section.color, letterSpacing: -0.4, textShadow: "0 0 20px " + section.color + "40" }}>{section.label}</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.30)", letterSpacing: 1.5, textTransform: "uppercase" }}>{section.sub}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {section.tiles.map(function(tile) {
            return <SplashTile key={tile.id} tile={tile} color={section.color} onNavigate={onNavigate} />;
          })}
        </div>
      </div>;
    })}

    {/* Footer */}
    <div style={{ marginTop: 56, textAlign: "center", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: 3, animation: "ssRise 0.5s ease 0.6s forwards", opacity: 0 }}>
      SEMIANALYSIS // CONTENT COMMAND CENTER
    </div>
  </div>;
}

// One tile in the director home grid. Hover lifts + glows in the section's
// accent. External tools (href) open in a new tab; everything else is an
// in-app sec navigation.
function SplashTile({ tile, color, onNavigate }: { tile: { id: string; label: string; sub: string; Icon: LucideIcon; href?: string }; color: string; onNavigate: (id: string) => void }) {
  var _hov = useState(false), hov = _hov[0], setHov = _hov[1];
  // Off-Classic themes use a translucent, blurred panel (mockup .ctile) with a
  // per-accent tint so the aurora reads behind/between tiles. Classic keeps the
  // flat opaque hex — byte-identical.
  var nc = useTheme().theme !== "classic";
  var click = function() { if (tile.href) window.open(tile.href, "_blank"); else onNavigate(tile.id); };
  var restBg = nc ? "linear-gradient(160deg, rgba(255,255,255,0.03), transparent), rgba(13,12,22,0.72)" : "#0A0A0F";
  var hovBg = nc ? "linear-gradient(160deg, " + color + "20, " + color + "08), rgba(16,15,26,0.80)" : "linear-gradient(135deg, " + color + "12, " + color + "04)";
  var restChipBg = nc ? color + "16" : "#0F0F1A";
  var restChipBorder = nc ? color + "33" : "rgba(255,255,255,0.06)";
  return <button
    onClick={click}
    onMouseEnter={function() { setHov(true); }}
    onMouseLeave={function() { setHov(false); }}
    style={{
      width: "100%", textAlign: "left", cursor: "pointer",
      background: hov ? hovBg : restBg,
      backdropFilter: nc ? "blur(7px)" : undefined,
      WebkitBackdropFilter: nc ? "blur(7px)" : undefined,
      border: "1px solid " + (hov ? color + "60" : (nc ? color + "20" : "rgba(255,255,255,0.06)")),
      borderRadius: 14, padding: "20px 18px",
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14,
      transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
      transform: hov ? "translateY(-3px)" : "translateY(0)",
      boxShadow: hov ? "0 16px 36px -10px " + color + "30, 0 0 24px " + color + "12" : "0 2px 12px rgba(0,0,0,0.3)",
      fontFamily: ft,
    }}
  >
    <div style={{
      width: 44, height: 44, borderRadius: 11,
      background: hov ? color + "1F" : restChipBg,
      border: "1px solid " + (hov ? color + "55" : restChipBorder),
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.22s",
      boxShadow: hov ? "0 0 16px " + color + "30, inset 0 0 12px " + color + "08" : "none",
    }}>
      <tile.Icon size={20} strokeWidth={hov ? 2.1 : 1.8} color={color} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: gf, fontSize: 17, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.3, marginBottom: 3 }}>{tile.label}</div>
      <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 500, color: hov ? color : "rgba(255,255,255,0.40)", transition: "color 0.22s", lineHeight: 1.45 }}>{tile.sub}</div>
    </div>
  </button>;
}

// ═══ ANALYST SPLASH — iPhone-home-screen-style tile grid ═══
// 3D mouse-tilt tile for the Analyst splash. Tracks cursor position inside the
// tile, applies perspective rotation + a moving specular highlight, resets on
// leave. Entrance animation via asTile keyframes (defined on parent).
// onHoverColor lifts the active color to the parent splash so the whole screen
// can glow in that hue while a tile is being interacted with.
interface TiltToolSpec { id: string; label: string; sub: string; Icon: LucideIcon; color: string; href?: string }
function TiltTile({ tool, index, onNavigate, onHoverColor }: { tool: TiltToolSpec; index: number; onNavigate: (id: string) => void; onHoverColor: (c: string | null) => void }) {
  var _hov = useState(false), hov = _hov[0], setHov = _hov[1];
  var _coords = useState<{ x: number; y: number } | null>(null), coords = _coords[0], setCoords = _coords[1];
  var t = tool;
  // Off-Classic themes blend a translucent dark panel under the accent tint so
  // the label stays legible over the aurora while the glass still reads.
  var nc = useTheme().theme !== "classic";
  var baseBg = nc
    ? "linear-gradient(135deg, " + t.color + "1e 0%, " + t.color + "0a 100%), rgba(14,13,24,0.66)"
    : "linear-gradient(135deg, " + t.color + "14 0%, " + t.color + "06 100%)";
  var hoverBg = nc
    ? "linear-gradient(135deg, " + t.color + "30 0%, " + t.color + "12 100%), rgba(16,15,26,0.72)"
    : "linear-gradient(135deg, " + t.color + "26 0%, " + t.color + "0C 100%)";

  var rotX = 0, rotY = 0;
  if (coords) {
    rotY = (coords.x - 0.5) * 28;   // doubled — max ~14° left/right
    rotX = (0.5 - coords.y) * 24;   // doubled — max ~12° up/down
  }
  var tileTransform = hov
    ? "rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg) translateY(-10px) scale(1.03)"
    : "rotateX(0) rotateY(0) translateY(0) scale(1)";

  // Outer wrapper owns the entrance animation (asTile keyframes). Inner button
  // owns the tilt transform. This prevents the entrance's final `forwards`
  // keyframe from overriding the tilt transform once the animation ends —
  // otherwise the 3D shift silently does nothing.
  return <div style={{
    animation: "asTile 0.55s cubic-bezier(0.16, 1, 0.3, 1) " + (0.15 + index * 0.06) + "s forwards",
    opacity: 0,
    transformStyle: "preserve-3d",
  }}>
    <button
      onClick={function() { if (t.href) { window.open(t.href, "_blank"); } else { onNavigate(t.id); } }}
      onMouseEnter={function() { setHov(true); onHoverColor(t.color); }}
      onMouseMove={function(e: React.MouseEvent<HTMLButtonElement>) {
        var rect = e.currentTarget.getBoundingClientRect();
        setCoords({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
      }}
      onMouseLeave={function() { setHov(false); setCoords(null); onHoverColor(null); }}
      style={{
        width: "100%",
        height: "100%",
        background: hov ? hoverBg : baseBg,
        backdropFilter: nc ? "blur(8px)" : undefined,
        WebkitBackdropFilter: nc ? "blur(8px)" : undefined,
        border: "1px solid " + (hov ? t.color + "70" : t.color + "28"),
        borderRadius: 28,
        padding: "26px 22px",
        cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
        transition: "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), background 0.22s, border-color 0.22s, box-shadow 0.22s",
        transform: tileTransform,
        transformStyle: "preserve-3d",
        willChange: "transform",
        boxShadow: hov ? "0 28px 60px -12px " + t.color + "45, 0 0 0 1px " + t.color + "30" : "none",
      }}
    >
      {/* Ambient corner glow */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, " + t.color + "30, transparent 70%)", pointerEvents: "none" }} />
      {/* Specular highlight — moves with the cursor, like a card catching light */}
      {hov && coords && <div style={{
        position: "absolute", inset: 0, borderRadius: 28, pointerEvents: "none",
        background: "radial-gradient(circle at " + (coords.x * 100).toFixed(0) + "% " + (coords.y * 100).toFixed(0) + "%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 30%, transparent 60%)",
      }} />}
      {/* Icon — lifts farther "out" of the card AND slides up on hover.
          Renders a Lucide SVG icon tinted the tile's color so it reads as
          an on-brand mark rather than a generic glyph. */}
      <div style={{ lineHeight: 0, position: "relative", transform: hov ? "translate3d(0, -8px, 36px)" : "translate3d(0, 0, 0)", transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)", filter: "drop-shadow(0 8px 16px " + t.color + "66)" }}>
        <t.Icon size={56} strokeWidth={1.7} color={t.color} />
      </div>
      {/* Label */}
      <div style={{ position: "relative", transform: hov ? "translate3d(0, -2px, 18px)" : "translate3d(0, 0, 0)", transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ fontFamily: ft, fontSize: 19, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.3, marginBottom: 4 }}>{t.label}</div>
        <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 500, color: t.color + "CC", letterSpacing: 0.2 }}>{t.sub}</div>
      </div>
    </button>
  </div>;
}

function AnalystSplash({ onNavigate }: { onNavigate: (id: string) => void }) {
  var ob = useOnboarding();
  var VIOLET = "#905CCB";
  // Personal handle so the splash can greet the analyst by name.
  var _name = useState<string | null>(null), analystName = _name[0], setAnalystName = _name[1];
  useEffect(function() {
    try { setAnalystName(localStorage.getItem("poast-analyst-name")); } catch {}
  }, []);
  // Tier hierarchy:
  //   HERO   · POAST Studio (Charts) — analyst's primary surface
  //   WIDE   · Carousel — second-most-used
  //   ROW    · Slop Top, Capper, Brainstorm — quick utilities
  //   LIBRARY · Asset Library — quiet, separate
  var heroTool: TiltToolSpec = { id: "chart-cm2", label: "POAST Studio", sub: "Charts · tables · diagrams · saved library", Icon: GanttChart, color: C.coral, href: "/charts" };
  var wideTool: TiltToolSpec = { id: "carousel",  label: "Carousel",    sub: "Build Instagram carousels",                  Icon: LayoutGrid, color: C.blue };
  var rowTools: TiltToolSpec[] = [
    { id: "sloptop",    label: "Slop Top",   sub: "Brief Gen + arxiv.lol",  Icon: Zap,        color: C.amber },
    { id: "captions",   label: "Capper",     sub: "Captions per platform",  Icon: Captions,   color: C.teal },
    { id: "brainstorm", label: "Brainstorm", sub: "Tennis ideation",        Icon: Brain,      color: VIOLET },
  ];
  // Lifted from whichever tile is currently being hovered. Null when no tile
  // is active → the screen falls back to the resting violet ambient.
  var _hovC = useState<string | null>(null), hovC = _hovC[0], setHovC = _hovC[1];
  var activeColor = hovC || VIOLET;

  return <div style={{ position: "fixed", inset: 0, background: "#06060C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center", zIndex: 9999, overflowY: "auto", overflowX: "hidden", padding: "32px 16px" }}>
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes asFade{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
      @keyframes asTile{0%{opacity:0;transform:translateY(20px) scale(0.94)}100%{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes asPulse{0%,100%{opacity:0.5}50%{opacity:0.85}}
      @keyframes asGlowDrift{0%,100%{transform:scale(1) translate(0,0)}50%{transform:scale(1.06) translate(-1.5%,1%)}}
    ` }} />

    {/* Base ambient orbs — always present, quiet when no tile active */}
    <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "55vw", height: "55vw", borderRadius: "50%", background: `radial-gradient(circle, ${VIOLET}14, transparent 60%)`, pointerEvents: "none", animation: "asPulse 8s ease-in-out infinite" }} />
    <div style={{ position: "absolute", bottom: "-15%", left: "-10%", width: "50vw", height: "50vw", borderRadius: "50%", background: `radial-gradient(circle, ${C.amber}0C, transparent 60%)`, pointerEvents: "none", animation: "asPulse 10s ease-in-out infinite reverse" }} />

    {/* Reactive tint — stylistic multi-stop gradient in the active tile's
        color. Three radial stops at offset positions plus a diagonal wash
        so the screen absorbs the hue asymmetrically. Fades in/out with
        hover; softly drifts while active. */}
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: [
        `radial-gradient(ellipse 95% 60% at 85% 8%, ${activeColor}3C 0%, ${activeColor}14 22%, transparent 55%)`,
        `radial-gradient(ellipse 85% 70% at 12% 92%, ${activeColor}26 0%, ${activeColor}0A 30%, transparent 60%)`,
        `radial-gradient(ellipse 60% 50% at 50% 50%, ${activeColor}14 0%, transparent 60%)`,
        `linear-gradient(135deg, ${activeColor}12 0%, transparent 38%, transparent 62%, ${activeColor}0E 100%)`,
      ].join(", "),
      opacity: hovC ? 1 : 0,
      transition: "opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)",
      animation: hovC ? "asGlowDrift 12s ease-in-out infinite" : undefined,
    }} />
    {/* Top/bottom edge haze — subtle framing tint in the active color */}
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: `linear-gradient(180deg, ${activeColor}14 0%, transparent 18%, transparent 82%, ${activeColor}10 100%)`,
      opacity: hovC ? 0.9 : 0,
      transition: "opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
    }} />

    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, animation: "asFade 0.45s ease forwards", opacity: 0 }}>
      <img src="/poast-logo.png" style={{ width: 40, height: 40, borderRadius: 10 }} />
      <span style={{ fontFamily: gf, fontSize: 20, fontWeight: 900, color: C.amber, letterSpacing: 5 }}>POAST</span>
    </div>
    <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.5, marginBottom: 4, animation: "asFade 0.5s ease 0.05s forwards", opacity: 0 }}>
      {analystName ? "Welcome back, " + analystName : "Analyst Studio"}
    </div>
    <div style={{ fontFamily: mn, fontSize: 11, color: VIOLET, letterSpacing: 2, marginBottom: 36, animation: "asFade 0.5s ease 0.1s forwards", opacity: 0 }}>
      {analystName ? "ANALYST STUDIO" : "PICK A TOOL TO CREATE"}
    </div>

    {/* Tier 1 · HERO — POAST Studio. Full-width, tallest tile so the
        analyst's primary surface dominates the screen on entry. */}
    <div style={{ width: "min(92vw, 760px)", height: 220, marginBottom: 16, perspective: "1100px" }}>
      <TiltTile tool={heroTool} index={0} onNavigate={onNavigate} onHoverColor={setHovC} />
    </div>

    {/* Tier 2 · WIDE — Carousel. Full-width, shorter than hero. */}
    <div style={{ width: "min(92vw, 760px)", height: 150, marginBottom: 16, perspective: "1100px" }}>
      <TiltTile tool={wideTool} index={1} onNavigate={onNavigate} onHoverColor={setHovC} />
    </div>

    {/* Tier 3 · ROW — Slop Top · Capper · Brainstorm. Three compact tiles. */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "min(92vw, 760px)", height: 180, marginBottom: 28, perspective: "1100px" }}>
      {rowTools.map(function(t, i) {
        return <TiltTile key={t.id} tool={t} index={2 + i} onNavigate={onNavigate} onHoverColor={setHovC} />;
      })}
    </div>

    {/* Asset Library — analyst's quiet library. CTA bar, not a tile. */}
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "min(92vw, 760px)", perspective: "1100px" }}>
      <SplashCTA
        Icon={Library}
        label="Asset Library"
        sub="Style guide · logos · fonts · OneDrive links"
        color={C.blue}
        onHoverColor={setHovC}
        onClick={function() { onNavigate("assets"); }}
        delay={0.55}
      />
      <SplashCTA
        Icon={Presentation}
        label="Brand Launch Presentation"
        sub="Opens the live deck in a new tab"
        color={C.amber}
        onHoverColor={setHovC}
        onClick={function() { window.open("/brand-launch", "_blank"); }}
        delay={0.62}
      />
    </div>

    <div onClick={function() { ob.setActiveStep("welcome"); }} style={{ fontFamily: mn, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1.5, marginTop: 32, animation: "asFade 0.5s ease 0.65s forwards", opacity: 0, cursor: "pointer", padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", transition: "all 0.2s ease" }} onMouseEnter={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = C.amber; e.currentTarget.style.borderColor = C.amber + "40"; }} onMouseLeave={function(e: React.MouseEvent<HTMLElement>) { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>↻ Replay welcome tour</div>
    <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: 3, marginTop: 18, animation: "asFade 0.5s ease 0.7s forwards", opacity: 0 }}>SEMIANALYSIS // ANALYST STUDIO</div>
  </div>;
}

// Wide CTA shaped to match the TiltTile interaction (mouse-tracked 3D
// rotation, hover lift, color glow, specular highlight). Slightly more
// prominent than a tile because it's a primary action below the grid.
function SplashCTA({ Icon, label, sub, color, onHoverColor, onClick, delay }: { Icon: LucideIcon; label: string; sub: string; color: string; onHoverColor: (c: string | null) => void; onClick: () => void; delay: number }) {
  var _hov = useState(false), hov = _hov[0], setHov = _hov[1];
  var _coords = useState<{ x: number; y: number } | null>(null), coords = _coords[0], setCoords = _coords[1];

  // Wider tile → smaller Y rotation (avoid corners flying), keep X tilt
  var rotX = 0, rotY = 0;
  if (coords) {
    rotY = (coords.x - 0.5) * 14;   // -7° to +7° on the wide axis
    rotX = (0.5 - coords.y) * 22;   // -11° to +11° vertically
  }
  var transform = hov
    ? "rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg) translateY(-6px) scale(1.02)"
    : "rotateX(0) rotateY(0) translateY(0) scale(1)";

  var baseBg = "linear-gradient(135deg, " + color + "1A 0%, " + color + "0A 100%)";
  var hoverBg = "linear-gradient(135deg, " + color + "30 0%, " + color + "12 100%)";

  return (
    <div style={{ animation: "asTile 0.55s cubic-bezier(0.16, 1, 0.3, 1) " + delay + "s forwards", opacity: 0, transformStyle: "preserve-3d" }}>
      <button
        onClick={onClick}
        onMouseEnter={function() { setHov(true); onHoverColor(color); }}
        onMouseMove={function(e: React.MouseEvent<HTMLButtonElement>) {
          var rect = e.currentTarget.getBoundingClientRect();
          setCoords({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
        }}
        onMouseLeave={function() { setHov(false); setCoords(null); onHoverColor(null); }}
        style={{
          width: "100%",
          padding: "18px 24px",
          display: "flex", alignItems: "center", gap: 18,
          background: hov ? hoverBg : baseBg,
          border: "1px solid " + (hov ? color + "75" : color + "30"),
          borderRadius: 20,
          color: "#E8E4DD",
          cursor: "pointer",
          textAlign: "left",
          position: "relative", overflow: "hidden",
          transform: transform,
          transformStyle: "preserve-3d",
          willChange: "transform",
          transition: "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), background 0.22s, border-color 0.22s, box-shadow 0.22s",
          boxShadow: hov ? "0 22px 48px -12px " + color + "55, 0 0 0 1px " + color + "30" : "none",
        }}
      >
        {/* Corner glow — same idiom as TiltTile */}
        <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, " + color + "30, transparent 70%)", pointerEvents: "none" }} />
        {/* Specular highlight tracking the cursor */}
        {hov && coords && <div style={{
          position: "absolute", inset: 0, borderRadius: 20, pointerEvents: "none",
          background: "radial-gradient(circle at " + (coords.x * 100).toFixed(0) + "% " + (coords.y * 100).toFixed(0) + "%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 30%, transparent 60%)",
        }} />}
        {/* Icon — lifts on hover, drop-shadowed in the brand color */}
        <div style={{ lineHeight: 0, position: "relative", transform: hov ? "translate3d(0, -2px, 30px)" : "translate3d(0, 0, 0)", transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)", filter: "drop-shadow(0 6px 14px " + color + "66)" }}>
          <Icon size={32} strokeWidth={1.8} color={color} />
        </div>
        {/* Label block lifts a touch out of the surface like TiltTile */}
        <div style={{ flex: 1, position: "relative", transform: hov ? "translate3d(0, 0, 14px)" : "translate3d(0, 0, 0)", transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={{ fontFamily: ft, fontSize: 17, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.2, marginBottom: 3 }}>{label}</div>
          <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 500, color: color + "CC", letterSpacing: 0.2 }}>{sub}</div>
        </div>
        {/* Arrow lifts and nudges, matching the TiltTile "translate Z out" feel */}
        <span style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, color: color, opacity: hov ? 1 : 0.55, transform: hov ? "translate3d(4px, 0, 26px)" : "translate3d(0, 0, 0)", transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s", filter: "drop-shadow(0 6px 12px " + color + "66)", lineHeight: 1 }}>→</span>
      </button>
    </div>
  );
}

function Intro({ onDone }: { onDone: (id?: string) => void }) {
  var _phase = useState<string>("select"), phase = _phase[0], setPhase = _phase[1];
  var _user = useState<string | null>(null), user = _user[0], setUser = _user[1];
  var _glitch = useState(false), glitch = _glitch[0], setGlitch = _glitch[1];
  var userCtx = useUser();
  var router = useRouter();

  var handleUserSelect = function(name: string, remember?: boolean) {
    setUser(name);
    userCtx.setUser(name, remember !== false);
    // Analysts: drop straight into the main app. The main app renders the
    // analyst splash when sec === "home" (default), and the OnboardingHost
    // fires the welcome modal automatically for first-time analysts.
    // Don't render an in-Intro splash on top — that was the duplicate
    // "home is gone" UX bug.
    if (name === "Analyst") { router.replace("/analyst"); onDone(); return; }
    setPhase("boot");
    try { var audio = new Audio("/splash-sound.mp3"); audio.volume = 0.7; audio.play().catch(function() {}); } catch (e) {}
  };
  // Marketing path: keep the boot+glitch flourish for vibe, then drop into
  // the main app on home. No in-Intro splash phase.
  var handleBootDone = function() {
    setGlitch(true);
    setTimeout(function() { setGlitch(false); onDone(); }, 350);
  };

  return <div>
    {phase === "select" && <UserSelect onSelect={handleUserSelect} />}
    {phase === "boot" && <TerminalBoot user={user} onDone={handleBootDone} />}
    {glitch && <GlitchTransition onDone={function() {}} />}
  </div>;
}

// Asset Library embedded inside POAST. Fetches the standalone HTML
// from /public, drops it inline into POAST's DOM via dangerouslySetInnerHTML,
// then re-creates the inline <script> nodes so the slide's IIFE wires up
// the tree-click → preview swap behavior. (React doesn't execute scripts
// inserted via dangerouslySetInnerHTML — we have to re-attach them.)
// CSS variables the slide depends on are declared on the wrapper so the
// scoped rules resolve to the right brand colors.
function AssetLibraryEmbed({ left, top }: { left: number; top: number }) {
  var _h = useState<string>(""), html = _h[0], setHtml = _h[1];
  var hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(function() {
    fetch("/asset-library-content.html")
      .then(function(r) { return r.text(); })
      .then(function(text) {
        var m = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        setHtml(m ? m[1] : text);
      })
      .catch(function() { setHtml(""); });
  }, []);

  useEffect(function() {
    var host = hostRef.current;
    if (!host || !html) return;
    var scripts = host.querySelectorAll("script");
    scripts.forEach(function(oldScript) {
      var newScript = document.createElement("script");
      if (oldScript.src) newScript.src = oldScript.src;
      if (oldScript.textContent) newScript.textContent = oldScript.textContent;
      oldScript.parentNode && oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return (
    <div style={Object.assign({
      position: "fixed", top: top, left: left, right: 0, bottom: 0,
      background: "#06060A", zIndex: 50,
      transition: "left 0.22s cubic-bezier(0.3,0.7,0.3,1)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }, {
      ["--amber" as string]: "#F7B041",
      ["--amber-dim" as string]: "rgba(247,176,65,0.15)",
      ["--border2" as string]: "rgba(255,255,255,0.12)",
      ["--text" as string]: "#F2F2F2",
      ["--muted" as string]: "rgba(242,242,242,0.45)",
      ["--muted2" as string]: "rgba(242,242,242,0.22)",
      ["--black" as string]: "#06060A",
      ["--font" as string]: "'Outfit', sans-serif",
    }) as React.CSSProperties}>
      <div style={{ padding: "12px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, background: "#0A0A14", flexShrink: 0 }}>
        <Library size={18} strokeWidth={1.8} color={C.blue} />
        <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 800, color: "#E8E4DD", letterSpacing: 0.3 }}>Asset Library</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, marginLeft: 6 }}>// SEMIANALYSIS BRAND</span>
        <a href="/asset-library-content.html" target="_blank" rel="noopener" style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: C.blue, textDecoration: "none", padding: "4px 10px", border: "1px solid " + C.blue + "55", borderRadius: 6, fontWeight: 700, letterSpacing: 0.5 }}>Open ↗</a>
      </div>
      <style>{`
        .al-host .slide { display: flex; flex-direction: column; padding: 24px 32px 28px; height: 100%; min-height: 0; max-height: 100%; box-sizing: border-box; opacity: 1 !important; pointer-events: auto !important; transform: none !important; position: static !important; inset: auto !important; overflow: hidden !important; }
        .al-host .sa-stars, .al-host .sa-orb, .al-host .sa-flare { display: none !important; }
        .al-host .eyebrow { font-size: 13px; letter-spacing: 0.2em; font-weight: 700; color: var(--amber); text-transform: uppercase; margin-bottom: 10px; display: block; }
        .al-host .slide-title { font-size: 38px; font-weight: 800; letter-spacing: -0.025em; color: #fff; line-height: 1.05; margin: 0 0 6px; display: block; }
        .al-host .slide-sub { font-size: 14px; color: var(--muted); font-weight: 400; max-width: 880px; line-height: 1.5; margin-bottom: 14px; display: block; }
        .al-host .hl { color: var(--amber); }
        .al-host a { color: inherit; text-decoration: none; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-body { min-height: 0 !important; grid-template-rows: minmax(0, 1fr) !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-tree,
        .al-host [data-sa-scope="sa-al0aldn"] .al-dir { min-height: 0; max-height: 100%; overflow: auto; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-pv-card { max-width: min(640px, 96%) !important; width: 100%; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-pv-thumb:not(.mini) { height: clamp(140px, 24vh, 280px) !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-pv-folder { max-width: min(820px, 96%) !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-pv-thumb.mini { height: clamp(120px, 20vh, 200px) !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-tree-title { font-size: 12px !important; }
        .al-host [data-sa-scope="sa-al0aldn"] details > summary .al-name { font-size: 15px !important; }
        .al-host [data-sa-scope="sa-al0aldn"] details > summary .al-count { font-size: 11px !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-leaf { font-size: 13px !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-leaf .al-pill { font-size: 9.5px !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-pv-mini-name { font-size: 13px !important; padding: 9px 11px !important; }
        .al-host [data-sa-scope="sa-al0aldn"] .al-pv-mini-ext { font-size: 9.5px !important; padding: 0 11px 10px !important; }
      `}</style>
      <div
        ref={hostRef}
        className="al-host"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ flex: 1, overflow: "auto", color: "#F2F2F2", fontFamily: "'Outfit', sans-serif", minHeight: 0 }}
      />
      {!html && <div style={{ padding: 40, textAlign: "center", fontFamily: mn, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Loading asset library...</div>}
    </div>
  );
}

// Lightweight name-capture for analysts. The Analyst seat is a shared
// login (one role-user, many humans), so on first session we ask for a
// personal name. The value is stored locally and then attached to every
// trackEvent payload so the analytics endpoint can tell humans apart.
function AnalystWelcomeGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  var _name = useState(""), nameInput = _name[0], setName = _name[1];
  var canSubmit = nameInput.trim().length >= 2;

  function submit() {
    if (!canSubmit) return;
    var name = nameInput.trim();
    try { localStorage.setItem("poast-analyst-name", name); } catch {}
    try { trackEvent("analyst_identified", { analystName: name }); } catch {}
    onSubmit(name);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, fontFamily: ft }}>
      <div style={{ width: 440, maxWidth: "92vw", padding: "32px 30px", background: C.card, border: "1px solid " + C.amber + "40", borderRadius: 18, boxShadow: "0 28px 64px rgba(0,0,0,0.7), 0 0 64px " + C.amber + "1A" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <img src="/poast-logo.png" alt="POAST" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 900, color: C.amber, letterSpacing: 4 }}>POAST</span>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>// ANALYST</span>
        </div>
        <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.6, marginBottom: 6 }}>Welcome in.</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.55, marginBottom: 22 }}>
          What should we call you? Just so your workspace knows who's driving.
        </div>
        <input
          autoFocus
          value={nameInput}
          onChange={function(e: React.ChangeEvent<HTMLInputElement>) { setName(e.target.value); }}
          onKeyDown={function(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter" && canSubmit) submit(); }}
          placeholder="Your name"
          style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 15, outline: "none", marginBottom: 18, boxSizing: "border-box" }}
        />
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{ width: "100%", padding: "12px 14px", background: canSubmit ? C.amber : "rgba(247,176,65,0.18)", color: canSubmit ? "#060608" : "rgba(247,176,65,0.45)", border: "none", borderRadius: 10, fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, cursor: canSubmit ? "pointer" : "not-allowed", textTransform: "uppercase" }}
        >
          Continue →
        </button>
        <div style={{ marginTop: 14, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1.8 }}>
          Stored on this device. You can change it anytime.
        </div>
      </div>
    </div>
  );
}

// ═══ BRAINSTORM HUB ═══
// Brainstorm + Slop Top converged into one tool with a tab switch. Both stay
// mounted (display toggle) so each keeps its state when you flip between them.
function BrainstormHub() {
  var _t = useState("brainstorm"), tab = _t[0], setTab = _t[1];
  var tabBtn = function(id: string, label: string) {
    var on = tab === id;
    return <button onClick={function() { setTab(id); }} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid " + (on ? C.amber + "66" : "rgba(255,255,255,0.1)"), background: on ? C.amber + "1c" : "rgba(255,255,255,0.03)", color: on ? C.amber : "rgba(255,255,255,0.6)", fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}>{label}</button>;
  };
  return <div>
    <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 32, marginBottom: 28 }}>
      {tabBtn("brainstorm", "Brainstorm")}
      {tabBtn("sloptop", "Slop Top")}
    </div>
    <div style={{ display: tab === "brainstorm" ? "block" : "none" }}><Brainstorm /></div>
    <div style={{ display: tab === "sloptop" ? "block" : "none" }}><SlopTop /></div>
  </div>;
}

// ═══ APP ═══
var ANALYST_ALLOWED = ["home", "sloptop", "carousel", "captions", "brainstorm", "chart", "chart2", "assets"];

export default function App() {
  // Three-state intro gate. Loading briefly until we resolve on mount.
  // Rule: the root URL ('/') ALWAYS shows the cinematic welcome, even if
  // the user has a saved session — that's the explicit role-pick entry
  // point Akash specified. Other paths (e.g. /analyst, /docu-design,
  // /charts) trust the saved session so users don't get bounced back to
  // the login mid-session. Once introState transitions to "skip" via the
  // pick handler, it stays "skip" for the rest of this mount — no
  // re-pick on subsequent re-renders.
  var _sp = useState<"loading" | "show" | "skip">("loading"), introState = _sp[0], setIntroState = _sp[1];
  var showIntro = introState === "show";
  useEffect(function() {
    // Respect "Stay logged in" everywhere, including on the root path.
    // Previously `/` always showed the intro picker regardless of saved
    // session — that's why the checkbox felt broken even though the
    // user-context was correctly writing localStorage. Now we check
    // both localStorage and sessionStorage so the session-only path
    // also skips the picker until the tab closes.
    var hasUser = false;
    if (typeof window !== "undefined") {
      try {
        hasUser = !!localStorage.getItem("poast-current-user") || !!sessionStorage.getItem("poast-current-user");
      } catch { /* ignore */ }
    }
    // Honor ?user= bookmark even when a session exists — lets a user
    // override "I'm signed in as X" by visiting ?user=Y explicitly.
    var qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    var explicitUser = qs?.get("user");
    if (explicitUser && !hasUser) {
      setIntroState("show");
      return;
    }
    setIntroState(hasUser ? "skip" : "show");
  }, []);
  var _askPoast = useState(false), askPoastOpen = _askPoast[0], setAskPoastOpen = _askPoast[1];
  // Default landing is the home splash, not a tool. Previously defaulted
  // to "weekly" which dumped every user — including analysts — straight
  // into SA Weekly on app load and bypassed the home screen entirely.
  var _s = useState("home"), sec = _s[0], setSec = _s[1];
  var userCtx = useUser();
  // Theme-conditional nav: Glass → top bar (no sidebar, full-width content);
  // Classic/Stock → smart sidebar (dock 240 / collapse 72, peek on hover).
  var themeCtx = useTheme();
  var isGlass = themeCtx.theme === "glass";
  // Stock/Glass want the <html> aurora (globals.css paints var(--app-backdrop))
  // to show THROUGH the hub. Classic stays a flat opaque base — byte-identical.
  // So the hub's full-screen base layers are transparent off-Classic and the
  // translucent surface tokens do the legibility work over the aurora.
  var isClassicTheme = themeCtx.theme === "classic";
  var appBaseBg = isClassicTheme ? C.bg : "transparent";
  var _collapsed = useState(false), navCollapsed = _collapsed[0], setNavCollapsed = _collapsed[1];
  useEffect(function() { try { setNavCollapsed(localStorage.getItem("poast-sidebar-collapsed") === "1"); } catch (e) {} }, []);
  var toggleCollapsed = function() { setNavCollapsed(function(v) { var n = !v; try { localStorage.setItem("poast-sidebar-collapsed", n ? "1" : "0"); } catch (e) {} return n; }); };
  var contentLeft = isGlass ? 0 : (navCollapsed ? 72 : 240);
  var contentTop = isGlass ? 52 : 0;
  var analyst = isAnalyst(userCtx.user);
  // Analyst name capture: shared role-user means we need a personal
  // handle to tell different humans apart. Hydrate from localStorage
  // on mount; show the welcome gate when missing.
  var _analystName = useState<string | null>(null), analystName = _analystName[0], setAnalystName = _analystName[1];
  var _analystNameHydrated = useState(false), analystNameHydrated = _analystNameHydrated[0], setAnalystNameHydrated = _analystNameHydrated[1];
  useEffect(function() {
    try {
      var stored = localStorage.getItem("poast-analyst-name");
      if (stored) setAnalystName(stored);
    } catch {}
    setAnalystNameHydrated(true);
  }, []);
  var showAnalystGate = analyst && analystNameHydrated && !analystName;
  // Analysts: gate navigation to allowed sections only, default to carousel
  useEffect(function() {
    // If an analyst somehow lands on a section they can't access, send
    // them to home (their splash with the 4 tile icons) — not directly
    // into a tool. They pick from there.
    if (analyst && !ANALYST_ALLOWED.includes(sec)) setSec("home");
  }, [analyst, sec]);
  // Listen for nav events from other components (e.g. News Flow Draft -> P2P)
  useEffect(function() {
    var handler = function(e: Event) {
      var detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (analyst && !ANALYST_ALLOWED.includes(detail)) return;
      setSec(detail);
    };
    window.addEventListener("poast-nav", handler);
    return function() { window.removeEventListener("poast-nav", handler); };
  }, [analyst]);

  // Phase 12A: ⌘K palette toggle is now registered via useShortcuts so it
  // appears in the cheat-sheet alongside everything else. This effect
  // handles only Esc-to-close (useShortcuts has its own input-focus guard,
  // but we still want Esc to close the open palette even mid-typing).
  useEffect(function() {
    if (analyst) return;
    var onKey = function(e: KeyboardEvent) {
      if (e.key === "Escape" && askPoastOpen) {
        setAskPoastOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return function() { window.removeEventListener("keydown", onKey); };
  }, [analyst, askPoastOpen]);

  useShortcuts(
    analyst ? {} : {
      "$mod+k": { description: "Open command palette", handler: function() { setAskPoastOpen(function(o) { return !o; }); } },
    },
    { scope: "Global" }
  );

  // When the user signs out mid-session (sidebar "Switch user" badge),
  // re-show the picker instead of forcing a full page reload. We only
  // re-arm when introState is already "skip" — that's our signal that
  // hydration completed with a user present. Initial mount or explicit
  // ?user= paths already have their own logic above.
  useEffect(function() {
    if (introState === "skip" && !userCtx.user) setIntroState("show");
  }, [userCtx.user, introState]);

  // Analytics · session start fires once per app mount; view fires on every
  // sec change. Wired here so every tool gets tracked without per-tool edits.
  useEffect(function() {
    if (!userCtx.user) return;
    trackEvent("session", { intro: showIntro }, sec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCtx.user]);
  useEffect(function() {
    if (!userCtx.user) return;
    trackEvent("view", {}, sec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec, userCtx.user]);
  // Brief blank during localStorage hydration so the picker doesn't flash
  // for returning users. introState becomes "show" or "skip" right after mount.
  if (introState === "loading") return <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 9999 }} />;
  if (showIntro) return <><Intro onDone={function(id) { if (id) setSec(id); setIntroState("skip"); }} /></>;

  // Flatten SIDEBAR_CATS into a searchable list for HubPalette. Mirror the
  // sidebar visibility rules (analyst gate, docu access, tasks=akash-only)
  // so the palette can never surface a section the user can't actually open.
  var canDocuPalette = canUseDocuDesign(userCtx.user);
  var akashPalette = isAkash(userCtx.user);
  var paletteItems: PaletteItem[] = [];
  Object.keys(SIDEBAR_CATS).forEach(function(catKey) {
    var cat = SIDEBAR_CATS[catKey];
    cat.items.forEach(function(it: SidebarCatItem) {
      if (analyst && !ANALYST_ALLOWED.includes(it.id)) return;
      if (it.id === "docu" && !canDocuPalette) return;
      if (it.id === "tasks" && !akashPalette) return;
      paletteItems.push({ id: it.id, label: it.l, cat: cat.label, color: cat.color, href: it.href, Icon: it.Icon });
    });
  });

  return (<ShortcutsProvider><div style={{ background: appBaseBg, minHeight: "100vh", position: "relative" }}>
    {/* Analyst mode accent bar — subtle violet stripe + small label so the user knows they're in the restricted view. */}
    {analyst && <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000, pointerEvents: "none" }}>
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #905CCB, transparent)", boxShadow: "0 0 12px rgba(144,92,203,0.5)" }} />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
        <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, color: "#905CCB", letterSpacing: 3, padding: "2px 10px", borderRadius: "0 0 6px 6px", background: "rgba(144,92,203,0.08)", border: "1px solid rgba(144,92,203,0.25)", borderTop: "none" }}>ANALYST MODE</span>
      </div>
    </div>}
    {/* Background ambient glow orbs */}
    <style dangerouslySetInnerHTML={{ __html: "@keyframes drift1{0%{transform:translate(0,0)}50%{transform:translate(30px,-20px)}100%{transform:translate(0,0)}}@keyframes drift2{0%{transform:translate(0,0)}50%{transform:translate(-25px,15px)}100%{transform:translate(0,0)}}@keyframes drift3{0%{transform:translate(0,0)}50%{transform:translate(20px,25px)}100%{transform:translate(0,0)}}" }} />
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(247,176,65,0.04) 0%, transparent 60%)", animation: "drift1 20s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "-15%", left: "10%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(11,134,209,0.04) 0%, transparent 60%)", animation: "drift2 25s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "40%", left: "-10%", width: "40vw", height: "40vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(144,92,203,0.03) 0%, transparent 60%)", animation: "drift3 30s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "5%", width: "35vw", height: "35vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(46,173,142,0.03) 0%, transparent 60%)", animation: "drift1 22s ease-in-out infinite reverse" }} />
    </div>
    {/* ═══ GLOBAL STYLES ═══ */}
    <style dangerouslySetInnerHTML={{ __html: [
      "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Medium.woff2') format('woff2');font-weight:500;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-SemiBold.woff2') format('woff2');font-weight:600;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-ExtraBold.woff2') format('woff2');font-weight:800;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Grift';src:url('/fonts/Grift-Black.woff2') format('woff2');font-weight:900;font-style:normal;font-display:swap}",
      "*{box-sizing:border-box;margin:0;padding:0}",
      // Classic keeps the flat opaque body. Stock/Glass leave body transparent
      // so globals.css's <html> var(--app-backdrop) aurora shows through.
      "html[data-theme=\"classic\"] body{background:#06060C}",
      "html{scroll-behavior:smooth}",
      "::selection{background:rgba(247,176,65,0.25);color:#F7B041}",
      "::-webkit-scrollbar{width:6px}",
      "::-webkit-scrollbar-track{background:transparent}",
      "::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}",
      "::-webkit-scrollbar-thumb:hover{background:rgba(247,176,65,0.35)}",
      "input:focus,textarea:focus,select:focus{outline:none;border-color:#F7B041!important;box-shadow:0 0 0 3px rgba(247,176,65,0.1),0 0 16px rgba(247,176,65,0.06)!important}",
      "input::placeholder,textarea::placeholder{color:#4A4858}",
      // Animations
      "@keyframes fadeInUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}",
      "@keyframes fadeIn{0%{opacity:0}100%{opacity:1}}",
      "@keyframes slideUp{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}",
      // Stagger
      ".stagger>*{opacity:0;animation:slideUp 0.35s ease forwards}",
      ".stagger>*:nth-child(1){animation-delay:0s}.stagger>*:nth-child(2){animation-delay:0.05s}.stagger>*:nth-child(3){animation-delay:0.1s}.stagger>*:nth-child(4){animation-delay:0.15s}.stagger>*:nth-child(5){animation-delay:0.2s}.stagger>*:nth-child(6){animation-delay:0.25s}.stagger>*:nth-child(7){animation-delay:0.3s}.stagger>*:nth-child(8){animation-delay:0.35s}",
      // Cards — lifted, glowing
      ".poast-card{position:relative;background:linear-gradient(135deg,#09090D,#0D0D12);border:1px solid rgba(255,255,255,0.06);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.4);transition:all 0.2s ease}",
      ".poast-card:hover{border-color:rgba(247,176,65,0.3);box-shadow:0 8px 30px rgba(0,0,0,0.5),0 0 20px rgba(247,176,65,0.08);transform:translateY(-2px)}",
      // Buttons — gradient + glow
      "button,.poast-btn{transition:all 0.15s ease;font-family:'Outfit',sans-serif}",
      "button:active,.poast-btn:active{transform:scale(0.97)}",
      // Primary btn class
      ".btn-glow{background:linear-gradient(135deg,#F7B041,#E8A020);color:#06060C;border:none;border-radius:8px;font-weight:700;box-shadow:0 4px 14px rgba(247,176,65,0.25),0 0 20px rgba(247,176,65,0.1);cursor:pointer}",
      ".btn-glow:hover{box-shadow:0 6px 24px rgba(247,176,65,0.4),0 0 40px rgba(247,176,65,0.15);transform:translateY(-1px)}",
      // Ghost btn class
      ".btn-ghost{background:rgba(255,255,255,0.02);color:#8A8690;border:1px solid rgba(255,255,255,0.06);border-radius:8px;cursor:pointer}",
      ".btn-ghost:hover{border-color:rgba(247,176,65,0.4);color:#F7B041;background:rgba(247,176,65,0.04);box-shadow:0 0 12px rgba(247,176,65,0.08)}",
      // Transitions
      ".poast-fadein{animation:fadeInUp 0.4s ease forwards}",
      ".poast-section{animation:fadeIn 0.3s ease}",
      // Progress
      "@keyframes progressSlide{0%{left:-40%}100%{left:100%}}",
      ".progress-slide{animation:progressSlide 1.5s ease-in-out infinite}",
      "@keyframes dotPulse{0%,80%,100%{opacity:0.2}40%{opacity:1}}",
      ".progress-dots::after{content:'...';display:inline-block;animation:dotPulse 1.4s ease-in-out infinite}",
      // Chippy pulse
      "@keyframes askPulse{0%,100%{box-shadow:0 0 0 0 rgba(38,201,216,0.12)}50%{box-shadow:0 0 16px 4px rgba(38,201,216,0.08), 0 0 8px 2px rgba(247,176,65,0.06)}}",
      ".ask-pulse{animation:askPulse 3s ease-in-out infinite}",
      "@keyframes chipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}",
      "@keyframes chipBounce{0%{transform:scale(1)}50%{transform:scale(1.1)}100%{transform:scale(1)}}",
      // Background orbs
      "@keyframes od1{0%{transform:translate(0,0) scale(1) rotate(0)}25%{transform:translate(8vw,-6vh) scale(1.2) rotate(5deg)}50%{transform:translate(-4vw,8vh) scale(0.85) rotate(-3deg)}75%{transform:translate(6vw,3vh) scale(1.1) rotate(2deg)}100%{transform:translate(0,0) scale(1) rotate(0)}}",
      "@keyframes od2{0%{transform:translate(0,0) scale(1)}25%{transform:translate(-10vw,5vh) scale(0.9)}50%{transform:translate(5vw,-7vh) scale(1.15)}75%{transform:translate(-3vw,10vh) scale(0.95)}100%{transform:translate(0,0) scale(1)}}",
      "@keyframes od3{0%{transform:translate(0,0) scale(1)}33%{transform:translate(7vw,6vh) scale(1.3)}66%{transform:translate(-8vw,-4vh) scale(0.8)}100%{transform:translate(0,0) scale(1)}}",
      "@keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}",
      ".bg-orb{position:absolute;border-radius:50%;filter:blur(100px);will-change:transform;pointer-events:none}",
    ].join("") }} />

    {/* ═══ ANIMATED BACKGROUND (color shifts with category) ═══ */}
    {(function() {
      // Determine active category color
      var catGlow = "rgba(247,176,65,"; // default amber
      var catGlow2 = "rgba(144,92,203,"; // accent
      var produceIds = ["weekly", "p2p", "captions", "brainstorm"];
      var prepareIds = ["news", "gtc"];
      var premierIds = ["schedule"];
      if (produceIds.indexOf(sec) >= 0) { catGlow = "rgba(247,176,65,"; catGlow2 = "rgba(224,99,71,"; }
      else if (prepareIds.indexOf(sec) >= 0) { catGlow = "rgba(11,134,209,"; catGlow2 = "rgba(144,92,203,"; }
      else if (premierIds.indexOf(sec) >= 0) { catGlow = "rgba(46,173,142,"; catGlow2 = "rgba(11,134,209,"; }
      return <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: appBaseBg }} />
        <div className="bg-orb" style={{ width: "55vw", height: "55vw", top: "-15%", right: "-10%", background: "radial-gradient(ellipse, " + catGlow + "0.18) 0%, " + catGlow + "0.06) 35%, transparent 65%)", animation: "od1 22s ease-in-out infinite", borderRadius: "40% 60% 55% 45%", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "45vw", height: "50vw", bottom: "-12%", left: "-5%", background: "radial-gradient(ellipse, " + catGlow + "0.14) 0%, " + catGlow + "0.04) 40%, transparent 65%)", animation: "od2 28s ease-in-out infinite", borderRadius: "55% 45% 50% 50%", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "30vw", height: "35vw", top: "35%", left: "15%", background: "radial-gradient(ellipse, " + catGlow2 + "0.09) 0%, transparent 65%)", animation: "od3 20s ease-in-out infinite", borderRadius: "45% 55% 60% 40%", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "20vw", height: "20vw", top: "15%", right: "25%", background: "radial-gradient(circle, " + catGlow + "0.14) 0%, transparent 55%)", animation: "pulse 4s ease-in-out infinite, od2 14s ease-in-out infinite", filter: "blur(60px)", transition: "background 1.5s ease" }} />
        <div className="bg-orb" style={{ width: "25vw", height: "30vw", bottom: "20%", right: "8%", background: "radial-gradient(ellipse, " + catGlow2 + "0.09) 0%, transparent 60%)", animation: "od1 24s ease-in-out infinite reverse", borderRadius: "60% 40% 45% 55%", transition: "background 1.5s ease" }} />
      </div>;
    })()}

    {isGlass
      ? <GlassTopNav active={sec} onNav={setSec} />
      : <Sidebar active={sec} onNav={setSec} onAskPoast={function() { if (analyst) return; setAskPoastOpen(!askPoastOpen); }} collapsed={navCollapsed} onToggleCollapsed={toggleCollapsed} />}
    {/* Ask POAST panel — never open for Analysts (data access gate).
        Phase 11A: now a Cmd+K command palette with the original chat as
        a secondary tab. `sec` flows in for context-aware commands;
        `onNav` lets palette commands jump between tools. */}
    <AskPoast open={askPoastOpen && !analyst} onToggle={function() { setAskPoastOpen(false); }} sec={sec} onNav={setSec} />
    {/* First-time analyst sign-in: capture a personal handle so usage
        events can tell different humans apart on the shared Analyst seat. */}
    {showAnalystGate ? <AnalystWelcomeGate onSubmit={function(name: string) { setAnalystName(name); }} /> : null}
    {/* Asset Library renders as a sibling of the wrapped tree so its
        position:fixed resolves to the viewport, not the .poast-fadein
        transform's containing block. */}
    {sec === "assets" && <AssetLibraryEmbed left={contentLeft} top={contentTop} />}
    <div style={{ marginLeft: contentLeft, marginTop: contentTop, position: "relative", zIndex: 1, display: sec === "assets" ? "none" : "block", transition: "margin-left 0.22s cubic-bezier(0.3,0.7,0.3,1)" }} className="poast-fadein">
      <div style={{ width: "100%", margin: "0 auto", padding: "0 32px" }}>
        <div key={sec} className="poast-section" style={{ paddingBottom: 60 }}>
        {sec === "home" && (analyst ? <AnalystSplash onNavigate={setSec} /> : <SplashScreen onNavigate={setSec} />)}
        {sec === "settings" && !analyst && <PoastSettings />}
        {sec === "weekly" && <SAWeekly />}
        {sec === "captions" && <ClipCaptions />}
        {sec === "brainstorm" && <BrainstormHub />}
        {sec === "carousel" && <Carousel />}
        {sec === "sloptop" && <SlopTop />}
        {sec === "broll" && <BRollLibrary />}
        {sec === "chart" && <ChartMaker />}
        {sec === "chart2" && <ChartMaker2 />}
        {sec === "chart2" && <ChartTourTrigger />}
        {sec === "fk" && <FabricatedKnowledge />}
        {sec === "outreach" && <Outreach />}
        {sec === "trends" && <Trends />}
        {sec === "ideation" && <IdeationNation />}
        {sec === "gtc" && <GTCFlow />}
        {sec === "news" && <NewsFlow />}
        {/* P2P stays mounted but hidden so production doesn't stop */}
        <div style={{ display: sec === "p2p" ? "block" : "none" }}><PressToPremi /></div>
        {sec === "schedule" && <BufferSchedule />}
        {sec === "voice"    && <VoiceScorer />}
        {sec === "headline" && <HeadlineDoctor />}
        {sec === "distpack" && <DistributionPack />}
        {sec === "perf"     && <PerformanceFeedback />}
        {sec === "approval" && <ApprovalQueue />}
        {sec === "prompts"  && <SavedPromptsLibrary />}
        {sec === "tasks"    && <TaskBoardSummary />}
        </div>
      </div>
    </div>
    <OnboardingHost sec={sec} />
    {/* Global ⌘K palette — suppressed on Task Board which has its own. */}
    {sec !== "tasks" && <HubPalette items={paletteItems} onSelect={function(id: string) { setSec(id); }} />}
    {/* Floating Chippy — replaces the bulky sidebar widget. Bottom-right,
        proximity-aware opacity, dim by default, lights up near cursor.
        Hidden for analysts (Ask POAST is data-gated). */}
    <FloatingChippy onAsk={function() { if (!analyst) setAskPoastOpen(true); }} />
    {/* Promo ribbon scoped to the Asset Library only — was previously
        rendered at App root and floated over every screen, which was wrong. */}
    {sec === "assets" && <StyleGuidePromo />}
    <div style={{ position: "fixed", bottom: 8, right: 12, zIndex: 2, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.12)", letterSpacing: 1, pointerEvents: "none" }}>v2.8</div>
    {/* Mobile warning */}
    <style dangerouslySetInnerHTML={{ __html: "@media(min-width:769px){.mobile-warn{display:none!important}}" }} />
    <div className="mobile-warn" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "14px 20px", background: "#111118", borderTop: "1px solid " + C.amber + "30", display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/poast-logo.png" style={{ width: 28, height: 28, borderRadius: 6 }} />
      <div><div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.tx }}>POAST works best on desktop</div><div style={{ fontFamily: ft, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>For the full experience, switch to a larger screen.</div></div>
    </div>
  </div></ShortcutsProvider>);
}
