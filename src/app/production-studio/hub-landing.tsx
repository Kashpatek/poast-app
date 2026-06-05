"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Film,
  Captions,
  Smartphone,
  ListOrdered,
  Library,
  Layers,
  Package,
  Mic,
  AudioLines,
  FileAudio,
  Rss,
  type LucideIcon,
} from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";

type CardStatus = "live" | "placeholder";

interface HubCard {
  id: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  accent: string;
  status: CardStatus;
  href?: string;
}

const VIDEO_CARDS: HubCard[] = [
  {
    id: "brief-builder",
    label: "Brief Builder",
    sub: "Spin episode briefs into shoot-ready guides",
    Icon: FileText,
    accent: D.amber,
    status: "live",
    href: "/production-studio/brief-builder",
  },
  {
    id: "timeline-editor",
    label: "Timeline Editor",
    sub: "Multi-track cuts, transitions, captions",
    Icon: Film,
    accent: D.blue,
    status: "placeholder",
  },
  {
    id: "auto-caption",
    label: "Auto-Caption",
    sub: "Whisper-driven captions with style presets",
    Icon: Captions,
    accent: D.teal,
    status: "placeholder",
  },
  {
    id: "shorts-formatter",
    label: "Shorts Formatter",
    sub: "Reframe + repack horizontal cuts to 9:16",
    Icon: Smartphone,
    accent: D.violet,
    status: "placeholder",
  },
  {
    id: "chapter-generator",
    label: "Chapter Generator",
    sub: "Auto-segment long videos into chapters",
    Icon: ListOrdered,
    accent: D.cyan,
    status: "live",
    href: "/production-studio/chapter-generator",
  },
  {
    id: "b-roll",
    label: "B-Roll Library",
    sub: "Tagged stock + studio footage at hand",
    Icon: Library,
    accent: D.coral,
    status: "live",
    href: "/production-studio/b-roll-library",
  },
  {
    id: "render-queue",
    label: "Render Queue",
    sub: "Background renders with progress + retries",
    Icon: Layers,
    accent: D.crimson,
    status: "live",
    href: "/production-studio/render-queue",
  },
  {
    id: "episode-kit-builder",
    label: "Episode Kit Builder",
    sub: "Assemble the full episode delivery bundle",
    Icon: Package,
    accent: D.amber,
    status: "live",
    href: "/production-studio/episode-kit-builder",
  },
];

const AUDIO_CARDS: HubCard[] = [
  {
    id: "recording-room",
    label: "Recording Room",
    sub: "Multi-track remote recording with backups",
    Icon: Mic,
    accent: D.coral,
    status: "placeholder",
  },
  {
    id: "audio-editor",
    label: "Audio Editor",
    sub: "Trim, level, noise-reduce in browser",
    Icon: AudioLines,
    accent: D.violet,
    status: "placeholder",
  },
  {
    id: "transcript-cleaner",
    label: "Transcript Cleaner",
    sub: "Polish raw transcripts for show notes",
    Icon: FileAudio,
    accent: D.teal,
    status: "live",
    href: "/production-studio/transcript-cleaner",
  },
  {
    id: "rss-manager",
    label: "RSS Manager",
    sub: "Publish + sync podcast feed metadata",
    Icon: Rss,
    accent: D.cyan,
    status: "placeholder",
  },
];

export function HubLanding() {
  return (
    <div style={{ padding: "40px 32px 64px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontFamily: mn,
            fontSize: 11,
            letterSpacing: 2,
            color: D.amber,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          PRODUCTION STUDIO
        </div>
        <h1
          style={{
            fontFamily: gf,
            fontSize: 52,
            lineHeight: 1.04,
            letterSpacing: -1.2,
            margin: 0,
            marginBottom: 12,
            fontWeight: 900,
            color: D.tx,
          }}
        >
          Ship episodes, end to end.
        </h1>
        <div
          style={{
            fontFamily: ft,
            fontSize: 16,
            color: D.txm,
            maxWidth: 620,
            lineHeight: 1.5,
          }}
        >
          Brief, shoot, edit, caption, chapter, render, publish — every tool for a podcast and video pipeline in one shell.
        </div>
      </div>

      <Section title="VIDEO" emoji="🎬" cards={VIDEO_CARDS} />
      <div style={{ height: 32 }} />
      <Section title="AUDIO" emoji="🎙️" cards={AUDIO_CARDS} />
    </div>
  );
}

function Section({ title, emoji, cards }: { title: string; emoji: string; cards: HubCard[] }) {
  return (
    <div>
      <div
        style={{
          fontFamily: mn,
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: D.txd,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>{emoji}</span>
        <span>{title}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 14,
        }}
      >
        {cards.map((c) => (
          <Card key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function Card({ card }: { card: HubCard }) {
  const [hover, setHover] = useState(false);
  const isPlaceholder = card.status === "placeholder";

  const inner = (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: D.card,
        border: `1px solid ${hover && !isPlaceholder ? card.accent : D.border}`,
        borderRadius: 14,
        padding: "18px 16px 16px",
        cursor: isPlaceholder ? "not-allowed" : "pointer",
        opacity: isPlaceholder ? 0.55 : 1,
        transform: hover && !isPlaceholder ? "translateY(-2px)" : "translateY(0)",
        boxShadow:
          hover && !isPlaceholder
            ? `0 0 0 1px ${card.accent}33, 0 10px 30px -12px ${card.accent}55`
            : "0 2px 8px rgba(0,0,0,0.18)",
        transition: "transform 140ms ease, box-shadow 160ms ease, border-color 160ms ease",
        fontFamily: ft,
        color: D.tx,
        height: "100%",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${card.accent}1c`,
          border: `1px solid ${card.accent}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <card.Icon size={18} color={card.accent} strokeWidth={1.8} />
      </div>
      <div
        style={{
          fontFamily: gf,
          fontSize: 18,
          color: D.tx,
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {card.label}
        {isPlaceholder ? <span style={placeholderChip}>PLACEHOLDER</span> : null}
      </div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.4 }}>
        {card.sub}
      </div>
    </div>
  );

  if (isPlaceholder || !card.href) {
    return (
      <div role="button" aria-disabled={isPlaceholder} style={{ display: "block" }}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={card.href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {inner}
    </Link>
  );
}

const placeholderChip: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 9,
  letterSpacing: 0.8,
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.06)",
  color: D.txd,
  border: `1px solid ${D.border}`,
  textTransform: "uppercase",
};
