"use client";
// Google Calendar connect + per-calendar panel. Shown in the Schedule view.
// Degrades cleanly: not configured → a quiet "set up" hint; configured but not
// connected → a Connect button; connected → calendar list with Sync-now.
import React, { useState } from "react";
import { CalendarCheck, Plug, RefreshCw, Loader2, Check, X } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { useGoogle } from "../use-google";

export default function GoogleCalendarsPanel() {
  const { status, loading, connect, disconnect, syncCalendar, reload } = useGoogle();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function doSync(calId: string) {
    setSyncing(calId); setResult(null);
    try {
      const r = await syncCalendar(calId);
      if (r.error) setResult(`⚠ ${r.error}`);
      else setResult(`Synced ✓ ${r.pushed || 0} pushed · ${r.updated || 0} updated · ${r.pulled || 0} pulled`);
    } catch (e) { setResult(`⚠ ${String(e)}`); }
    finally { setSyncing(null); }
  }

  const card: React.CSSProperties = {
    border: `1px solid ${D.border}`, borderRadius: 13, background: D.cardGrad, padding: "14px 16px", fontFamily: ft,
  };

  if (loading) {
    return <div style={card}><Loader2 size={14} color={D.txm} style={{ animation: "spin 1s linear infinite" }} /> <span style={{ fontFamily: mn, fontSize: 11, color: D.txm, marginLeft: 6 }}>Checking Google…</span><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  }

  if (!status.configured) {
    return (
      <div style={{ ...card, opacity: 0.85 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Plug size={15} color={D.txd} />
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>
            Google Calendar isn’t set up yet — add the OAuth client and it’ll light up here.
          </span>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CalendarCheck size={18} color={D.amber} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700 }}>Connect Google Calendar</div>
            <div style={{ fontSize: 12, color: D.txm, marginTop: 2 }}>Two-way sync your bookings, blocks and filming with Google.</div>
          </div>
          <button onClick={connect} style={{
            cursor: "pointer", border: "none", borderRadius: 9, padding: "9px 16px", fontFamily: mn, fontSize: 11, fontWeight: 700,
            color: "#15100a", background: `linear-gradient(135deg, ${D.amber}, ${D.amber}cc)`,
          }}>Connect</button>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <CalendarCheck size={16} color={D.teal} />
        <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 700 }}>Google Calendar</span>
        <span style={{ fontFamily: mn, fontSize: 10.5, color: D.teal }}>● {status.email}</span>
        <span style={{ flex: 1 }} />
        <button onClick={disconnect} title="Disconnect" style={{ cursor: "pointer", border: `1px solid ${D.border}`, background: "transparent", color: D.txm, borderRadius: 8, padding: "5px 10px", fontFamily: mn, fontSize: 10 }}>
          Disconnect
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {(status.calendars || []).map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", border: `1px solid ${D.border}`, borderRadius: 9, background: D.card }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c.backgroundColor || D.txm, flex: "none" }} />
            <span style={{ fontFamily: ft, fontSize: 13, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.summary}{c.primary && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginLeft: 6 }}>primary</span>}
            </span>
            <span style={{ flex: 1 }} />
            <button onClick={() => doSync(c.id)} disabled={syncing === c.id} style={{
              display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", borderRadius: 8, padding: "5px 11px",
              border: `1px solid ${D.teal}55`, background: D.teal + "14", color: D.teal, fontFamily: mn, fontSize: 10,
            }}>
              {syncing === c.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
              Sync
            </button>
          </div>
        ))}
      </div>
      {result && (
        <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10.5, color: result.startsWith("⚠") ? D.coral : D.teal, display: "flex", alignItems: "center", gap: 6 }}>
          {result.startsWith("⚠") ? <X size={12} /> : <Check size={12} />} {result}
          <span style={{ flex: 1 }} />
          <button onClick={() => reload()} style={{ border: "none", background: "transparent", color: D.txd, cursor: "pointer", fontFamily: mn, fontSize: 10 }}>refresh</button>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
