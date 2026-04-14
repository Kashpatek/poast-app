// @ts-nocheck
"use client";
import { useState, useEffect } from "react";

// ═══ DESIGN ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// ═══ DATA ═══
var TEAM = [
  { id: "dp", name: "Dylan Patel", role: "Chief Analyst", initials: "DP", color: D.amber, expertise: ["Semiconductors", "AI Infrastructure", "Supply Chain", "Geopolitics"] },
  { id: "do", name: "Doug O'Laughlin", role: "Senior Analyst", initials: "DO", color: D.blue, expertise: ["Memory", "Compute", "Data Centers", "Financial Analysis"] },
  { id: "jn", name: "Jordan Nanos", role: "Analyst", initials: "JN", color: D.teal, expertise: ["AI Models", "ML Infrastructure", "Cloud Computing"] },
  { id: "dn", name: "Dan Nischval", role: "Analyst", initials: "DN", color: D.coral, expertise: ["Hardware Design", "Chip Architecture", "Manufacturing"] },
];

var PIPELINE_COLS = [
  { key: "identified", label: "Identified", color: D.txm },
  { key: "outreach_sent", label: "Outreach Sent", color: D.blue },
  { key: "follow_up", label: "Follow-up", color: D.amber },
  { key: "booked", label: "Booked", color: D.teal },
  { key: "recorded", label: "Recorded", color: D.violet },
  { key: "released", label: "Released", color: "#2EAD8E" },
  { key: "passed", label: "Passed", color: D.coral },
];

var TIERS = ["S", "A", "B", "C"];

function calcFit(memberExpertise, topicFocus) {
  if (!topicFocus || !memberExpertise || memberExpertise.length === 0) return 0;
  var topics = topicFocus.toLowerCase();
  var hits = 0;
  for (var i = 0; i < memberExpertise.length; i++) {
    var words = memberExpertise[i].toLowerCase().split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      if (words[w].length > 2 && topics.indexOf(words[w]) !== -1) { hits++; break; }
    }
  }
  return Math.round((hits / memberExpertise.length) * 100);
}

function fitColor(score) {
  if (score >= 65) return D.teal;
  if (score >= 35) return D.amber;
  return D.coral;
}

function loadData() {
  try { var d = localStorage.getItem("outreach-data"); return d ? JSON.parse(d) : null; } catch (e) { return null; }
}
function saveData(data) {
  try { localStorage.setItem("outreach-data", JSON.stringify(data)); } catch (e) {}
}

// ═══ SUPABASE HELPERS ═══
function toDbRow(opp) {
  var row = {
    show_name: opp.showName || "",
    host: opp.hostName || "",
    audience_size: opp.audience || "",
    topic_focus: opp.topicFocus || "",
    tier: opp.tier || "",
    assigned_to: opp.assignedTo || null,
    status: opp.status || "identified",
    contact: opp.contact || "",
    notes: opp.notes || "",
  };
  if (opp.id) row.id = opp.id;
  return row;
}
function fromDbRow(row) {
  return {
    id: row.id,
    showName: row.show_name || "",
    hostName: row.host || "",
    audience: row.audience_size || "",
    topicFocus: row.topic_focus || "",
    tier: row.tier || "",
    contact: row.contact || "",
    notes: row.notes || "",
    assignedTo: row.assigned_to || null,
    status: row.status || "identified",
    lastAction: row.created_at ? row.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
  };
}
function apiPost(opp) {
  return fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "outreach", data: toDbRow(opp) }),
  }).then(function(r) { return r.json(); });
}
function apiDelete(id) {
  return fetch("/api/db", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "outreach", id: id }),
  }).then(function(r) { return r.json(); });
}

function teamById(id) {
  for (var i = 0; i < TEAM.length; i++) { if (TEAM[i].id === id) return TEAM[i]; }
  return null;
}

