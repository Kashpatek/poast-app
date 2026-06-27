"use client";
// Always-visible Google Calendar status in the MarketingSUITE top bar.
// Not configured → hidden. Configured + not connected → an amber "Connect
// Calendar" prompt that kicks off OAuth directly. Connected → a teal status
// chip that opens the Agenda (where calendars are listed + synced).
import React from "react";
import { CalendarCheck, CalendarPlus, Loader2 } from "lucide-react";
import { D, mn } from "../../shared-constants";
import { useGoogle } from "../use-google";

export default function CalendarStatusPill({ onManage }: { onManage: () => void }) {
  const { status, loading, connect } = useGoogle();

  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
    borderRadius: 999, padding: "5px 12px",
  };

  if (loading) {
    return (
      <span style={{ ...base, cursor: "default", border: `1px solid ${D.border}`, background: "transparent", color: D.txd }}>
        <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Calendar
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </span>
    );
  }

  // Nothing to prompt if the OAuth client isn't set up on the server.
  if (!status.configured) return null;

  if (!status.connected) {
    return (
      <button
        onClick={connect}
        title="Connect Google Calendar to two-way sync your schedule"
        style={{ ...base, cursor: "pointer", border: `1px solid ${D.amber}66`, background: D.amber + "1c", color: D.amber }}
      >
        <CalendarPlus size={13} /> Connect Calendar
      </button>
    );
  }

  return (
    <button
      onClick={onManage}
      title={`Google Calendar connected${status.email ? " · " + status.email : ""} — manage in Agenda`}
      style={{ ...base, cursor: "pointer", border: `1px solid ${D.teal}55`, background: D.teal + "14", color: D.teal }}
    >
      <CalendarCheck size={13} /> Calendar
      <span style={{ width: 5, height: 5, borderRadius: 999, background: D.teal, boxShadow: `0 0 6px ${D.teal}` }} />
    </button>
  );
}
