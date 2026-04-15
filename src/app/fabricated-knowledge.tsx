// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import { TEAM } from "./shared-constants";

// ═══ DESIGN ═══
var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var TABS = ["Prospects", "Development", "Scheduled", "Post-Production", "Released"];
var DEV_STATUSES = ["Contacted", "Confirmed", "Scheduled"];
var DEV_STATUS_C = { Contacted: D.blue, Confirmed: D.amber, Scheduled: D.teal };
var TIERS = ["S", "A", "B", "C"];
var TIER_C = { S: D.amber, A: D.blue, B: D.teal, C: D.txm };
var CATEGORIES = ["Semiconductors", "AI Infra", "Data Center", "Memory", "Geopolitics", "Compute", "Other"];
var HOST = TEAM.find(function(t) { return t.id === "do"; }).name;

// ═══ DEFAULT DATA ═══
var DEFAULT_PROSPECTS = [
  { id: "fk-default-val", name: "Val Bercovici", company: "WEKA", role: "Executive", topics: "KV Cache, Disaggregated Inference, Memory Architecture, Memory Markets, HBM Pricing, Agentic Demand", tier: "S", bio: "", devStatus: "", added: 1736899200000 },
  { id: "fk-default-rajesh", name: "Rajesh Vashist", company: "SiTime", role: "CEO", topics: "MEMS Timing, Precision Oscillators, Semiconductor Clocks", tier: "S", bio: "", devStatus: "", added: 1736812800000 },
  { id: "fk-default-tony", name: "Tony Pialis", company: "Alphawave", role: "CEO", topics: "Connectivity IP, SerDes, Chiplets, High-Speed Interfaces", tier: "A", bio: "", devStatus: "", added: 1736726400000 },
  { id: "fk-default-dan", name: "Dan Kim", company: "CHIPS Program", role: "Executive", topics: "CHIPS Act, Semiconductor Policy, US Fab Investment", tier: "A", bio: "", devStatus: "", added: 1736640000000 },
  { id: "fk-default-hasan", name: "Hasan Khan", company: "CHIPS Program", role: "Executive", topics: "CHIPS Act, Semiconductor Policy, US Fab Investment", tier: "A", bio: "", devStatus: "", added: 1736553600000 },
  { id: "fk-default-wes", name: "Wes Cummins", company: "Applied Digital", role: "CEO", topics: "GPU Cloud, AI Infrastructure, Datacenter Development", tier: "A", bio: "", devStatus: "", added: 1736467200000 },
  { id: "fk-default-will", name: "Will Eatherton", company: "Cisco", role: "SVP Engineering", topics: "AI Networking, Datacenter Infrastructure, Modular Systems", tier: "A", bio: "", devStatus: "", added: 1736380800000 },
];

var DEFAULT_EPISODES = [
  { id: "fk-ep-default-1", number: "1", guestId: "fk-default-rajesh", topic: "MEMS Timing, Precision Oscillators, Semiconductor Clocks", recordDate: "", releaseDate: "2025-07-26", status: "Released", notes: "Rajesh Vashist on SiTime and the Future of MEMS Timing", added: 1753488000000 },
  { id: "fk-ep-default-2", number: "2", guestId: "fk-default-tony", topic: "Connectivity IP, SerDes, Chiplets, High-Speed Interfaces", recordDate: "", releaseDate: "2025-08-15", status: "Released", notes: "Tony Pialis on Alphawave and Next-Gen Connectivity", added: 1755216000000 },
  { id: "fk-ep-default-3", number: "3", guestId: "fk-default-rajesh", topic: "SiTime Business Update, MEMS Market Dynamics", recordDate: "", releaseDate: "2025-09-10", status: "Released", notes: "Rajesh Vashist: SiTime Update", added: 1757462400000 },
  { id: "fk-ep-default-4", number: "4", guestId: "fk-default-dan", topic: "CHIPS Act Implementation, US Semiconductor Strategy", recordDate: "", releaseDate: "2025-09-25", status: "Released", notes: "Dan Kim & Hasan Khan on the CHIPS Program", added: 1758758400000 },
  { id: "fk-ep-default-5", number: "5", guestId: "fk-default-wes", topic: "GPU Cloud, AI Infrastructure, Datacenter Development", recordDate: "", releaseDate: "2025-10-20", status: "Released", notes: "Wes Cummins: CEO of Applied Digital on AI Infrastructure", added: 1760918400000 },
  { id: "fk-ep-default-6", number: "6", guestId: "fk-default-val", topic: "KV Cache, Disaggregated Inference, Prefill/Decode Architecture", recordDate: "", releaseDate: "2025-10-27", status: "Released", notes: "Val Bercovici on Disaggregated Prefill/Decode", added: 1761523200000 },
  { id: "fk-ep-default-7", number: "7", guestId: "fk-default-will", topic: "AI Networking, Datacenter Infrastructure, Modular Systems", recordDate: "", releaseDate: "2025-11-20", status: "Released", notes: "Will Eatherton: How Cisco Plans to Compete in the AI Datacenter", added: 1763596800000 },
  { id: "fk-ep-default-8", number: "8", guestId: "fk-default-val", topic: "Memory Markets, HBM Pricing, Agentic Demand", recordDate: "", releaseDate: "2026-02-16", status: "Released", notes: "Val Bercovici on Memory Markets", added: 1771200000000 },
];

