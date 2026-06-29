"use client";
// Hover preview for calendar events (Agenda day grid, all-day chips, month view).
// Portaled to <body>, pointer-events:none so it never steals the hover, anchored
// to the hovered element's bounding rect. Learned from schedule-x's hover tools,
// skinned in our Neo-Industrial style.
import React from "react";
import { createPortal } from "react-dom";
import { MapPin, Users, Clock, Sun } from "lucide-react";
import { D, ft, mn } from "../../shared-constants";
import { eventLocation, eventAttendees, isAllDayEvent, type MarketingEvent } from "../marketing-constants";

function fmt(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function EventHoverCard({ e, rect, calName, calColor }: {
  e: MarketingEvent; rect: DOMRect; calName?: string; calColor?: string;
}) {
  if (typeof document === "undefined") return null;
  const allDay = isAllDayEvent(e);
  const loc = eventLocation(e);
  const guests = eventAttendees(e);
  const W = 280;
  const spaceRight = window.innerWidth - rect.right;
  const left = spaceRight > W + 16 ? rect.right + 10 : Math.max(8, rect.left - W - 10);
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - 230));
  const time = allDay ? "All day" : `${fmt(e.start)}${e.end ? " – " + fmt(e.end) : ""}`;

  return createPortal(
    <div style={{
      position: "fixed", left, top, width: W, zIndex: 9000, pointerEvents: "none",
      background: D.bg, border: `1px solid ${D.border}`, borderRadius: 12,
      boxShadow: "0 18px 50px rgba(0,0,0,0.55)", padding: "12px 14px", fontFamily: ft,
      animation: "hcFade 0.12s ease-out",
    }}>
      <style>{`@keyframes hcFade{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: calColor || D.amber, flex: "none" }} />
        <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.5, color: D.txd, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{calName || "Calendar"}</span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx, lineHeight: 1.3, marginBottom: 6 }}>{e.title}</div>
      <Line icon={allDay ? <Sun size={12} /> : <Clock size={12} />} text={time} />
      {loc && <Line icon={<MapPin size={12} />} text={loc} />}
      {guests.length > 0 && <Line icon={<Users size={12} />} text={`${guests.length} guest${guests.length === 1 ? "" : "s"}`} />}
      {e.notes && (
        <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, marginTop: 6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.notes}</div>
      )}
      <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, marginTop: 8, borderTop: `1px solid ${D.border}`, paddingTop: 6 }}>
        Click to edit · drag to move
      </div>
    </div>,
    document.body,
  );
}

function Line({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, color: D.txm, marginTop: 3 }}>
      {icon}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
}