// ═══ COMPONENT ═══
export default function Outreach() {
  var _tab = useState("matching"), tab = _tab[0], setTab = _tab[1];
  var _opps = useState([]), opps = _opps[0], setOpps = _opps[1];
  var _showForm = useState(false), showForm = _showForm[0], setShowForm = _showForm[1];
  var _selMember = useState(null), selMember = _selMember[0], setSelMember = _selMember[1];
  var _filterMember = useState("all"), filterMember = _filterMember[0], setFilterMember = _filterMember[1];
  var _filterTopic = useState(""), filterTopic = _filterTopic[0], setFilterTopic = _filterTopic[1];
  var _filterStatus = useState("all"), filterStatus = _filterStatus[0], setFilterStatus = _filterStatus[1];
  var _expandedNotes = useState({}), expandedNotes = _expandedNotes[0], setExpandedNotes = _expandedNotes[1];

  // Form state
  var _fShow = useState(""), fShow = _fShow[0], setFShow = _fShow[1];
  var _fHost = useState(""), fHost = _fHost[0], setFHost = _fHost[1];
  var _fAud = useState(""), fAud = _fAud[0], setFAud = _fAud[1];
  var _fTopic = useState(""), fTopic = _fTopic[0], setFTopic = _fTopic[1];
  var _fTier = useState("A"), fTier = _fTier[0], setFTier = _fTier[1];
  var _fContact = useState(""), fContact = _fContact[0], setFContact = _fContact[1];
  var _fNotes = useState(""), fNotes = _fNotes[0], setFNotes = _fNotes[1];

  // Load from API first, fall back to localStorage
  useEffect(function() {
    var cancelled = false;
    fetch("/api/db?table=outreach").then(function(r) { return r.json(); }).then(function(res) {
      if (cancelled) return;
      if (res.data && res.data.length > 0) {
        var mapped = res.data.map(fromDbRow);
        setOpps(mapped);
        saveData({ opps: mapped });
      } else {
        var d = loadData();
        if (d && d.opps) setOpps(d.opps);
      }
    }).catch(function() {
      if (cancelled) return;
      var d = loadData();
      if (d && d.opps) setOpps(d.opps);
    });
    return function() { cancelled = true; };
  }, []);

  function addOpp() {
    if (!fShow.trim()) return;
    var opp = {
      showName: fShow.trim(),
      hostName: fHost.trim(),
      audience: fAud.trim(),
      topicFocus: fTopic.trim(),
      tier: fTier,
      contact: fContact.trim(),
      notes: fNotes.trim(),
      assignedTo: null,
      status: "identified",
      lastAction: new Date().toISOString().split("T")[0],
    };
    // POST to API -- don't send id, let Supabase generate it
    apiPost(opp).then(function(res) {
      if (res.data && res.data[0]) {
        var saved = fromDbRow(res.data[0]);
        setOpps(function(p) { var next = [saved].concat(p); saveData({ opps: next }); return next; });
      } else {
        // API failed, use local id as fallback
        var fallback = Object.assign({}, opp, { id: Date.now().toString() });
        setOpps(function(p) { var next = [fallback].concat(p); saveData({ opps: next }); return next; });
      }
    }).catch(function() {
      var fallback = Object.assign({}, opp, { id: Date.now().toString() });
      setOpps(function(p) { var next = [fallback].concat(p); saveData({ opps: next }); return next; });
    });
    setFShow(""); setFHost(""); setFAud(""); setFTopic(""); setFTier("A"); setFContact(""); setFNotes("");
    setShowForm(false);
  }

  function assignMember(oppId, memberId) {
    setOpps(function(p) {
      var next = p.map(function(o) { return o.id === oppId ? Object.assign({}, o, { assignedTo: memberId, lastAction: new Date().toISOString().split("T")[0] }) : o; });
      saveData({ opps: next });
      var updated = next.find(function(o) { return o.id === oppId; });
      if (updated) apiPost(updated).catch(function() {});
      return next;
    });
  }

  function moveStatus(oppId, newStatus) {
    setOpps(function(p) {
      var next = p.map(function(o) { return o.id === oppId ? Object.assign({}, o, { status: newStatus, lastAction: new Date().toISOString().split("T")[0] }) : o; });
      saveData({ opps: next });
      var updated = next.find(function(o) { return o.id === oppId; });
      if (updated) apiPost(updated).catch(function() {});
      return next;
    });
  }

  function deleteOpp(oppId) {
    apiDelete(oppId).catch(function() {});
    setOpps(function(p) { var next = p.filter(function(o) { return o.id !== oppId; }); saveData({ opps: next }); return next; });
  }

  function countAssigned(memberId) {
    var c = 0;
    for (var i = 0; i < opps.length; i++) { if (opps[i].assignedTo === memberId) c++; }
    return c;
  }

  // Sort opportunities by fit score if a member is selected
  function getSortedOpps() {
    var list = opps.slice();
    if (selMember) {
      var member = teamById(selMember);
      if (member) {
        list.sort(function(a, b) {
          return calcFit(member.expertise, b.topicFocus) - calcFit(member.expertise, a.topicFocus);
        });
      }
    }
    return list;
  }

  // Pipeline filter
  function getFilteredOpps() {
    return opps.filter(function(o) {
      if (filterMember !== "all" && o.assignedTo !== filterMember) return false;
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterTopic && o.topicFocus.toLowerCase().indexOf(filterTopic.toLowerCase()) === -1) return false;
      return true;
    });
  }

  function oppsByStatus(status) {
    var filtered = getFilteredOpps();
    return filtered.filter(function(o) { return o.status === status; });
  }

  var tierColors = { S: D.coral, A: D.amber, B: D.blue, C: D.txm };

  // ═══ INPUT STYLE ═══
  var inputStyle = {
    width: "100%", padding: "10px 14px", background: D.surface, border: "1px solid " + D.border,
    borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  var labelStyle = { fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: ft, color: D.tx, letterSpacing: -1 }}>Outreach</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginTop: 4 }}>External podcast placement // Get SA out there</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, borderBottom: "1px solid " + D.border }}>
        {[{ key: "matching", label: "Matching" }, { key: "pipeline", label: "Pipeline" }].map(function(t) {
          var active = tab === t.key;
          return (
            <div key={t.key} onClick={function() { setTab(t.key); }}
              style={{
                padding: "12px 28px", cursor: "pointer", fontFamily: ft, fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? D.coral : D.txm, borderBottom: active ? "2px solid " + D.coral : "2px solid transparent",
                transition: "all 0.15s", letterSpacing: 0.5,
              }}>{t.label}</div>
          );
        })}
      </div>

      {/* ═══ TAB: MATCHING ═══ */}
      {tab === "matching" && (
        <div>
          {/* Team Members */}
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Team Members</div>
          <div style={{ display: "flex", gap: 14, marginBottom: 36, overflowX: "auto", paddingBottom: 8 }}>
            {TEAM.map(function(m) {
              var sel = selMember === m.id;
              return (
                <div key={m.id} onClick={function() { setSelMember(sel ? null : m.id); }}
                  style={{
                    minWidth: 220, padding: "18px 20px", background: sel ? D.hover : D.card, border: "1px solid " + (sel ? m.color + "60" : D.border),
                    borderRadius: 12, cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
                    boxShadow: sel ? "0 0 20px " + m.color + "15" : "none",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", background: m.color + "20", border: "2px solid " + m.color,
                      display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 13, fontWeight: 700, color: m.color,
                    }}>{m.initials}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: D.tx }}>{m.name}</div>
                      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{m.role}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {m.expertise.map(function(e) {
                      return <span key={e} style={{
                        padding: "3px 8px", background: m.color + "12", border: "1px solid " + m.color + "30",
                        borderRadius: 20, fontFamily: mn, fontSize: 9, color: m.color, whiteSpace: "nowrap",
                      }}>{e}</span>;
                    })}
                  </div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{countAssigned(m.id)} assigned</div>
                </div>
              );
            })}
          </div>

          {/* Add Opportunity */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 2, textTransform: "uppercase" }}>Podcast Opportunities</div>
            <div onClick={function() { setShowForm(!showForm); }}
              style={{
                padding: "8px 18px", background: D.coral + "18", border: "1px solid " + D.coral + "40", borderRadius: 8,
                cursor: "pointer", fontFamily: ft, fontSize: 12, fontWeight: 600, color: D.coral, transition: "all 0.15s",
              }}>{showForm ? "Cancel" : "+ Add Opportunity"}</div>
          </div>

          {/* Add Form */}
          {showForm && (
            <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Show Name</label>
                  <input value={fShow} onChange={function(e) { setFShow(e.target.value); }} placeholder="e.g. Acquired" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Host Name</label>
                  <input value={fHost} onChange={function(e) { setFHost(e.target.value); }} placeholder="e.g. Ben Gilbert" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Audience Size</label>
                  <input value={fAud} onChange={function(e) { setFAud(e.target.value); }} placeholder="e.g. 500K" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tier</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {TIERS.map(function(t) {
                      var on = fTier === t;
                      return <div key={t} onClick={function() { setFTier(t); }}
                        style={{
                          flex: 1, padding: "10px 0", textAlign: "center", background: on ? (tierColors[t] || D.txm) + "20" : D.surface,
                          border: "1px solid " + (on ? (tierColors[t] || D.txm) + "60" : D.border), borderRadius: 8, cursor: "pointer",
                          fontFamily: mn, fontSize: 12, fontWeight: 700, color: on ? tierColors[t] || D.txm : D.txd, transition: "all 0.15s",
                        }}>{t}</div>;
                    })}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Topic Focus</label>
                <input value={fTopic} onChange={function(e) { setFTopic(e.target.value); }} placeholder="e.g. AI chips, semiconductor supply chain, data center infrastructure" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Contact Info</label>
                  <input value={fContact} onChange={function(e) { setFContact(e.target.value); }} placeholder="Email or social handle" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Notes</label>
                  <input value={fNotes} onChange={function(e) { setFNotes(e.target.value); }} placeholder="Any context" style={inputStyle} />
                </div>
              </div>
              <div onClick={addOpp}
                style={{
                  padding: "12px 24px", background: D.coral, borderRadius: 8, cursor: "pointer", display: "inline-block",
                  fontFamily: ft, fontSize: 13, fontWeight: 700, color: "#fff", transition: "all 0.15s",
                }}>Add Opportunity</div>
            </div>
          )}

          {/* Opportunity List */}
          {getSortedOpps().length === 0 && !showForm && (
            <div style={{ padding: 40, textAlign: "center", color: D.txd, fontFamily: mn, fontSize: 12 }}>No opportunities yet. Click "+ Add Opportunity" to get started.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {getSortedOpps().map(function(opp) {
              var assigned = teamById(opp.assignedTo);
              var fitScores = selMember ? [{ member: teamById(selMember), score: calcFit(teamById(selMember).expertise, opp.topicFocus) }] : TEAM.map(function(m) { return { member: m, score: calcFit(m.expertise, opp.topicFocus) }; });

              return (
                <div key={opp.id} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: "18px 22px", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: D.tx }}>{opp.showName}</span>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontFamily: mn, fontSize: 10, fontWeight: 700,
                          background: (tierColors[opp.tier] || D.txm) + "18", color: tierColors[opp.tier] || D.txm,
                          border: "1px solid " + (tierColors[opp.tier] || D.txm) + "30",
                        }}>Tier {opp.tier}</span>
                      </div>
                      <div style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>
                        {opp.hostName && <span>Host: {opp.hostName}</span>}
                        {opp.hostName && opp.audience && <span style={{ margin: "0 8px", color: D.txd }}>|</span>}
                        {opp.audience && <span>Audience: ~{opp.audience}</span>}
                      </div>
                      {opp.topicFocus && <div style={{ fontFamily: ft, fontSize: 12, color: D.txd, marginTop: 6 }}>Topics: {opp.topicFocus}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Assign dropdown */}
                      <select value={opp.assignedTo || ""} onChange={function(e) { assignMember(opp.id, e.target.value || null); }}
                        style={{
                          padding: "6px 10px", background: D.surface, border: "1px solid " + D.border, borderRadius: 6,
                          color: D.tx, fontFamily: ft, fontSize: 12, outline: "none", cursor: "pointer",
                        }}>
                        <option value="">Assign...</option>
                        {TEAM.map(function(m) { return <option key={m.id} value={m.id}>{m.name}</option>; })}
                      </select>
                      <div onClick={function() { deleteOpp(opp.id); }}
                        style={{ width: 28, height: 28, borderRadius: 6, background: D.coral + "15", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: D.coral, fontSize: 14, fontWeight: 700 }}>x</div>
                    </div>
                  </div>

                  {/* Fit Scores */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {fitScores.map(function(fs) {
                      var c = fitColor(fs.score);
                      return (
                        <div key={fs.member.id} style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontFamily: mn, fontSize: 9, color: D.txm }}>{fs.member.initials}</span>
                            <span style={{ fontFamily: mn, fontSize: 9, color: c, fontWeight: 700 }}>{fs.score}%</span>
                          </div>
                          <div style={{ height: 4, background: D.surface, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: fs.score + "%", background: c, borderRadius: 2, transition: "width 0.3s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Assigned badge */}
                  {assigned && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 10px", background: assigned.color + "12", border: "1px solid " + assigned.color + "30", borderRadius: 20 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: assigned.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 8, fontWeight: 700, color: assigned.color }}>{assigned.initials}</div>
                      <span style={{ fontFamily: mn, fontSize: 10, color: assigned.color }}>{assigned.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB: PIPELINE ═══ */}
      {tab === "pipeline" && (
        <div>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <label style={labelStyle}>Team Member</label>
              <select value={filterMember} onChange={function(e) { setFilterMember(e.target.value); }}
                style={{ padding: "8px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none", cursor: "pointer" }}>
                <option value="all">All Members</option>
                {TEAM.map(function(m) { return <option key={m.id} value={m.id}>{m.name}</option>; })}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <input value={filterTopic} onChange={function(e) { setFilterTopic(e.target.value); }} placeholder="Filter by topic..." style={Object.assign({}, inputStyle, { width: 180 })} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={filterStatus} onChange={function(e) { setFilterStatus(e.target.value); }}
                style={{ padding: "8px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none", cursor: "pointer" }}>
                <option value="all">All Statuses</option>
                {PIPELINE_COLS.map(function(col) { return <option key={col.key} value={col.key}>{col.label}</option>; })}
              </select>
            </div>
          </div>

          {/* Kanban columns */}
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 20, minHeight: 400 }}>
            {PIPELINE_COLS.map(function(col) {
              var colOpps = oppsByStatus(col.key);
              var colIdx = PIPELINE_COLS.findIndex(function(c) { return c.key === col.key; });
              return (
                <div key={col.key} style={{ minWidth: 240, maxWidth: 260, flex: "0 0 240px" }}>
                  {/* Column header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "10px 14px", background: col.color + "10", border: "1px solid " + col.color + "25", borderRadius: 10, borderTop: "3px solid " + col.color }}>
                    <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                    <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginLeft: "auto" }}>{colOpps.length}</span>
                  </div>

                  {/* Cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {colOpps.map(function(opp) {
                      var assigned = teamById(opp.assignedTo);
                      var notesOpen = expandedNotes[opp.id];
                      return (
                        <div key={opp.id} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 10, padding: 14, transition: "all 0.15s" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: D.tx, marginBottom: 4 }}>{opp.showName}</div>
                          <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginBottom: 8 }}>{opp.hostName || "No host"}</div>

                          {/* Assigned member */}
                          {assigned && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 8, padding: "3px 8px", background: assigned.color + "12", border: "1px solid " + assigned.color + "25", borderRadius: 16 }}>
                              <div style={{ width: 16, height: 16, borderRadius: "50%", background: assigned.color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 7, fontWeight: 700, color: assigned.color }}>{assigned.initials}</div>
                              <span style={{ fontFamily: mn, fontSize: 9, color: assigned.color }}>{assigned.name.split(" ")[0]}</span>
                            </div>
                          )}
                          {!assigned && (
                            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 8, fontStyle: "italic" }}>Unassigned</div>
                          )}

                          {/* Last action date */}
                          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 10 }}>{opp.lastAction}</div>

                          {/* Notes toggle */}
                          {opp.notes && (
                            <div>
                              <div onClick={function() { setExpandedNotes(function(p) { var n = Object.assign({}, p); n[opp.id] = !n[opp.id]; return n; }); }}
                                style={{ fontFamily: mn, fontSize: 9, color: D.coral, cursor: "pointer", marginBottom: notesOpen ? 6 : 0 }}>
                                {notesOpen ? "- hide notes" : "+ show notes"}
                              </div>
                              {notesOpen && (
                                <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, padding: "8px 10px", background: D.surface, borderRadius: 6, lineHeight: 1.5 }}>{opp.notes}</div>
                              )}
                            </div>
                          )}

                          {/* Move buttons */}
                          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            {colIdx > 0 && (
                              <div onClick={function() { moveStatus(opp.id, PIPELINE_COLS[colIdx - 1].key); }}
                                style={{
                                  flex: 1, padding: "6px 0", textAlign: "center", background: D.surface, border: "1px solid " + D.border,
                                  borderRadius: 6, cursor: "pointer", fontFamily: mn, fontSize: 10, color: D.txm, transition: "all 0.15s",
                                }}>&#8592;</div>
                            )}
                            {colIdx < PIPELINE_COLS.length - 1 && (
                              <div onClick={function() { moveStatus(opp.id, PIPELINE_COLS[colIdx + 1].key); }}
                                style={{
                                  flex: 1, padding: "6px 0", textAlign: "center", background: D.surface, border: "1px solid " + D.border,
                                  borderRadius: 6, cursor: "pointer", fontFamily: mn, fontSize: 10, color: D.txm, transition: "all 0.15s",
                                }}>&#8594;</div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {colOpps.length === 0 && (
                      <div style={{ padding: "20px 14px", textAlign: "center", fontFamily: mn, fontSize: 10, color: D.txd, border: "1px dashed " + D.border, borderRadius: 10 }}>Empty</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