var DEFAULT_ARCHIVE = [
  { id: "fk-arc-default-1", number: "1", guest: "Rajesh Vashist", company: "SiTime", topic: "MEMS Timing, Precision Oscillators, Semiconductor Clocks", category: "Semiconductors", releaseDate: "2025-07-26", plays: 0 },
  { id: "fk-arc-default-2", number: "2", guest: "Tony Pialis", company: "Alphawave", topic: "Connectivity IP, SerDes, Chiplets, High-Speed Interfaces", category: "Semiconductors", releaseDate: "2025-08-15", plays: 0 },
  { id: "fk-arc-default-3", number: "3", guest: "Rajesh Vashist", company: "SiTime", topic: "SiTime Business Update, MEMS Market Dynamics", category: "Semiconductors", releaseDate: "2025-09-10", plays: 0 },
  { id: "fk-arc-default-4", number: "4", guest: "Dan Kim & Hasan Khan", company: "CHIPS Program", topic: "CHIPS Act Implementation, US Semiconductor Strategy", category: "Geopolitics", releaseDate: "2025-09-25", plays: 0 },
  { id: "fk-arc-default-5", number: "5", guest: "Wes Cummins", company: "Applied Digital", topic: "GPU Cloud, AI Infrastructure, Datacenter Development", category: "Compute", releaseDate: "2025-10-20", plays: 0 },
  { id: "fk-arc-default-6", number: "6", guest: "Val Bercovici", company: "WEKA", topic: "KV Cache, Disaggregated Inference, Prefill/Decode Architecture", category: "AI Infra", releaseDate: "2025-10-27", plays: 0 },
  { id: "fk-arc-default-7", number: "7", guest: "Will Eatherton", company: "Cisco", topic: "AI Networking, Datacenter Infrastructure, Modular Systems", category: "Data Center", releaseDate: "2025-11-20", plays: 0 },
  { id: "fk-arc-default-8", number: "8", guest: "Val Bercovici", company: "WEKA", topic: "Memory Markets, HBM Pricing, Agentic Demand", category: "Memory", releaseDate: "2026-02-16", plays: 0 },
];

function uid() { return "fk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8); }
function ls(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function ss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ═══ SUPABASE API HELPERS ═══
function dbFetch(table) {
  return fetch("/api/db?table=" + encodeURIComponent(table))
    .then(function(r) { if (!r.ok) throw new Error("API " + r.status); return r.json(); })
    .then(function(d) {
      if (!d.data || d.data.length === 0) return null;
      if (table === "prospects") {
        return d.data.map(function(r) {
          return { id: r.id, name: r.name, company: r.company, role: r.role, topics: Array.isArray(r.topics) ? r.topics.join(", ") : (r.topics || ""), tier: r.tier, bio: r.bio || "", devStatus: r.dev_status || "", recordDate: r.record_date || "", added: new Date(r.created_at).getTime() };
        });
      }
      if (table === "episodes") {
        return d.data.map(function(r) {
          return { id: r.id, number: String(r.number || ""), guestId: "", guestName: r.guest_name || "", topic: r.topic || "", recordDate: r.record_date || "", releaseDate: r.release_date || "", status: r.status || "", notes: r.notes || "", added: new Date(r.created_at).getTime() };
        });
      }
      if (table === "archive") {
        return d.data.map(function(r) {
          return { id: r.id, number: String(r.episode_number || ""), guest: r.guest || "", company: r.company || "", topic: r.topic || "", category: r.category || "", releaseDate: r.release_date || "", plays: r.plays || 0 };
        });
      }
      return d.data;
    });
}

function dbUpsert(table, row) {
  return fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: table, data: row }),
  }).then(function(r) { if (!r.ok) throw new Error("API " + r.status); return r.json(); });
}

function dbDelete(table, id) {
  return fetch("/api/db", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: table, id: id }),
  }).then(function(r) { if (!r.ok) throw new Error("API " + r.status); return r.json(); });
}

// ═══ TOAST ═══
var _toast = { current: null };
function toast(msg, type) { if (_toast.current) _toast.current(msg, type); }
function Toasts() {
  var _l = useState([]), l = _l[0], sl = _l[1];
  _toast.current = function(m, t) { var id = Date.now(); sl(function(p) { return [{ id: id, m: m, t: t || "success" }].concat(p).slice(0, 4); }); setTimeout(function() { sl(function(p) { return p.filter(function(x) { return x.id !== id; }); }); }, 3500); };
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes fkIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes fkDr{from{width:100%}to{width:0}}" }} />
    {l.map(function(t) { var c = t.t === "error" ? D.coral : t.t === "info" ? D.amber : D.teal; return <div key={t.id} style={{ background: D.card, border: "1px solid " + D.border, borderLeft: "3px solid " + c, borderRadius: 10, padding: "12px 16px", minWidth: 280, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "fkIn 0.25s ease" }}>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 6 }}>{t.m}</div>
      <div style={{ height: 2, background: D.border, borderRadius: 1 }}><div style={{ height: "100%", background: c, borderRadius: 1, animation: "fkDr 3.5s linear forwards" }} /></div>
    </div>; })}
  </div>;
}

// ═══ REUSABLE COMPONENTS ═══
function Btn(p) {
  var primary = p.primary;
  return <button onClick={p.onClick} disabled={p.disabled} style={{ padding: p.small ? "6px 12px" : "10px 18px", borderRadius: 8, cursor: p.disabled ? "not-allowed" : "pointer", fontFamily: ft, fontSize: p.small ? 11 : 13, fontWeight: 700, border: primary ? "none" : "1px solid " + D.coral, background: primary ? D.coral : "transparent", color: primary ? "#fff" : D.coral, opacity: p.disabled ? 0.4 : 1, transition: "all 0.15s", ...(p.sx || {}) }}>{p.children}</button>;
}

function CopyBtn(p) {
  return <Btn small onClick={function() { navigator.clipboard.writeText(p.text); toast("Copied", "success"); }}>Copy</Btn>;
}

function Badge(p) {
  return <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: (p.bg || D.txd) + "20", color: p.bg || D.txd, letterSpacing: 0.5, fontFamily: mn }}>{p.children}</span>;
}

function Tag(p) {
  return <span style={{ display: "inline-block", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: D.coral + "15", color: D.coral, fontFamily: ft, marginRight: 4, marginBottom: 4 }}>{p.children}</span>;
}

