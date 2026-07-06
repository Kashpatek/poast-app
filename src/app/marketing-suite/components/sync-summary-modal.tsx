"use client";
// Shown after a top-bar "Sync now": what the pull brought in — new events,
// changed events, and invites still awaiting a reply (accept / maybe / decline,
// written straight back to Google). House style: inline styles + D tokens.
import React, { useState } from "react";
import { Modal } from "./modal";
import { D, ft, gf, mn } from "../../shared-constants";
import { CalendarPlus, CalendarClock, Check, X as XIcon, HelpCircle, MailPlus, PartyPopper } from "lucide-react";

export interface SyncChange {
  gcalId: string; calendarId: string; title: string; start: string | null;
  organizer?: string | null; myResponse?: string | null;
}
export interface SyncSummary {
  calendars?: number; pulled?: number; pushed?: number;
  changes?: { added: SyncChange[]; updated: SyncChange[]; invites: SyncChange[]; removed: number };
}
type RsvpResponse = "accepted" | "declined" | "tentative";
type Rsvp = (calendarId: string, eventId: string, response: RsvpResponse) => Promise<{ ok?: boolean }>;

function fmtWhen(start: string | null): string {
  if (!start) return "";
  const d = new Date(start);
  if (isNaN(+d)) return "";
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const RESP_LABEL: Record<RsvpResponse, string> = { accepted: "Going", tentative: "Maybe", declined: "Declined" };
const RESP_COLOR: Record<RsvpResponse, string> = { accepted: D.teal, tentative: D.amber, declined: D.coral };

export default function SyncSummaryModal({
  open, summary, onClose, onRsvp,
}: { open: boolean; summary: SyncSummary | null; onClose: () => void; onRsvp: Rsvp }) {
  const ch = summary?.changes;
  const [replied, setReplied] = useState<Record<string, RsvpResponse>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const added = ch?.added || [];
  const updated = ch?.updated || [];
  const invites = ch?.invites || [];
  const removed = ch?.removed || 0;
  const nothing = !added.length && !updated.length && !invites.length && !removed;

  async function reply(inv: SyncChange, response: RsvpResponse) {
    if (busy) return;
    setBusy(inv.gcalId);
    try {
      const r = await onRsvp(inv.calendarId, inv.gcalId, response);
      if (r?.ok) setReplied((m) => ({ ...m, [inv.gcalId]: response }));
    } finally {
      setBusy(null);
    }
  }

  const subtitle = summary
    ? `${summary.calendars ?? 0} calendar${(summary.calendars ?? 0) === 1 ? "" : "s"} · ${added.length} new · ${updated.length} updated${removed ? ` · ${removed} removed` : ""}`
    : "";

  const rowCard: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
    border: `1px solid ${D.border}`, borderRadius: 10, background: D.cardGrad,
  };
  const sectionLbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: D.txm, margin: "18px 0 8px" };

  function metaLine(c: SyncChange) {
    return <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txm, marginTop: 2 }}>{fmtWhen(c.start)}{c.organizer ? ` · ${c.organizer}` : ""}</div>;
  }
  function rsvpBtn(inv: SyncChange, r: RsvpResponse, Icon: typeof Check) {
    return (
      <button
        onClick={() => reply(inv, r)}
        disabled={!!busy}
        title={RESP_LABEL[r]}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, cursor: busy ? "default" : "pointer",
          border: `1px solid ${RESP_COLOR[r]}66`, background: RESP_COLOR[r] + "16", color: RESP_COLOR[r],
          borderRadius: 8, padding: "5px 9px", fontFamily: mn, fontSize: 10, fontWeight: 700, opacity: busy ? 0.6 : 1,
        }}
      >
        <Icon size={12} /> {RESP_LABEL[r]}
      </button>
    );
  }

  return (
    <Modal
      open={open}
      title="Calendar synced"
      subtitle={subtitle}
      accent={D.teal}
      icon={<CalendarClock size={18} color={D.teal} />}
      onClose={onClose}
      width={560}
      footer={<button onClick={onClose} style={{ cursor: "pointer", border: "none", borderRadius: 9, padding: "9px 18px", fontFamily: mn, fontSize: 11, fontWeight: 700, color: "#0c1512", background: D.teal }}>Done</button>}
    >
      <div style={{ padding: "4px 2px" }}>
        {nothing && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 6px", fontFamily: ft, fontSize: 13, color: D.txm }}>
            <PartyPopper size={18} color={D.teal} /> You&apos;re all caught up — nothing changed since the last sync.
          </div>
        )}

        {invites.length > 0 && (
          <>
            <div style={sectionLbl}><MailPlus size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />Invites awaiting your reply · {invites.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {invites.map((inv) => {
                const done = replied[inv.gcalId];
                return (
                  <div key={inv.gcalId} style={{ ...rowCard, alignItems: "flex-start", flexDirection: "column", gap: 8 }}>
                    <div style={{ width: "100%" }}>
                      <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx }}>{inv.title}</div>
                      {metaLine(inv)}
                    </div>
                    {done ? (
                      <span style={{ fontFamily: mn, fontSize: 10.5, fontWeight: 700, color: RESP_COLOR[done], display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Check size={13} /> {RESP_LABEL[done]}
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: 7 }}>
                        {rsvpBtn(inv, "accepted", Check)}
                        {rsvpBtn(inv, "tentative", HelpCircle)}
                        {rsvpBtn(inv, "declined", XIcon)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {added.length > 0 && (
          <>
            <div style={sectionLbl}><CalendarPlus size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />New on your calendar · {added.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {added.slice(0, 30).map((c) => (
                <div key={c.gcalId} style={rowCard}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: D.teal, flex: "none" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                    {metaLine(c)}
                  </div>
                </div>
              ))}
              {added.length > 30 && <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd }}>+ {added.length - 30} more</div>}
            </div>
          </>
        )}

        {updated.length > 0 && (
          <>
            <div style={sectionLbl}><CalendarClock size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />Updated · {updated.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {updated.slice(0, 30).map((c) => (
                <div key={c.gcalId} style={rowCard}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: D.amber, flex: "none" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                    {metaLine(c)}
                  </div>
                </div>
              ))}
              {updated.length > 30 && <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd }}>+ {updated.length - 30} more</div>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
