// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";

// ═══ DESIGN ═══
var D = {
  bg: "#06060C", card: "#14141E", border: "#252535", hover: "#181824",
  surface: "#101018", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var TABS = ["Prospects", "Episodes", "Development", "Post-Production", "Archive"];
var STATUSES = ["Prospect", "Contacted", "Confirmed", "Recorded", "Released"];
var STATUS_C = { Prospect: D.txd, Contacted: D.blue, Confirmed: D.amber, Recorded: D.teal, Released: D.violet };
var TIERS = ["S", "A", "B", "C"];
var TIER_C = { S: D.amber, A: D.blue, B: D.teal, C: D.txd };
var EP_STATUSES = ["Planning", "Scheduled", "Recorded", "Editing", "Released"];
var EP_STATUS_C = { Planning: D.txd, Scheduled: D.blue, Recorded: D.teal, Editing: D.amber, Released: D.violet };
var CATEGORIES = ["Semiconductors", "AI Infra", "Data Center", "Memory", "Geopolitics", "Compute", "Other"];
var CHANNELS = ["email", "LinkedIn", "intro"];
var HOST = "Doug O'Laughlin";

// ═══ DEFAULT DATA ═══
var DEFAULT_PROSPECTS = [
  { id: "fk-default-val", name: "Val Bercovici", company: "WEKA", role: "Executive", topics: "KV Cache, Disaggregated Inference, Memory Architecture, Memory Markets, HBM Pricing, Agentic Demand", tier: "S", status: "Released", channel: "intro", dateContacted: "", followUp: "", response: "", added: 1736899200000 },
  { id: "fk-default-will", name: "Will Eatherton", company: "Cisco", role: "SVP Engineering", topics: "AI Networking, Datacenter Infrastructure, Modular Systems", tier: "A", status: "Released", channel: "intro", dateContacted: "", followUp: "", response: "", added: 1736812800000 },
  { id: "fk-default-wes", name: "Wes Cummins", company: "Applied Digital", role: "CEO", topics: "GPU Cloud, AI Infrastructure, Datacenter Development", tier: "A", status: "Released", channel: "intro", dateContacted: "", followUp: "", response: "", added: 1736726400000 },
];

var DEFAULT_EPISODES = [
  { id: "fk-ep-default-1", number: "1", guestId: "fk-default-val", topic: "KV Cache, Disaggregated Inference, Memory Architecture", recordDate: "", releaseDate: "2025-07-07", status: "Released", notes: "A Conversation with Val Bercovici about Disaggregated Prefill / Decode", added: 1751846400000 },
  { id: "fk-ep-default-2", number: "2", guestId: "fk-default-will", topic: "AI Networking, Datacenter Infrastructure, Modular Systems", recordDate: "", releaseDate: "2025-10-27", status: "Released", notes: "Will Eatherton: How Cisco Plans to Compete in the AI Datacenter", added: 1761523200000 },
  { id: "fk-ep-default-3", number: "3", guestId: "fk-default-val", topic: "Memory Markets, HBM Pricing, Agentic Demand", recordDate: "", releaseDate: "2025-02-16", status: "Released", notes: "Another Conversation with Val Bercovici Memory Markets", added: 1739664000000 },
  { id: "fk-ep-default-4", number: "4", guestId: "fk-default-wes", topic: "GPU Cloud, AI Infrastructure, Datacenter Development", recordDate: "", releaseDate: "2025-01-15", status: "Released", notes: "An Interview with Wes Cummins, CEO of Applied Digital", added: 1736899200000 },
];

var DEFAULT_ARCHIVE = [
  { id: "fk-arc-default-1", number: "1", guest: "Val Bercovici", company: "WEKA", topic: "KV Cache, Disaggregated Inference, Memory Architecture", category: "AI Infra", releaseDate: "2025-07-07", plays: 0 },
  { id: "fk-arc-default-2", number: "2", guest: "Will Eatherton", company: "Cisco", topic: "AI Networking, Datacenter Infrastructure, Modular Systems", category: "Data Center", releaseDate: "2025-10-27", plays: 0 },
  { id: "fk-arc-default-3", number: "3", guest: "Val Bercovici", company: "WEKA", topic: "Memory Markets, HBM Pricing, Agentic Demand", category: "Memory", releaseDate: "2025-02-16", plays: 0 },
  { id: "fk-arc-default-4", number: "4", guest: "Wes Cummins", company: "Applied Digital", topic: "GPU Cloud, AI Infrastructure, Datacenter Development", category: "Compute", releaseDate: "2025-01-15", plays: 0 },
];

function uid() { return "fk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8); }
function ls(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function ss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

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
  return <button onClick={p.onClick} disabled={p.disabled} style={{ padding: p.small ? "6px 12px" : "10px 18px", borderRadius: 8, cursor: p.disabled ? "not-allowed" : "pointer", fontFamily: ft, fontSize: p.small ? 11 : 13, fontWeight: 700, border: primary ? "none" : "1px solid " + D.violet, background: primary ? D.violet : "transparent", color: primary ? "#fff" : D.violet, opacity: p.disabled ? 0.4 : 1, transition: "all 0.15s", ...(p.sx || {}) }}>{p.children}</button>;
}

function CopyBtn(p) {
  return <Btn small onClick={function() { navigator.clipboard.writeText(p.text); toast("Copied", "success"); }}>Copy</Btn>;
}

function Badge(p) {
  return <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: (p.bg || D.txd) + "20", color: p.bg || D.txd, letterSpacing: 0.5, fontFamily: mn }}>{p.children}</span>;
}