function Input(p) {
  return <input value={p.value} onChange={function(e) { p.onChange(e.target.value); }} placeholder={p.placeholder || ""} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid " + D.border, background: D.surface, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", ...(p.sx || {}) }} />;
}

function Select(p) {
  return <select value={p.value} onChange={function(e) { p.onChange(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid " + D.border, background: D.surface, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", cursor: "pointer", ...(p.sx || {}) }}>
    {p.options.map(function(o) { var val = typeof o === "string" ? o : o.value; var lab = typeof o === "string" ? o : o.label; return <option key={val} value={val}>{lab}</option>; })}
  </select>;
}

function TextArea(p) {
  return <textarea value={p.value} onChange={function(e) { p.onChange(e.target.value); }} placeholder={p.placeholder || ""} rows={p.rows || 6} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid " + D.border, background: D.surface, color: D.tx, fontFamily: p.mono ? mn : ft, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, ...(p.sx || {}) }} />;
}

function Card(p) {
  return <div onClick={p.onClick} style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, padding: p.pad || 20, cursor: p.onClick ? "pointer" : "default", transition: "all 0.15s", ...(p.sx || {}) }}>{p.children}</div>;
}

function SectionLabel(p) {
  return <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txm, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>{p.children}</div>;
}

// ═══ TAB 1: PROSPECTS ═══
function ProspectsTab({ prospects, setProspects, setTab }) {
  var _show = useState(false), showForm = _show[0], setShowForm = _show[1];
  var _filtTier = useState("All"), filtTier = _filtTier[0], setFiltTier = _filtTier[1];
  var _search = useState(""), search = _search[0], setSearch = _search[1];
  var _expanded = useState(null), expanded = _expanded[0], setExpanded = _expanded[1];
  var _bioLoading = useState(null), bioLoading = _bioLoading[0], setBioLoading = _bioLoading[1];
  var _form = useState({ name: "", company: "", role: "", topics: "", tier: "B" }), form = _form[0], setForm = _form[1];

  // Only show prospects NOT in development pipeline
  var filtered = prospects.filter(function(p) {
    if (p.devStatus) return false;
    if (filtTier !== "All" && p.tier !== filtTier) return false;
    if (search && !(p.name || "").toLowerCase().includes(search.toLowerCase()) && !(p.company || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort(function(a, b) { return TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier); });

  function addProspect() {
    if (!form.name.trim()) { toast("Name required", "error"); return; }
    var p = { id: uid(), name: form.name, company: form.company, role: form.role, topics: form.topics, tier: form.tier, bio: "", devStatus: "", added: Date.now() };
    setProspects(function(prev) { return [p].concat(prev); });
    setForm({ name: "", company: "", role: "", topics: "", tier: "B" });
    setShowForm(false);
    toast("Prospect added");
    dbUpsert("prospects", p).catch(function() { toast("Saved locally only", "info"); });
  }

  function developProspect(id) {
    setProspects(function(prev) { return prev.map(function(p) { return p.id === id ? { ...p, devStatus: "Contacted" } : p; }); });
    var target = prospects.find(function(p) { return p.id === id; });
    if (target) dbUpsert("prospects", { ...target, devStatus: "Contacted" }).catch(function() {});
    toast("Moved to Development");
    setTab(1);
  }

  function addToOutreach(prospect) {
    var entry = {
      show_name: prospect.company + " / " + prospect.name,
      host: prospect.name,
      audience_size: "",
      topic_focus: prospect.topics,
      tier: prospect.tier,
      assigned_to: null,
      status: "identified",
      contact: "",
      notes: "Added from FK prospects",
      created_at: new Date().toISOString(),
    };
    fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "outreach", data: entry }) })
      .then(function() { toast("Added " + prospect.name + " to Outreach pipeline"); })
      .catch(function() { toast("Failed to add to Outreach", "error"); });
  }

  function generateBio(id) {
    var p = prospects.find(function(x) { return x.id === id; });
    if (!p) return;
    setBioLoading(id);
    fetch("/api/fk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate-bio", guestName: p.name, guestCompany: p.company, guestRole: p.role, guestTopics: p.topics }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      var bio = d.bio || (p.name + " is " + p.role + " at " + p.company + ", working on " + (p.topics || "semiconductor technology") + ".");
      setProspects(function(prev) { return prev.map(function(x) { return x.id === id ? { ...x, bio: bio } : x; }); });
      dbUpsert("prospects", { ...p, bio: bio }).catch(function() {});
      setBioLoading(null);
      toast("Bio generated");
    }).catch(function() {
      var bio = p.name + " is " + p.role + " at " + p.company + ". " + (p.topics ? "Their expertise spans " + p.topics.split(",").slice(0, 3).join(", ") + "." : "");
      setProspects(function(prev) { return prev.map(function(x) { return x.id === id ? { ...x, bio: bio } : x; }); });
      setBioLoading(null);
      toast("Generated locally", "info");
    });
  }

  return <div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
      <Input value={search} onChange={setSearch} placeholder="Search by name or company..." sx={{ width: 240 }} />
      <Select value={filtTier} onChange={setFiltTier} options={["All", "S", "A", "B", "C"]} />
      <div style={{ flex: 1 }} />
      <Btn primary onClick={function() { setShowForm(!showForm); }}>{showForm ? "Cancel" : "+ Add Prospect"}</Btn>
    </div>

    {showForm && <Card sx={{ marginBottom: 20, borderColor: D.coral + "40" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><SectionLabel>Name</SectionLabel><Input value={form.name} onChange={function(v) { setForm({ ...form, name: v }); }} placeholder="Guest name" /></div>
        <div><SectionLabel>Company</SectionLabel><Input value={form.company} onChange={function(v) { setForm({ ...form, company: v }); }} placeholder="Company" /></div>
        <div><SectionLabel>Role</SectionLabel><Input value={form.role} onChange={function(v) { setForm({ ...form, role: v }); }} placeholder="Title / Role" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
        <div><SectionLabel>Topics (comma-separated)</SectionLabel><Input value={form.topics} onChange={function(v) { setForm({ ...form, topics: v }); }} placeholder="e.g. DRAM, HBM, AI" /></div>
        <div><SectionLabel>Tier</SectionLabel><Select value={form.tier} onChange={function(v) { setForm({ ...form, tier: v }); }} options={TIERS} sx={{ width: "100%" }} /></div>
      </div>
      <Btn primary onClick={addProspect}>Save Prospect</Btn>
    </Card>}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {filtered.map(function(p) {
        var isExp = expanded === p.id;
        var topics = (p.topics || "").split(",").map(function(t) { return t.trim(); }).filter(Boolean);
        return <Card key={p.id} onClick={function() { setExpanded(isExp ? null : p.id); }} sx={{ borderColor: isExp ? D.coral + "40" : D.border, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: ft, fontSize: 17, fontWeight: 800, color: D.tx }}>{p.name}</div>
              <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{p.role}{p.company ? " @ " + p.company : ""}</div>
            </div>
            <Badge bg={TIER_C[p.tier]}>{p.tier}</Badge>
          </div>
          {topics.length > 0 && <div style={{ marginBottom: 8 }}>{topics.slice(0, 4).map(function(t) { return <Tag key={t}>{t}</Tag>; })}{topics.length > 4 && <Tag>+{topics.length - 4}</Tag>}</div>}

          {isExp && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + D.border }} onClick={function(ev) { ev.stopPropagation(); }}>
            {/* Bio */}
            <div style={{ marginBottom: 12 }}>
              <SectionLabel>Bio</SectionLabel>
              {p.bio ? <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.6 }}>{p.bio}</div>
                : <Btn small onClick={function() { generateBio(p.id); }} disabled={bioLoading === p.id}>{bioLoading === p.id ? "Generating..." : "Generate Bio"}</Btn>}
            </div>
            {/* All topic tags */}
            {topics.length > 0 && <div style={{ marginBottom: 12 }}>
              <SectionLabel>Topic Expertise</SectionLabel>
              <div>{topics.map(function(t) { return <Tag key={t}>{t}</Tag>; })}</div>
            </div>}
            {/* Why they'd be good */}
            <div style={{ marginBottom: 14 }}>
              <SectionLabel>Why they would be a great FK guest</SectionLabel>
              <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5 }}>
                {p.name} brings deep expertise in {topics.slice(0, 2).join(" and ") || "their field"}, relevant to SemiAnalysis readers.
                {p.company ? " As " + p.role + " at " + p.company + ", they have a front-row seat to industry dynamics." : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn primary onClick={function() { developProspect(p.id); }}>Develop</Btn>
              <Btn small onClick={function(ev) { ev.stopPropagation(); addToOutreach(p); }} sx={{ borderColor: D.blue, color: D.blue }}>Add to Outreach</Btn>
            </div>
          </div>}
        </Card>;
      })}
    </div>
    {filtered.length === 0 && <div style={{ textAlign: "center", padding: 60, color: D.txm, fontFamily: ft, fontSize: 14 }}>No prospects found. Add your first guest prospect above.</div>}
  </div>;
}

