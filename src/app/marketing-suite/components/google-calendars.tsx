"use client";
// Google Calendar connect + per-calendar panel. Shown in the Schedule view.
// Degrades cleanly: not configured → a quiet "set up" hint; configured but not
// connected → a Connect button; connected → the calendar list where you choose
// which calendars feed MarketingSUITE (checkbox) and sync them.
import React, { useState } from "react";
import { CalendarCheck, Plug, RefreshCw, Loader2, Check, X, Square, CheckSquare } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { useGoogle } from "../use-google";

export default function GoogleCalendarsPanel({ onChanged }: { onChanged?: () => void }) {
  const { status, loading, connect, disconnect, syncCalendar, setCalendarSelected, syncSelected, isSelected } = useGoogle();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function doSync(calId: string) {
    setSyncing(calId); setResult(null);
    try {
      const r = await syncCalendar(calId);
      if (r.error) setResult(`⚠ ${r.error}`);
      else setResult(`Synced ✓ ${r.pushed || 0} pushed · ${r.updated || 0} updated · ${r.pulled || 0} pulled`);
      onChanged?.();
    } catch (e) { setResult(`⚠ ${String(e)}`); }
    finally { setSyncing(null); }
  }

  async function doToggle(calId: string, on: boolean) {
    setToggling(calId); setResult(null);
    try {
      const r = await setCalendarSelected(calId, on);
      if (r && r.error) setResult(`⚠ ${r.error}`);
      else if (on) setResult(`Added ✓ ${r?.pulled || 0} event${(r?.pulled || 0) === 1 ? "" : "s"} pulled in`);
      else setResult(`Hidden — removed ${r?.purged || 0} event${(r?.purged || 0) === 1 ? "" : "s"} from the suite`);
      onChanged?.();
    } catch (e) { setResult(`⚠ ${String(e)}`); }
    finally { setToggling(null); }
  }

  async function doSyncSelected() {
    setSyncingAll(true); setResult(null);
    try {
      const r = await syncSelected();
      if (r.error) setResult(`⚠ ${r.error}`);
      else setResult(`Synced ${r.calendars || 0} calendar${(r.calendars || 0) === 1 ? "" : "s"} ✓ ${r.pulled || 0} pulled · ${r.pushed || 0} pushed`);
      onChanged?.();
    } catch (e) { setResult(`⚠ ${String(e)}`); }
    finally { setSyncingAll(false); }
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

  const calendars = status.calendars || [];
  const selectedCount = calendars.filter((c) => isSelected(c.id)).length;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <CalendarCheck size={16} color={D.teal} />
        <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 700 }}>Google Calendar</span>
        <span style={{ fontFamily: mn, fontSize: 10.5, color: D.teal }}>● {status.email}</span>
        <span style={{ flex: 1 }} />
        <button onClick={doSyncSelected} disabled={syncingAll || selectedCount === 0} title="Pull in events from every selected calendar" style={{
          display: "inline-flex", alignItems: "center", gap: 5, cursor: selectedCount === 0 ? "default" : "pointer",
          border: `1px solid ${D.teal}55`, background: D.teal + "14", color: D.teal, borderRadius: 8, padding: "5px 11px",
          fontFamily: mn, fontSize: 10, fontWeight: 700, opacity: selectedCount === 0 ? 0.5 : 1,
        }}>
          {syncingAll ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
          Sync selected
        </button>
        <button onClick={disconnect} title="Disconnect" style={{ cursor: "pointer", border: `1px solid ${D.border}`, background: "transparent", color: D.txm, borderRadius: 8, padding: "5px 10px", fontFamily: mn, fontSize: 10 }}>
          Disconnect
        </button>
      </div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginBottom: 10 }}>
        Check the calendars to pull into MarketingSUITE — {selectedCount}/{calendars.length} on.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {calendars.map((c) => {
          const on = isSelected(c.id);
          const busyToggle = toggling === c.id;
          return (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 9px",
              border: `1px solid ${on ? D.border : D.border + "88"}`, borderRadius: 9,
              background: on ? D.card : "transparent", opacity: on ? 1 : 0.62,
              transition: "opacity 0.14s, background 0.14s",
            }}>
              <button
                onClick={() => !busyToggle && doToggle(c.id, !on)}
                disabled={busyToggle}
                title={on ? "Feeding the suite — click to hide" : "Hidden — click to pull this calendar in"}
                style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", cursor: "pointer", color: on ? D.teal : D.txd, padding: 0, flex: "none" }}
              >
                {busyToggle ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : on ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: c.backgroundColor || D.txm, flex: "none" }} />
              <span style={{ fontFamily: ft, fontSize: 13, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.summary}{c.primary && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginLeft: 6 }}>primary</span>}
              </span>
              <span style={{ flex: 1 }} />
              <button onClick={() => doSync(c.id)} disabled={syncing === c.id || !on} title={on ? "Refresh this calendar now" : "Turn the calendar on to sync it"} style={{
                display: "inline-flex", alignItems: "center", gap: 5, cursor: on ? "pointer" : "default", borderRadius: 8, padding: "5px 11px",
                border: `1px solid ${D.teal}55`, background: D.teal + "14", color: D.teal, fontFamily: mn, fontSize: 10, opacity: on ? 1 : 0.4,
              }}>
                {syncing === c.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
                Sync
              </button>
            </div>
          );
        })}
      </div>
      {result && (
        <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10.5, color: result.startsWith("⚠") ? D.coral : D.teal, display: "flex", alignItems: "center", gap: 6 }}>
          {result.startsWith("⚠") ? <X size={12} /> : <Check size={12} />} {result}
          <span style={{ flex: 1 }} />
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