function Tag(p) {
  return <span style={{ display: "inline-block", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: D.violet + "15", color: D.violet, fontFamily: ft, marginRight: 4, marginBottom: 4 }}>{p.children}</span>;
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
  return <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txd, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>{p.children}</div>;
}

// ═══ TAB: PROSPECTS ═══
function ProspectsTab({ prospects, setProspects }) {
  var _show = useState(false), showForm = _show[0], setShowForm = _show[1];
  var _filt = useState("All"), filtStatus = _filt[0], setFiltStatus = _filt[1];
  var _filtTier = useState("All"), filtTier = _filtTier[0], setFiltTier = _filtTier[1];
  var _filtTopic = useState(""), filtTopic = _filtTopic[0], setFiltTopic = _filtTopic[1];
  var _sort = useState("date"), sortBy = _sort[0], setSortBy = _sort[1];
  var _form = useState({ name: "", company: "", role: "", topics: "", tier: "B", status: "Prospect", channel: "email", dateContacted: "", followUp: "", response: "" }), form = _form[0], setForm = _form[1];

  var filtered = prospects.filter(function(p) {
    if (filtStatus !== "All" && p.status !== filtStatus) return false;
    if (filtTier !== "All" && p.tier !== filtTier) return false;
    if (filtTopic && !(p.topics || "").toLowerCase().includes(filtTopic.toLowerCase())) return false;
    return true;
  }).sort(function(a, b) {
    if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
    if (sortBy === "tier") return TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
    return (b.added || 0) - (a.added || 0);
  });

  function addProspect() {
    if (!form.name.trim()) { toast("Name required", "error"); return; }
    var p = { id: uid(), ...form, topics: form.topics, added: Date.now() };
    setProspects(function(prev) { return [p].concat(prev); });
    setForm({ name: "", company: "", role: "", topics: "", tier: "B", status: "Prospect", channel: "email", dateContacted: "", followUp: "", response: "" });
    setShowForm(false);
    toast("Prospect added");
  }

  function updateField(id, field, val) {
    setProspects(function(prev) { return prev.map(function(p) { return p.id === id ? { ...p, [field]: val } : p; }); });
  }

  return <div>
    {/* Filter bar */}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
      <Select value={filtStatus} onChange={setFiltStatus} options={["All"].concat(STATUSES)} />
      <Select value={filtTier} onChange={setFiltTier} options={["All"].concat(TIERS)} />
      <Input value={filtTopic} onChange={setFiltTopic} placeholder="Filter by topic..." sx={{ width: 180 }} />
      <Select value={sortBy} onChange={setSortBy} options={[{ value: "date", label: "Sort: Date Added" }, { value: "name", label: "Sort: Name" }, { value: "tier", label: "Sort: Tier" }]} />
      <div style={{ flex: 1 }} />
      <Btn primary onClick={function() { setShowForm(!showForm); }}>{showForm ? "Cancel" : "+ Add Prospect"}</Btn>
    </div>

    {/* Add form */}
    {showForm && <Card sx={{ marginBottom: 20, borderColor: D.violet + "40" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><SectionLabel>Name</SectionLabel><Input value={form.name} onChange={function(v) { setForm({ ...form, name: v }); }} placeholder="Guest name" /></div>
        <div><SectionLabel>Company</SectionLabel><Input value={form.company} onChange={function(v) { setForm({ ...form, company: v }); }} placeholder="Company" /></div>
        <div><SectionLabel>Role</SectionLabel><Input value={form.role} onChange={function(v) { setForm({ ...form, role: v }); }} placeholder="Title / Role" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><SectionLabel>Topics (comma-separated)</SectionLabel><Input value={form.topics} onChange={function(v) { setForm({ ...form, topics: v }); }} placeholder="e.g. DRAM, HBM, AI" /></div>
        <div><SectionLabel>Tier</SectionLabel><Select value={form.tier} onChange={function(v) { setForm({ ...form, tier: v }); }} options={TIERS} sx={{ width: "100%" }} /></div>
        <div><SectionLabel>Channel</SectionLabel><Select value={form.channel} onChange={function(v) { setForm({ ...form, channel: v }); }} options={CHANNELS} sx={{ width: "100%" }} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div><SectionLabel>Date Contacted</SectionLabel><Input value={form.dateContacted} onChange={function(v) { setForm({ ...form, dateContacted: v }); }} placeholder="YYYY-MM-DD" /></div>
        <div><SectionLabel>Follow-up Date</SectionLabel><Input value={form.followUp} onChange={function(v) { setForm({ ...form, followUp: v }); }} placeholder="YYYY-MM-DD" /></div>
        <div><SectionLabel>Response Status</SectionLabel><Input value={form.response} onChange={function(v) { setForm({ ...form, response: v }); }} placeholder="e.g. Awaiting, Replied" /></div>
      </div>
      <Btn primary onClick={addProspect}>Save Prospect</Btn>
    </Card>}

    {/* Cards */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {filtered.map(function(p) {
        var topics = (p.topics || "").split(",").map(function(t) { return t.trim(); }).filter(Boolean);
        return <Card key={p.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: ft, fontSize: 17, fontWeight: 800, color: D.tx }}>{p.name}</div>
              <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{p.role}{p.company ? " @ " + p.company : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Badge bg={TIER_C[p.tier]}>{p.tier}</Badge>
              <Select value={p.status} onChange={function(v) { updateField(p.id, "status", v); }} options={STATUSES} sx={{ fontSize: 11, padding: "4px 8px" }} />
            </div>
          </div>
          {topics.length > 0 && <div style={{ marginBottom: 10 }}>{topics.map(function(t) { return <Tag key={t}>{t}</Tag>; })}</div>}
          {/* Pipeline dots */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
            {STATUSES.map(function(s) {
              var active = STATUSES.indexOf(p.status) >= STATUSES.indexOf(s);
              return <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? STATUS_C[s] : D.txd + "40", transition: "background 0.2s" }} />
                <span style={{ fontFamily: mn, fontSize: 9, color: active ? STATUS_C[s] : D.txd }}>{s.slice(0, 3)}</span>
              </div>;
            })}
          </div>
          {/* Outreach info */}
          <div style={{ display: "flex", gap: 16, fontFamily: mn, fontSize: 10, color: D.txm }}>
            {p.channel && <span>via {p.channel}</span>}
            {p.dateContacted && <span>contacted {p.dateContacted}</span>}
            {p.followUp && <span>follow-up {p.followUp}</span>}
            {p.response && <span style={{ color: D.teal }}>{p.response}</span>}
          </div>
        </Card>;
      })}
    </div>
    {filtered.length === 0 && <div style={{ textAlign: "center", padding: 60, color: D.txd, fontFamily: ft, fontSize: 14 }}>No prospects found. Add your first guest prospect above.</div>}
  </div>;
}

// ═══ TAB: EPISODES ═══
function EpisodesTab({ episodes, setEpisodes, prospects }) {
  var _show = useState(false), showForm = _show[0], setShowForm = _show[1];
  var _exp = useState(null), expanded = _exp[0], setExpanded = _exp[1];
  var _form = useState({ number: "", guestId: "", topic: "", recordDate: "", releaseDate: "", status: "Planning", notes: "" }), form = _form[0], setForm = _form[1];

  function addEpisode() {
    if (!form.number) { toast("Episode number required", "error"); return; }
    var ep = { id: uid(), ...form, added: Date.now() };
    setEpisodes(function(prev) { return [ep].concat(prev); });
    setForm({ number: "", guestId: "", topic: "", recordDate: "", releaseDate: "", status: "Planning", notes: "" });
    setShowForm(false);
    toast("Episode created");
  }

  function updateEp(id, field, val) {
    setEpisodes(function(prev) { return prev.map(function(e) { return e.id === id ? { ...e, [field]: val } : e; }); });
  }

  function guestName(gid) {
    var g = prospects.find(function(p) { return p.id === gid; });
    return g ? g.name : "TBD";
  }

  // Calendar: upcoming episodes sorted by record date
  var upcoming = episodes.filter(function(e) { return e.recordDate; }).sort(function(a, b) { return a.recordDate.localeCompare(b.recordDate); });

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: D.txm }}>
        {episodes.length} episode{episodes.length !== 1 ? "s" : ""} total
      </div>
      <Btn primary onClick={function() { setShowForm(!showForm); }}>{showForm ? "Cancel" : "+ New Episode"}</Btn>
    </div>

    {showForm && <Card sx={{ marginBottom: 20, borderColor: D.violet + "40" }}>
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><SectionLabel>EP #</SectionLabel><Input value={form.number} onChange={function(v) { setForm({ ...form, number: v }); }} placeholder="#" /></div>
        <div><SectionLabel>Guest</SectionLabel>
          <Select value={form.guestId} onChange={function(v) { setForm({ ...form, guestId: v }); }} options={[{ value: "", label: "Select guest..." }].concat(prospects.map(function(p) { return { value: p.id, label: p.name }; }))} sx={{ width: "100%" }} />
        </div>
        <div><SectionLabel>Topic</SectionLabel><Input value={form.topic} onChange={function(v) { setForm({ ...form, topic: v }); }} placeholder="Episode topic" /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><SectionLabel>Record Date</SectionLabel><Input value={form.recordDate} onChange={function(v) { setForm({ ...form, recordDate: v }); }} placeholder="YYYY-MM-DD" /></div>
        <div><SectionLabel>Release Date</SectionLabel><Input value={form.releaseDate} onChange={function(v) { setForm({ ...form, releaseDate: v }); }} placeholder="YYYY-MM-DD" /></div>
        <div><SectionLabel>Status</SectionLabel><Select value={form.status} onChange={function(v) { setForm({ ...form, status: v }); }} options={EP_STATUSES} sx={{ width: "100%" }} /></div>
      </div>
      <div style={{ marginBottom: 16 }}><SectionLabel>Notes</SectionLabel><TextArea value={form.notes} onChange={function(v) { setForm({ ...form, notes: v }); }} rows={3} placeholder="Internal notes..." /></div>
      <Btn primary onClick={addEpisode}>Create Episode</Btn>
    </Card>}

    {/* Upcoming calendar */}
    {upcoming.length > 0 && <div style={{ marginBottom: 24 }}>
      <SectionLabel>Upcoming Recordings</SectionLabel>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
        {upcoming.slice(0, 8).map(function(e) {
          return <div key={e.id} style={{ minWidth: 140, padding: "12px 14px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10 }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.violet, marginBottom: 4 }}>EP {e.number}</div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx, marginBottom: 4 }}>{guestName(e.guestId)}</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{e.recordDate}</div>
          </div>;
        })}
      </div>
    </div>}

    {/* Episode list */}
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {episodes.map(function(e) {
        var isExp = expanded === e.id;
        return <Card key={e.id} onClick={function() { setExpanded(isExp ? null : e.id); }} sx={{ borderColor: isExp ? D.violet + "40" : D.border, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: mn, fontSize: 14, fontWeight: 900, color: D.violet }}>#{e.number}</span>
              <div>
                <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: D.tx }}>{guestName(e.guestId)}</div>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{e.topic || "No topic set"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {e.recordDate && <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>rec {e.recordDate}</span>}
              {e.releaseDate && <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>rel {e.releaseDate}</span>}
              <Badge bg={EP_STATUS_C[e.status]}>{e.status}</Badge>
            </div>
          </div>
          {isExp && <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid " + D.border }} onClick={function(ev) { ev.stopPropagation(); }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><SectionLabel>Record Date</SectionLabel><Input value={e.recordDate || ""} onChange={function(v) { updateEp(e.id, "recordDate", v); }} /></div>
              <div><SectionLabel>Release Date</SectionLabel><Input value={e.releaseDate || ""} onChange={function(v) { updateEp(e.id, "releaseDate", v); }} /></div>
              <div><SectionLabel>Status</SectionLabel><Select value={e.status} onChange={function(v) { updateEp(e.id, "status", v); }} options={EP_STATUSES} sx={{ width: "100%" }} /></div>
            </div>
            <div><SectionLabel>Notes</SectionLabel><TextArea value={e.notes || ""} onChange={function(v) { updateEp(e.id, "notes", v); }} rows={3} /></div>
          </div>}
        </Card>;
      })}
    </div>
    {episodes.length === 0 && <div style={{ textAlign: "center", padding: 60, color: D.txd, fontFamily: ft, fontSize: 14 }}>No episodes yet. Create your first episode above.</div>}
  </div>;
}

// ═══ TAB: DEVELOPMENT ═══
function DevelopmentTab({ episodes, prospects }) {
  var _sel = useState(""), selId = _sel[0], setSelId = _sel[1];
  var _briefing = useState(""), briefing = _briefing[0], setBriefing = _briefing[1];
  var _prepKit = useState(""), prepKit = _prepKit[0], setPrepKit = _prepKit[1];
  var _riverside = useState(""), riverside = _riverside[0], setRiverside = _riverside[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _loadingPrep = useState(false), loadingPrep = _loadingPrep[0], setLoadingPrep = _loadingPrep[1];

  var ep = episodes.find(function(e) { return e.id === selId; });
  var guest = ep ? prospects.find(function(p) { return p.id === ep.guestId; }) : null;

  function genBriefing() {
    if (!ep || !guest) { toast("Select an episode with a guest first", "error"); return; }
    setLoading(true);
    fetch("/api/fk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "briefing", guest: { name: guest.name, company: guest.company, role: guest.role, topics: guest.topics }, host: HOST, episodeTopic: ep.topic }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      setBriefing(d.briefing || d.content || "Briefing generated. Edit below.");
      setLoading(false);
      toast("Briefing generated");
    }).catch(function() {
      setBriefing("# Briefing: " + guest.name + " (" + guest.company + ")\n\n## Guest Bio\n" + guest.name + " is " + guest.role + " at " + guest.company + ".\nTopics: " + (guest.topics || "N/A") + "\n\n## Recent Company News\n- [Research recent developments at " + guest.company + "]\n\n## SemiAnalysis Research Angles\n- How does " + guest.company + "'s work connect to current semiconductor trends?\n- What unique perspective can " + guest.name + " bring?\n\n## Suggested Talking Points\n1. Background and journey to " + guest.company + "\n2. Current work and vision\n3. Industry landscape and competitive dynamics\n4. Technical deep-dive on " + (ep.topic || "core topics") + "\n5. Forward-looking predictions");
      setLoading(false);
      toast("Generated locally (API unavailable)", "info");
    });
  }

  function genPrepKit() {
    if (!ep || !guest) { toast("Select an episode with a guest first", "error"); return; }
    setLoadingPrep(true);
    fetch("/api/fk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepkit", guest: { name: guest.name, company: guest.company, role: guest.role, topics: guest.topics }, host: HOST, episodeTopic: ep.topic }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      setPrepKit(d.prepKit || d.content || "Prep kit generated.");
      setLoadingPrep(false);
      toast("Prep kit generated");
    }).catch(function() {
      setPrepKit("FABRICATED KNOWLEDGE // Guest Prep Kit\nHost: " + HOST + "\n─────────────────────────────────\nGuest: " + guest.name + "\nCompany: " + guest.company + "\nRole: " + guest.role + "\nEpisode Topic: " + (ep.topic || "TBD") + "\nRecord Date: " + (ep.recordDate || "TBD") + "\n\nFORMAT\n- Conversational, ~60-90 min\n- Audio only via Riverside\n- Focus on deep technical insight\n\nTOPICS WE'LL COVER\n- Your background and path to " + guest.company + "\n- The core thesis behind your work\n- Technical architecture / approach\n- Market dynamics and competition\n- What's next / predictions\n\nPREP NOTES\n- Please have a stable internet connection\n- Quiet environment preferred\n- We'll send the Riverside link before recording");
      setLoadingPrep(false);
      toast("Generated locally (API unavailable)", "info");
    });
  }

  function downloadDoc(content, filename) {
    var blob = new Blob([content], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast("Downloaded " + filename);
  }

  return <div>
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
      <SectionLabel>Episode</SectionLabel>
      <Select value={selId} onChange={setSelId} options={[{ value: "", label: "Select episode..." }].concat(episodes.map(function(e) { var g = prospects.find(function(p) { return p.id === e.guestId; }); return { value: e.id, label: "EP " + e.number + " - " + (g ? g.name : "TBD") }; }))} sx={{ minWidth: 260 }} />
    </div>

    {ep && <div>
      {/* Guest info summary */}
      <Card sx={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: D.tx }}>{guest ? guest.name : "No guest assigned"}</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{guest ? guest.role + " @ " + guest.company : ""}</div>
          </div>
          <Badge bg={EP_STATUS_C[ep.status]}>{ep.status}</Badge>
        </div>
      </Card>

      {/* Riverside link */}
      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Riverside Session Link</SectionLabel>
        <Input value={riverside} onChange={setRiverside} placeholder="https://riverside.fm/studio/..." />
      </div>

      {/* Briefing doc */}
      <Card sx={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Briefing Document</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary onClick={genBriefing} disabled={loading}>{loading ? "Generating..." : "Generate Briefing Doc"}</Btn>
          </div>
        </div>
        {briefing && <div>
          <TextArea value={briefing} onChange={setBriefing} rows={14} mono />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <CopyBtn text={briefing} />
            <Btn small onClick={function() { downloadDoc(briefing, "briefing-ep" + ep.number + ".txt"); }}>Download</Btn>
          </div>
        </div>}
      </Card>

      {/* Prep kit */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Guest Prep Kit</div>
          <Btn primary onClick={genPrepKit} disabled={loadingPrep}>{loadingPrep ? "Generating..." : "Generate Guest Prep Kit"}</Btn>
        </div>
        {prepKit && <div>
          <TextArea value={prepKit} onChange={setPrepKit} rows={12} mono />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <CopyBtn text={prepKit} />
            <Btn small onClick={function() { downloadDoc(prepKit, "prepkit-ep" + ep.number + ".txt"); }}>Download</Btn>
          </div>
        </div>}
      </Card>
    </div>}

    {!ep && <div style={{ textAlign: "center", padding: 60, color: D.txd, fontFamily: ft, fontSize: 14 }}>Select an episode above to begin development prep.</div>}
  </div>;
}

// ═══ TAB: POST-PRODUCTION ═══
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
      if (d.clips) setClips(d.clips.map(function(c, i) { return { ...c, id: uid(), flagged: false }; }));
      setLoading(false);
      toast("Transcript processed");
    }).catch(function() {
      // Fallback local generation
      var gn = guest ? guest.name : "Guest";
      var co = guest ? guest.company : "Company";
      setTitles([
        gn + " on the Future of " + (ep ? ep.topic || co : co),
        "Inside " + co + ": " + gn + " Breaks It Down",
        "The " + co + " Deep Dive with " + gn,
      ]);
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

  return <div>
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
      <SectionLabel>Episode</SectionLabel>
      <Select value={selId} onChange={setSelId} options={[{ value: "", label: "Select episode..." }].concat(episodes.map(function(e) { var g = prospects.find(function(p) { return p.id === e.guestId; }); return { value: e.id, label: "EP " + e.number + " - " + (g ? g.name : "TBD") }; }))} sx={{ minWidth: 260 }} />
    </div>

    {/* Transcript input */}
    <Card sx={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Transcript</div>
        <Btn primary onClick={processTranscript} disabled={loading || !transcript.trim()}>{loading ? "Processing..." : "Process Transcript"}</Btn>
      </div>
      <TextArea value={transcript} onChange={setTranscript} rows={10} mono placeholder="Paste Riverside transcript export here..." />
    </Card>

    {/* Title options */}
    {titles.length > 0 && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Title Options</div>
      </div>
      {titles.map(function(t, i) {
        return <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: D.surface, borderRadius: 8, marginBottom: 8, border: "1px solid " + D.border }}>
          <span style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.tx }}>{t}</span>
          <CopyBtn text={t} />
        </div>;
      })}
    </Card>}

    {/* Long description */}
    {longDesc && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Long Description (Spotify)</div>
        <CopyBtn text={longDesc} />
      </div>
      <TextArea value={longDesc} onChange={setLongDesc} rows={6} />
    </Card>}

    {/* Short description */}
    {shortDesc && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Short Description (Social)</div>
        <CopyBtn text={shortDesc} />
      </div>
      <TextArea value={shortDesc} onChange={setShortDesc} rows={3} />
    </Card>}

    {/* Chapters */}
    {chapters && <Card sx={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>Chapter Markers</div>
        <CopyBtn text={chapters} />
      </div>
      <TextArea value={chapters} onChange={setChapters} rows={6} mono />
    </Card>}

    {/* Clip highlights */}
    {clips.length > 0 && <Card>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 14 }}>Clip Highlights</div>
      {clips.map(function(c) {
        return <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: c.flagged ? D.amber + "10" : D.surface, borderRadius: 8, marginBottom: 8, border: "1px solid " + (c.flagged ? D.amber + "40" : D.border) }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: mn, fontSize: 11, color: D.violet, marginRight: 10 }}>[{c.timestamp}]</span>
            <span style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{c.text}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: 12, flexShrink: 0 }}>
            <CopyBtn text={c.timestamp + " - " + c.text} />
            <Btn small onClick={function() { toggleFlag(c.id); }} sx={{ borderColor: c.flagged ? D.amber : D.violet, color: c.flagged ? D.amber : D.violet }}>{c.flagged ? "Flagged" : "Flag for Slob Top"}</Btn>
          </div>
        </div>;
      })}
    </Card>}

    {!transcript.trim() && titles.length === 0 && <div style={{ textAlign: "center", padding: 40, color: D.txd, fontFamily: ft, fontSize: 14 }}>Select an episode and paste a transcript to begin post-production.</div>}
  </div>;
}