// ═══ TAB 2: DEVELOPMENT ═══
function DevelopmentTab({ prospects, setProspects, setTab }) {
  var _emailTarget = useState(null), emailTarget = _emailTarget[0], setEmailTarget = _emailTarget[1];
  var _emailData = useState(null), emailData = _emailData[0], setEmailData = _emailData[1];
  var _emailLoading = useState(false), emailLoading = _emailLoading[0], setEmailLoading = _emailLoading[1];

  var devProspects = prospects.filter(function(p) { return p.devStatus && p.devStatus !== ""; });
  var grouped = {};
  DEV_STATUSES.forEach(function(s) { grouped[s] = devProspects.filter(function(p) { return p.devStatus === s; }); });

  function updateDevStatus(id, newStatus) {
    setProspects(function(prev) { return prev.map(function(p) { return p.id === id ? { ...p, devStatus: newStatus } : p; }); });
    var target = prospects.find(function(p) { return p.id === id; });
    if (target) dbUpsert("prospects", { ...target, devStatus: newStatus }).catch(function() {});
    if (newStatus === "Scheduled") toast("Moved to Scheduled");
    else toast("Status updated");
  }

  function generateColdEmail(p) {
    setEmailTarget(p.id);
    setEmailLoading(true);
    setEmailData(null);
    fetch("/api/fk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cold-email", guestName: p.name, guestCompany: p.company, guestRole: p.role, guestTopics: p.topics }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      setEmailData(d.email || { subject: "Fabricated Knowledge: Interview with " + p.name, body: "Hi " + p.name.split(" ")[0] + ",\n\nI'm Doug O'Laughlin, host of Fabricated Knowledge, the audio interview series from SemiAnalysis. We cover the deepest corners of semiconductors, AI infrastructure, and compute.\n\nI've been following your work at " + p.company + " on " + (p.topics || "your area of expertise") + ", and I think our listeners would love to hear your perspective.\n\nWould you be open to a 45-60 minute conversation? We record remotely via Riverside, audio only, totally conversational.\n\nLooking forward to hearing from you.\n\nBest,\nDoug O'Laughlin\nSemiAnalysis / Fabricated Knowledge" });
      setEmailLoading(false);
      toast("Cold email generated");
    }).catch(function() {
      setEmailData({ subject: "Fabricated Knowledge: Interview with " + p.name, body: "Hi " + p.name.split(" ")[0] + ",\n\nI'm Doug O'Laughlin, host of Fabricated Knowledge, the audio interview series from SemiAnalysis. We cover the deepest corners of semiconductors, AI infrastructure, and compute.\n\nI've been following your work at " + p.company + " on " + (p.topics || "your area of expertise") + ", and I think our listeners would love to hear your perspective.\n\nWould you be open to a 45-60 minute conversation? We record remotely via Riverside, audio only, totally conversational.\n\nLooking forward to hearing from you.\n\nBest,\nDoug O'Laughlin\nSemiAnalysis / Fabricated Knowledge" });
      setEmailLoading(false);
      toast("Generated locally", "info");
    });
  }

  function openInGmail() {
    if (!emailData) return;
    var target = prospects.find(function(p) { return p.id === emailTarget; });
    var mailto = "mailto:?subject=" + encodeURIComponent(emailData.subject) + "&body=" + encodeURIComponent(emailData.body);
    window.open(mailto);
  }

  return <div>
    {DEV_STATUSES.map(function(status) {
      var group = grouped[status] || [];
      if (group.length === 0 && status !== "Contacted") return null;
      return <div key={status} style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Badge bg={DEV_STATUS_C[status]}>{status}</Badge>
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{group.length} prospect{group.length !== 1 ? "s" : ""}</span>
        </div>
        {group.length === 0 && <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, padding: "16px 0" }}>No prospects at this stage. Move someone from the Prospects tab.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {group.map(function(p) {
            var topics = (p.topics || "").split(",").map(function(t) { return t.trim(); }).filter(Boolean);
            var isEmailOpen = emailTarget === p.id && emailData;
            return <Card key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: D.tx }}>{p.name}</div>
                  <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{p.role}{p.company ? " @ " + p.company : ""}</div>
                  {topics.length > 0 && <div style={{ marginTop: 6 }}>{topics.slice(0, 4).map(function(t) { return <Tag key={t}>{t}</Tag>; })}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge bg={TIER_C[p.tier]}>{p.tier}</Badge>
                  <Select value={p.devStatus} onChange={function(v) { updateDevStatus(p.id, v); }} options={DEV_STATUSES} sx={{ fontSize: 11, padding: "4px 8px" }} />
                </div>
              </div>
              {/* Cold email action */}
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Btn small onClick={function() { generateColdEmail(p); }} disabled={emailLoading && emailTarget === p.id}>{emailLoading && emailTarget === p.id ? "Generating..." : "Generate Cold Email"}</Btn>
              </div>
              {/* Email composer UI */}
              {isEmailOpen && <div style={{ marginTop: 14, padding: 16, background: D.surface, borderRadius: 10, border: "1px solid " + D.border }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: D.txm, letterSpacing: 1, marginBottom: 4 }}>TO</div>
                  <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, padding: "8px 12px", background: D.bg, borderRadius: 6, border: "1px solid " + D.border }}>{p.name} &lt;{(p.name || "").toLowerCase().replace(/\s+/g, ".") + "@" + (p.company || "company").toLowerCase().replace(/\s+/g, "") + ".com"}&gt;</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: D.txm, letterSpacing: 1, marginBottom: 4 }}>SUBJECT</div>
                  <Input value={emailData.subject} onChange={function(v) { setEmailData({ ...emailData, subject: v }); }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: D.txm, letterSpacing: 1, marginBottom: 4 }}>BODY</div>
                  <TextArea value={emailData.body} onChange={function(v) { setEmailData({ ...emailData, body: v }); }} rows={10} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn small onClick={function() { generateColdEmail(p); }}>Regenerate</Btn>
                  <CopyBtn text={emailData.subject + "\n\n" + emailData.body} />
                  <Btn small onClick={openInGmail} sx={{ borderColor: D.blue, color: D.blue }}>Open in Gmail</Btn>
                  <div style={{ flex: 1 }} />
                  <Btn small onClick={function() { setEmailTarget(null); setEmailData(null); }} sx={{ borderColor: D.txd, color: D.txd }}>Close</Btn>
                </div>
              </div>}
            </Card>;
          })}
        </div>
      </div>;
    })}
    {devProspects.length === 0 && <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, marginBottom: 16 }}>No prospects in development. Head to Prospects to find your next guest.</div>
      <Btn primary onClick={function() { setTab(0); }}>Go to Prospects</Btn>
    </div>}
  </div>;
}