// ═══ TAB: ARCHIVE ═══
function ArchiveTab({ episodes, prospects, archive, setArchive }) {
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
    setArchive(function(prev) { return [{ id: uid(), ...form, plays: parseInt(form.plays) || 0 }].concat(prev); });
    setForm({ number: "", guest: "", company: "", topic: "", category: "Other", releaseDate: "", plays: "" });
    setShowAdd(false);
    toast("Episode archived");
  }

  function updatePlays(id, val) {
    setArchive(function(prev) { return prev.map(function(a) { return a.id === id ? { ...a, plays: parseInt(val) || 0 } : a; }); });
  }

  // Analytics
  var catCounts = {};
  archive.forEach(function(a) { var c = a.category || "Other"; catCounts[c] = (catCounts[c] || 0) + 1; });
  var maxCount = Math.max.apply(null, Object.values(catCounts).concat([1]));

  return <div>
    {/* Search and filter */}
    <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
      <Input value={search} onChange={setSearch} placeholder="Search guest, topic, category..." sx={{ flex: 1 }} />
      <Select value={catFilt} onChange={setCatFilt} options={["All"].concat(CATEGORIES)} />
      <Btn primary onClick={function() { setShowAdd(!showAdd); }}>{showAdd ? "Cancel" : "+ Add to Archive"}</Btn>
    </div>

    {showAdd && <Card sx={{ marginBottom: 20, borderColor: D.violet + "40" }}>
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

    {/* Analytics */}
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
              <div style={{ height: "100%", width: pct + "%", background: D.violet, borderRadius: 4, transition: "width 0.5s ease", minWidth: 24, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}>
                <span style={{ fontFamily: mn, fontSize: 10, color: "#fff", fontWeight: 700 }}>{catCounts[cat]}</span>
              </div>
            </div>
          </div>;
        })}
      </div>
    </Card>}

    {/* Episode cards */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {filtered.map(function(a) {
        return <Card key={a.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <span style={{ fontFamily: mn, fontSize: 11, color: D.violet, fontWeight: 700 }}>EP {a.number} </span>
              <span style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: D.tx }}>{a.guest}</span>
              <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>{a.company}</div>
            </div>
            <Badge bg={D.violet}>{a.category}</Badge>
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
    {filtered.length === 0 && archive.length === 0 && <div style={{ textAlign: "center", padding: 60, color: D.txd, fontFamily: ft, fontSize: 14 }}>No archived episodes yet. Add released episodes to build your library.</div>}
    {filtered.length === 0 && archive.length > 0 && <div style={{ textAlign: "center", padding: 40, color: D.txd, fontFamily: ft, fontSize: 14 }}>No episodes match your search.</div>}
  </div>;
}

// ═══ MAIN EXPORT ═══
export default function FabricatedKnowledge() {
  var _tab = useState(0), tab = _tab[0], setTab = _tab[1];
  var _prospects = useState([]), prospects = _prospects[0], setProspects = _prospects[1];
  var _episodes = useState([]), episodes = _episodes[0], setEpisodes = _episodes[1];
  var _archive = useState([]), archive = _archive[0], setArchive = _archive[1];
  var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];

  // Load from localStorage, seed defaults if empty
  useEffect(function() {
    var p = ls("fk-prospects");
    if (p && p.length > 0) { setProspects(p); } else { setProspects(DEFAULT_PROSPECTS); }
    var e = ls("fk-episodes");
    if (e && e.length > 0) { setEpisodes(e); } else { setEpisodes(DEFAULT_EPISODES); }
    var a = ls("fk-archive");
    if (a && a.length > 0) { setArchive(a); } else { setArchive(DEFAULT_ARCHIVE); }
    setLoaded(true);
  }, []);

  // Persist to localStorage
  useEffect(function() { if (loaded) ss("fk-prospects", prospects); }, [prospects, loaded]);
  useEffect(function() { if (loaded) ss("fk-episodes", episodes); }, [episodes, loaded]);
  useEffect(function() { if (loaded) ss("fk-archive", archive); }, [archive, loaded]);

  return <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, padding: "0 0 60px 0" }}>
    <Toasts />

    {/* Header */}
    <div style={{ padding: "36px 40px 0 40px" }}>
      <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: D.tx, letterSpacing: -1 }}>Fabricated Knowledge</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Doug O'Laughlin // Audio Interview Series</div>
    </div>

    {/* Tab bar */}
    <div style={{ display: "flex", gap: 0, padding: "20px 40px 0 40px", borderBottom: "1px solid " + D.border, marginBottom: 28 }}>
      {TABS.map(function(t, i) {
        var active = tab === i;
        return <div key={t} onClick={function() { setTab(i); }} style={{ padding: "12px 22px", cursor: "pointer", fontFamily: ft, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? D.violet : D.txm, borderBottom: active ? "2px solid " + D.violet : "2px solid transparent", transition: "all 0.15s", marginBottom: -1 }}>{t}</div>;
      })}
    </div>

    {/* Content */}
    <div style={{ padding: "0 40px" }}>
      {tab === 0 && <ProspectsTab prospects={prospects} setProspects={setProspects} />}
      {tab === 1 && <EpisodesTab episodes={episodes} setEpisodes={setEpisodes} prospects={prospects} />}
      {tab === 2 && <DevelopmentTab episodes={episodes} prospects={prospects} />}
      {tab === 3 && <PostProductionTab episodes={episodes} prospects={prospects} />}
      {tab === 4 && <ArchiveTab episodes={episodes} prospects={prospects} archive={archive} setArchive={setArchive} />}
    </div>
  </div>;
}