// ═══ TAB 3: SCHEDULED ═══
function ScheduledTab({ prospects, setProspects, setTab }) {
  var scheduled = prospects.filter(function(p) { return p.devStatus === "Scheduled"; });

  function updateRecordDate(id, val) {
    setProspects(function(prev) { return prev.map(function(p) { return p.id === id ? { ...p, recordDate: val } : p; }); });
    var target = prospects.find(function(p) { return p.id === id; });
    if (target) dbUpsert("prospects", { ...target, recordDate: val }).catch(function() {});
  }

  var sorted = scheduled.sort(function(a, b) {
    if (!a.recordDate && !b.recordDate) return 0;
    if (!a.recordDate) return 1;
    if (!b.recordDate) return -1;
    return a.recordDate.localeCompare(b.recordDate);
  });

  return <div>
    {sorted.length > 0 && <div>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: D.txm, marginBottom: 20 }}>
        {sorted.length} upcoming recording{sorted.length !== 1 ? "s" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(function(p) {
          var topics = (p.topics || "").split(",").map(function(t) { return t.trim(); }).filter(Boolean);
          return <Card key={p.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Date block */}
              <div style={{ minWidth: 80, textAlign: "center", padding: "10px 12px", background: D.surface, borderRadius: 10, border: "1px solid " + D.border }}>
                {p.recordDate ? <div>
                  <div style={{ fontFamily: mn, fontSize: 20, fontWeight: 900, color: D.coral }}>{p.recordDate.split("-")[2] || "--"}</div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{(function() { var m = parseInt(p.recordDate.split("-")[1]); var months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return months[m] || "---"; })()}</div>
                </div> : <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>No date</div>}
              </div>
              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: ft, fontSize: 17, fontWeight: 800, color: D.tx }}>{p.name}</div>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{p.role}{p.company ? " @ " + p.company : ""}</div>
                {topics.length > 0 && <div style={{ marginTop: 6 }}>{topics.slice(0, 3).map(function(t) { return <Tag key={t}>{t}</Tag>; })}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <Badge bg={D.teal}>Scheduled</Badge>
                <Input value={p.recordDate || ""} onChange={function(v) { updateRecordDate(p.id, v); }} placeholder="YYYY-MM-DD" sx={{ width: 130, fontSize: 11, padding: "6px 10px" }} />
              </div>
            </div>
          </Card>;
        })}
      </div>
    </div>}
    {sorted.length === 0 && <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, marginBottom: 16 }}>No upcoming recordings. Head to Prospects to find your next guest.</div>
      <Btn primary onClick={function() { setTab(0); }}>Go to Prospects</Btn>
    </div>}
  </div>;
}

// ═══ TAB 4: POST-PRODUCTION ═══
function PostProductionTab({ episodes, prospects }) {
  var _sel = useState(""), selId = _sel[0], setSelId = _sel[1];
  var _transcript = useState(""), transcript = _transcript[0], setTranscript = _transcript[1];
  var _titles = useState([]), titles = _titles[0], setTitles = _titles[1];
  var _longDesc = useState(""), longDesc = _longDesc[0], setLongDesc = _longDesc[1];
  var _shortDesc = useState(""), shortDesc = _shortDesc[0], setShortDesc = _shortDesc[1];
  var _chapters = useState(""), chapters = _chapters[0], setChapters = _chapters[1];
  var _clips = useState([]), clips = _clips[0], setClips = _clips[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];

  var ep = episodes.find(function(e) { return e.id === selId; });
  var guest = ep ? prospects.find(function(p) { return p.id === ep.guestId; }) : null;

  function processTranscript() {
    if (!transcript.trim()) { toast("Paste a transcript first", "error"); return; }
    setLoading(true);
    fetch("/api/fk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process", transcript: transcript, guest: guest ? { name: guest.name, company: guest.company } : null, host: HOST, episodeTopic: ep ? ep.topic : "" }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.titles) setTitles(d.titles);
      if (d.longDesc) setLongDesc(d.longDesc);
      if (d.shortDesc) setShortDesc(d.shortDesc);
      if (d.chapters) setChapters(d.chapters);
      if (d.clips) setClips(d.clips.map(function(c) { return { ...c, id: uid(), flagged: false }; }));
      setLoading(false);
      toast("Transcript processed");
    }).catch(function() {
      var gn = guest ? guest.name : "Guest";
      var co = guest ? guest.company : "Company";
      setTitles([gn + " on the Future of " + (ep ? ep.topic || co : co), "Inside " + co + ": " + gn + " Breaks It Down", "The " + co + " Deep Dive with " + gn]);
      setLongDesc("In this episode of Fabricated Knowledge, " + HOST + " sits down with " + gn + " from " + co + " to discuss " + (ep ? ep.topic || "the latest developments" : "the latest developments") + " in the semiconductor and AI infrastructure space.\n\nTopics covered include the current state of " + co + "'s technology, competitive landscape, and where the industry is heading. " + gn + " shares unique insights from the trenches.\n\nFabricated Knowledge is an audio interview series hosted by " + HOST + " exploring the deepest corners of semiconductors, AI infrastructure, and compute.");
      setShortDesc(HOST + " talks to " + gn + " (" + co + ") about " + (ep ? ep.topic || "the latest in semis and AI" : "the latest in semis and AI") + ". Deep technical conversation.");
      setChapters("00:00 - Introduction\n05:00 - " + gn + "'s Background\n15:00 - " + co + " Overview\n30:00 - Technical Deep Dive\n50:00 - Industry Landscape\n65:00 - Predictions & Closing");
      setClips([
        { id: uid(), timestamp: "12:34", text: gn + " explains the core technical insight behind " + co + "'s approach", flagged: false },
        { id: uid(), timestamp: "28:15", text: "Discussion on competitive dynamics in the semiconductor space", flagged: false },
        { id: uid(), timestamp: "41:50", text: gn + " on where AI hardware is headed in the next 3 years", flagged: false },
        { id: uid(), timestamp: "55:20", text: "The surprising economics of " + (ep ? ep.topic || "next-gen compute" : "next-gen compute"), flagged: false },
      ]);
      setLoading(false);
      toast("Processed locally (API unavailable)", "info");
    });
  }

  function toggleFlag(clipId) {
    setClips(function(prev) { return prev.map(function(c) { return c.id === clipId ? { ...c, flagged: !c.flagged } : c; }); });
  }

  var releasedEpisodes = episodes.filter(function(e) { return e.status === "Released"; });

  function epLabel(e) {
    var g = prospects.find(function(p) { return p.id === e.guestId; });
    var gName = g ? g.name : (e.guestName || "TBD");
    return "EP " + e.number + " - " + gName;
  }

  return <div>
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
      <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txm, letterSpacing: 3, textTransform: "uppercase" }}>Episode</div>
      <Select value={selId} onChange={setSelId} options={[{ value: "", label: "Select released episode..." }].concat(releasedEpisodes.map(function(e) { return { value: e.id, label: epLabel(e) }; }))} sx={{ minWidth: 300 }} />
    </div>

    <Card sx={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Transcript</div>
        <Btn primary onClick={processTranscript} disabled={loading || !transcript.trim()}>{loading ? "Processing..." : "Process Transcript"}</Btn>
      </div>
      <TextArea value={transcript} onChange={setTranscript} rows={12} mono placeholder="Paste Riverside transcript export here..." />
    </Card>

    {titles.length > 0 && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Title Options</div>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{titles.length} options</span>
      </div>
      {titles.map(function(t, i) {
        return <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: D.surface, borderRadius: 8, marginBottom: 8, border: "1px solid " + D.border }}>
          <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.tx }}>{i + 1}. {t}</span>
          <CopyBtn text={t} />
        </div>;
      })}
    </Card>}

    {longDesc && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Long Description</div>
        <CopyBtn text={longDesc} />
      </div>
      <TextArea value={longDesc} onChange={setLongDesc} rows={6} />
    </Card>}

    {shortDesc && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Short Description</div>
        <CopyBtn text={shortDesc} />
      </div>
      <TextArea value={shortDesc} onChange={setShortDesc} rows={3} />
    </Card>}

    {chapters && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Chapter Markers</div>
        <CopyBtn text={chapters} />
      </div>
      <TextArea value={chapters} onChange={setChapters} rows={6} mono />
    </Card>}

    {clips.length > 0 && <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Clip Highlights</div>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{clips.filter(function(c) { return c.flagged; }).length} flagged</span>
      </div>
      {clips.map(function(c) {
        return <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: c.flagged ? D.amber + "10" : D.surface, borderRadius: 8, marginBottom: 8, border: "1px solid " + (c.flagged ? D.amber + "40" : D.border) }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: mn, fontSize: 11, color: D.coral, marginRight: 10 }}>[{c.timestamp}]</span>
            <span style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{c.text}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: 12, flexShrink: 0 }}>
            <CopyBtn text={c.timestamp + " - " + c.text} />
            <Btn small onClick={function() { toggleFlag(c.id); }} sx={{ borderColor: c.flagged ? D.amber : D.coral, color: c.flagged ? D.amber : D.coral }}>{c.flagged ? "Flagged" : "Flag for Slop Top"}</Btn>
          </div>
        </div>;
      })}
    </Card>}

    {!transcript.trim() && titles.length === 0 && <div style={{ textAlign: "center", padding: 40, color: D.txm, fontFamily: ft, fontSize: 14 }}>Select an episode and paste a transcript to begin post-production.</div>}
  </div>;
}

// ═══ TAB 5: RELEASED (ARCHIVE) ═══
function ReleasedTab({ episodes, prospects, archive, setArchive }) {
  var _search = useState(""), search = _search[0], setSearch = _search[1];
  var _catFilt = useState("All"), catFilt = _catFilt[0], setCatFilt = _catFilt[1];
  var _showAdd = useState(false), showAdd = _showAdd[0], setShowAdd = _showAdd[1];
  var _form = useState({ number: "", guest: "", company: "", topic: "", category: "Other", releaseDate: "", plays: "" }), form = _form[0], setForm = _form[1];

  var filtered = archive.filter(function(a) {
    var q = search.toLowerCase();
    if (q && !(a.guest || "").toLowerCase().includes(q) && !(a.topic || "").toLowerCase().includes(q) && !(a.category || "").toLowerCase().includes(q) && !(a.company || "").toLowerCase().includes(q)) return false;
    if (catFilt !== "All" && a.category !== catFilt) return false;
    return true;
  }).sort(function(a, b) { return (parseInt(b.number) || 0) - (parseInt(a.number) || 0); });

  function addArchiveEntry() {
    if (!form.number || !form.guest) { toast("Number and guest required", "error"); return; }
    var entry = { id: uid(), ...form, plays: parseInt(form.plays) || 0 };
    setArchive(function(prev) { return [entry].concat(prev); });
    setForm({ number: "", guest: "", company: "", topic: "", category: "Other", releaseDate: "", plays: "" });
    setShowAdd(false);
    toast("Episode archived");
    dbUpsert("archive", entry).catch(function() { toast("Saved locally only", "info"); });
  }

  function updatePlays(id, val) {
    setArchive(function(prev) { return prev.map(function(a) { return a.id === id ? { ...a, plays: parseInt(val) || 0 } : a; }); });
    var target = archive.find(function(a) { return a.id === id; });
    if (target) dbUpsert("archive", { ...target, plays: parseInt(val) || 0 }).catch(function() {});
  }

  var catCounts = {};
  archive.forEach(function(a) { var c = a.category || "Other"; catCounts[c] = (catCounts[c] || 0) + 1; });
  var maxCount = Math.max.apply(null, Object.values(catCounts).concat([1]));

  return <div>
    <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
      <Input value={search} onChange={setSearch} placeholder="Search guest, topic, category..." sx={{ flex: 1 }} />
      <Select value={catFilt} onChange={setCatFilt} options={["All"].concat(CATEGORIES)} />
      <Btn primary onClick={function() { setShowAdd(!showAdd); }}>{showAdd ? "Cancel" : "+ Add to Archive"}</Btn>
    </div>

    {showAdd && <Card sx={{ marginBottom: 20, borderColor: D.coral + "40" }}>
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><SectionLabel>EP #</SectionLabel><Input value={form.number} onChange={function(v) { setForm({ ...form, number: v }); }} /></div>
        <div><SectionLabel>Guest</SectionLabel><Input value={form.guest} onChange={function(v) { setForm({ ...form, guest: v }); }} /></div>
        <div><SectionLabel>Company</SectionLabel><Input value={form.company} onChange={function(v) { setForm({ ...form, company: v }); }} /></div>
        <div><SectionLabel>Topic</SectionLabel><Input value={form.topic} onChange={function(v) { setForm({ ...form, topic: v }); }} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div><SectionLabel>Category</SectionLabel><Select value={form.category} onChange={function(v) { setForm({ ...form, category: v }); }} options={CATEGORIES} sx={{ width: "100%" }} /></div>
        <div><SectionLabel>Release Date</SectionLabel><Input value={form.releaseDate} onChange={function(v) { setForm({ ...form, releaseDate: v }); }} placeholder="YYYY-MM-DD" /></div>
        <div><SectionLabel>Play Count</SectionLabel><Input value={form.plays} onChange={function(v) { setForm({ ...form, plays: v }); }} placeholder="0" /></div>
      </div>
      <Btn primary onClick={addArchiveEntry}>Add to Archive</Btn>
    </Card>}

    {archive.length > 0 && <Card sx={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Analytics</div>
        <span style={{ fontFamily: mn, fontSize: 12, color: D.txm }}>{archive.length} total episodes</span>
      </div>
      <SectionLabel>Episodes by Category</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.keys(catCounts).sort(function(a, b) { return catCounts[b] - catCounts[a]; }).map(function(cat) {
          var pct = (catCounts[cat] / maxCount) * 100;
          return <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: ft, fontSize: 12, color: D.txm, width: 120, textAlign: "right", flexShrink: 0 }}>{cat}</span>
            <div style={{ flex: 1, height: 20, background: D.surface, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: D.coral, borderRadius: 4, transition: "width 0.5s ease", minWidth: 24, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}>
                <span style={{ fontFamily: mn, fontSize: 10, color: "#fff", fontWeight: 700 }}>{catCounts[cat]}</span>
              </div>
            </div>
          </div>;
        })}
      </div>
    </Card>}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {filtered.map(function(a) {
        return <Card key={a.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <span style={{ fontFamily: mn, fontSize: 11, color: D.coral, fontWeight: 700 }}>EP {a.number} </span>
              <span style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: D.tx }}>{a.guest}</span>
              <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{a.company}</div>
            </div>
            <Badge bg={D.coral}>{a.category}</Badge>
          </div>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginBottom: 10 }}>{a.topic}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{a.releaseDate || "No date"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>plays:</span>
              <input value={a.plays || 0} onChange={function(e) { updatePlays(a.id, e.target.value); }} style={{ width: 60, padding: "4px 8px", borderRadius: 6, border: "1px solid " + D.border, background: D.surface, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none", textAlign: "right" }} />
            </div>
          </div>
        </Card>;
      })}
    </div>
    {filtered.length === 0 && archive.length === 0 && <div style={{ textAlign: "center", padding: 60, color: D.txm, fontFamily: ft, fontSize: 14 }}>No archived episodes yet. Add released episodes to build your library.</div>}
    {filtered.length === 0 && archive.length > 0 && <div style={{ textAlign: "center", padding: 40, color: D.txm, fontFamily: ft, fontSize: 14 }}>No episodes match your search.</div>}
  </div>;
}

// ═══ MAIN EXPORT ═══
export default function FabricatedKnowledge() {
  var _tab = useState(0), tab = _tab[0], setTab = _tab[1];
  var _prospects = useState([]), prospects = _prospects[0], setProspects = _prospects[1];
  var _episodes = useState([]), episodes = _episodes[0], setEpisodes = _episodes[1];
  var _archive = useState([]), archive = _archive[0], setArchive = _archive[1];
  var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];

  useEffect(function() {
    var settled = false;
    function loadFallback() {
      if (settled) return;
      settled = true;
      var p = ls("fk-prospects");
      if (p && p.length > 0) { setProspects(p); } else { setProspects(DEFAULT_PROSPECTS); }
      var e = ls("fk-episodes");
      if (e && e.length > 0) { setEpisodes(e); } else { setEpisodes(DEFAULT_EPISODES); }
      var a = ls("fk-archive");
      if (a && a.length > 0) { setArchive(a); } else { setArchive(DEFAULT_ARCHIVE); }
      setLoaded(true);
    }

    Promise.all([
      dbFetch("prospects").catch(function() { return null; }),
      dbFetch("episodes").catch(function() { return null; }),
      dbFetch("archive").catch(function() { return null; }),
    ]).then(function(results) {
      if (settled) return;
      settled = true;
      var p = results[0], e = results[1], a = results[2];
      if (p && p.length > 0) { setProspects(p); }
      else { var lp = ls("fk-prospects"); if (lp && lp.length > 0) { setProspects(lp); } else { setProspects(DEFAULT_PROSPECTS); } }
      if (e && e.length > 0) { setEpisodes(e); }
      else { var le = ls("fk-episodes"); if (le && le.length > 0) { setEpisodes(le); } else { setEpisodes(DEFAULT_EPISODES); } }
      if (a && a.length > 0) { setArchive(a); }
      else { var la = ls("fk-archive"); if (la && la.length > 0) { setArchive(la); } else { setArchive(DEFAULT_ARCHIVE); } }
      setLoaded(true);
    }).catch(function() { loadFallback(); });

    setTimeout(function() { loadFallback(); }, 3000);
  }, []);

  useEffect(function() { if (loaded) ss("fk-prospects", prospects); }, [prospects, loaded]);
  useEffect(function() { if (loaded) ss("fk-episodes", episodes); }, [episodes, loaded]);
  useEffect(function() { if (loaded) ss("fk-archive", archive); }, [archive, loaded]);

  return <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, padding: "0 0 60px 0" }}>
    <Toasts />

    <div style={{ padding: "36px 40px 0 40px" }}>
      <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: D.tx, letterSpacing: -1 }}>Fabricated Knowledge</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Doug O'Laughlin // Audio Interview Series</div>
    </div>

    <div style={{ display: "flex", gap: 0, padding: "20px 40px 0 40px", borderBottom: "1px solid " + D.border, marginBottom: 28 }}>
      {TABS.map(function(t, i) {
        var active = tab === i;
        return <div key={t} onClick={function() { setTab(i); }} style={{ padding: "12px 22px", cursor: "pointer", fontFamily: ft, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? D.coral : D.txm, borderBottom: active ? "2px solid " + D.coral : "2px solid transparent", transition: "all 0.15s", marginBottom: -1 }}>{t}</div>;
      })}
    </div>

    <div style={{ padding: "0 40px" }}>
      {tab === 0 && <ProspectsTab prospects={prospects} setProspects={setProspects} setTab={setTab} />}
      {tab === 1 && <DevelopmentTab prospects={prospects} setProspects={setProspects} setTab={setTab} />}
      {tab === 2 && <ScheduledTab prospects={prospects} setProspects={setProspects} setTab={setTab} />}
      {tab === 3 && <PostProductionTab episodes={episodes} prospects={prospects} />}
      {tab === 4 && <ReleasedTab episodes={episodes} prospects={prospects} archive={archive} setArchive={setArchive} />}
    </div>
  </div>;
}
