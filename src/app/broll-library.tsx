"use client";
import { useState, useEffect, useRef } from "react";
import { useUser } from "./user-context";

interface Asset {
  id: string;
  url: string;
  filename: string;
  type: string;
  format: string;
  size: number;
  category: string;
  source: string;
  description: string;
  uploadedAt: number;
  thumbnail: string | null;
}

interface ToastItem {
  id: number;
  m: string;
  t: string;
}

var D = {
  bg: "#060608", card: "#09090D", border: "rgba(255,255,255,0.06)",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#9A969F", txd: "#5A5766",
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var CATEGORIES = ["AI", "Semiconductors", "Data Centers", "Networking", "Memory", "Cloud", "Energy", "Packaging", "Software", "Other"];
var TYPES = ["video", "image"];

// ═══ TOAST ═══
var _toast: { current: ((msg: string, type?: string) => void) | null } = { current: null };
function toast(msg: string, type?: string) { if (_toast.current) _toast.current(msg, type); }
function Toasts() {
  var _l = useState<ToastItem[]>([]), l = _l[0], sl = _l[1];
  _toast.current = function(m: string, t?: string) { var id = Date.now(); sl(function(p) { return [{ id: id, m: m, t: t || "success" }].concat(p).slice(0, 4); }); setTimeout(function() { sl(function(p) { return p.filter(function(x) { return x.id !== id; }); }); }, 3500); };
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", gap: 8 }}>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes brIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes brDr{from{width:100%}to{width:0}}" }} />
    {l.map(function(t) { var c = t.t === "error" ? D.coral : t.t === "info" ? D.amber : D.teal; return <div key={t.id} style={{ background: D.card, border: "1px solid " + D.border, borderLeft: "3px solid " + c, borderRadius: 10, padding: "12px 16px", minWidth: 280, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "brIn 0.25s ease" }}>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 6 }}>{t.m}</div>
      <div style={{ height: 2, background: D.border, borderRadius: 1 }}><div style={{ height: "100%", background: c, borderRadius: 1, animation: "brDr 3.5s linear forwards" }} /></div>
    </div>; })}
  </div>;
}

// ═══ HELPERS ═══
function uid(): string { return "br-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8); }
function fmtSize(bytes: number): string { if (bytes < 1024) return bytes + " B"; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / 1048576).toFixed(1) + " MB"; }
function fmtDate(ts: number): string { return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

function dbSyncAssets(assets: Asset[], createdBy?: string, createdByRole?: string) {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "projects", data: { id: "broll-master", name: "B-Roll Library", data: { assets: assets, createdBy: createdBy || "Unknown", createdByRole: createdByRole || "" }, type: "broll-asset", updated_at: new Date().toISOString() } }),
  }).catch(function() {});
}

// ═══ UPLOAD ZONE ═══
function UploadZone({ onUpload, uploading }: { onUpload: (file: File) => void; uploading: boolean }) {
  var _drag = useState(false), drag = _drag[0], setDrag = _drag[1];
  var fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    var arr = Array.from(files);
    arr.forEach(function(f) { onUpload(f); });
  }

  return <div
    onDragOver={function(e) { e.preventDefault(); setDrag(true); }}
    onDragLeave={function() { setDrag(false); }}
    onDrop={function(e) { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
    onClick={function() { fileRef.current && fileRef.current.click(); }}
    style={{ border: "2px dashed " + (drag ? D.amber : D.border), borderRadius: 12, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: drag ? D.amber + "08" : "transparent", transition: "all 0.2s" }}
  >
    <input ref={fileRef} type="file" accept="video/*,image/*" multiple onChange={function(e) { handleFiles(e.target.files); }} style={{ display: "none" }} />
    <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>{uploading ? "\u23F3" : "\uD83C\uDFA5"}</div>
    <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: uploading ? D.amber : D.txm }}>{uploading ? "Uploading..." : "Drop video clips or images here"}</div>
    <div style={{ fontFamily: ft, fontSize: 12, color: D.txd, marginTop: 4 }}>or click to browse</div>
  </div>;
}

// ═══ TAG EDITOR ═══
function TagEditor({ asset, onUpdate }: { asset: Asset; onUpdate: (asset: Asset) => void }) {
  var _cat = useState(asset.category || "Other"), cat = _cat[0], setCat = _cat[1];
  var _src = useState(asset.source || ""), src = _src[0], setSrc = _src[1];
  var _desc = useState(asset.description || ""), desc = _desc[0], setDesc = _desc[1];

  function save() {
    onUpdate(Object.assign({}, asset, { category: cat, source: src, description: desc }));
    toast("Tags updated");
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, background: D.surface, borderRadius: 10, border: "1px solid " + D.border }}>
    <div style={{ fontFamily: ft, fontSize: 10, fontWeight: 600, color: D.txd, letterSpacing: 2, textTransform: "uppercase" }}>Edit Tags</div>
    <select value={cat} onChange={function(e) { setCat(e.target.value); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + D.border, background: D.card, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none" }}>
      {CATEGORIES.map(function(c) { return <option key={c} value={c}>{c}</option>; })}
    </select>
    <input value={src} onChange={function(e) { setSrc(e.target.value); }} placeholder="Source (e.g. Getty, Pexels)" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + D.border, background: D.card, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none" }} />
    <textarea value={desc} onChange={function(e) { setDesc(e.target.value); }} placeholder="Description..." rows={2} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + D.border, background: D.card, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.5 }} />
    <button onClick={save} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: D.amber, color: D.bg, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save Tags</button>
  </div>;
}

// ═══ ASSET CARD ═══
function AssetCard({ asset, onUpdate, onDelete }: { asset: Asset; onUpdate: (asset: Asset) => void; onDelete: (id: string) => void }) {
  var _edit = useState(false), edit = _edit[0], setEdit = _edit[1];
  var _hover = useState(false), hover = _hover[0], setHover = _hover[1];
  var isVideo = asset.type === "video";

  function copyUrl() {
    navigator.clipboard.writeText(asset.url);
    toast("URL copied to clipboard");
  }

  return <div style={{ background: D.card, border: "1px solid " + (hover ? D.amber + "30" : D.border), borderRadius: 12, overflow: "hidden", transition: "all 0.2s" }}
    onMouseEnter={function() { setHover(true); }} onMouseLeave={function() { setHover(false); }}>
    {/* Thumbnail */}
    <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: D.surface, overflow: "hidden" }}>
      {isVideo ? (
        hover ? <video src={asset.url} autoPlay muted loop playsInline style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {asset.thumbnail ? <img src={asset.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 32, opacity: 0.2 }}>{"\uD83C\uDFA5"}</span>}
          </div>
      ) : (
        <img src={asset.url} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      {/* Type badge */}
      <span style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px", borderRadius: 6, background: isVideo ? D.blue + "CC" : D.teal + "CC", color: "#fff", fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{asset.type}</span>
      {/* Category badge */}
      <span style={{ position: "absolute", top: 8, right: 8, padding: "3px 8px", borderRadius: 6, background: D.amber + "CC", color: D.bg, fontFamily: ft, fontSize: 9, fontWeight: 700 }}>{asset.category || "Other"}</span>
    </div>

    {/* Info */}
    <div style={{ padding: "12px 14px" }}>
      <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 600, color: D.tx, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.filename}</div>
      {asset.description && <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.description}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {asset.source && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: "2px 6px", background: D.surface, borderRadius: 4 }}>{asset.source}</span>}
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: "2px 6px", background: D.surface, borderRadius: 4 }}>{fmtSize(asset.size)}</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: "2px 6px", background: D.surface, borderRadius: 4 }}>{asset.format}</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: "2px 6px", background: D.surface, borderRadius: 4 }}>{fmtDate(asset.uploadedAt)}</span>
      </div>
      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={copyUrl} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid " + D.amber + "40", background: "transparent", color: D.amber, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Copy URL</button>
        <button onClick={function() { setEdit(!edit); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + D.border, background: "transparent", color: D.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{edit ? "Close" : "Tags"}</button>
        <button onClick={function() { onDelete(asset.id); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + D.coral + "30", background: "transparent", color: D.coral, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{"\u2715"}</button>
      </div>
      {edit && <div style={{ marginTop: 10 }}><TagEditor asset={asset} onUpdate={function(a) { onUpdate(a); setEdit(false); }} /></div>}
    </div>
  </div>;
}

// ═══ MAIN ═══
export default function BRollLibrary() {
  var userCtx = useUser();
  var _assets = useState<Asset[]>([]), assets = _assets[0], setAssets = _assets[1];
  var _search = useState(""), search = _search[0], setSearch = _search[1];
  var _filterCat = useState("All"), filterCat = _filterCat[0], setFilterCat = _filterCat[1];
  var _filterType = useState("All"), filterType = _filterType[0], setFilterType = _filterType[1];
  var _uploading = useState(false), uploading = _uploading[0], setUploading = _uploading[1];
  var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];

  // On mount: fetch from Supabase, fall back to localStorage
  useEffect(function() {
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      try { var a = localStorage.getItem("broll-assets"); if (a) setAssets(JSON.parse(a)); } catch (e) {}
      setLoaded(true);
    }, 800);

    fetch("/api/db?table=projects").then(function(r) { return r.json(); }).then(function(res) {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (res.data && res.data.length > 0) {
        var row = res.data.find(function(r: Record<string, unknown>) { return r.type === "broll-asset" && r.id === "broll-master"; });
        if (row && row.data && row.data.assets && row.data.assets.length > 0) {
          setAssets(row.data.assets);
          setLoaded(true);
          return;
        }
      }
      try { var a = localStorage.getItem("broll-assets"); if (a) setAssets(JSON.parse(a)); } catch (e) {}
      setLoaded(true);
    }).catch(function() {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      try { var a = localStorage.getItem("broll-assets"); if (a) setAssets(JSON.parse(a)); } catch (e) {}
      setLoaded(true);
    });

    return function() { clearTimeout(timer); };
  }, []);

  // Persist on change
  useEffect(function() {
    if (!loaded) return;
    try { localStorage.setItem("broll-assets", JSON.stringify(assets)); } catch (e) {}
    // TODO(akash): B-Roll library is shared (id: "broll-master") so createdBy reflects the most recent uploader for the entire asset list, not per-asset.
    dbSyncAssets(assets, userCtx.user ? userCtx.user.name : "Unknown", userCtx.user ? userCtx.user.role : "");
  }, [assets, loaded]);

  // Upload handler
  function handleUpload(file: File) {
    setUploading(true);
    var reader = new FileReader();
    reader.onload = function() {
      var base64 = reader.result;
      var isVideo = file.type.startsWith("video");
      var ext = file.name.split(".").pop() || "bin";
      fetch("/api/upload-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64, filename: "broll/" + uid() + "." + ext, contentType: file.type }),
      }).then(function(r) { return r.json(); }).then(function(res) {
        if (res.url) {
          var asset: Asset = {
            id: uid(), url: res.url, filename: file.name, type: isVideo ? "video" : "image",
            format: ext.toUpperCase(), size: file.size, category: "Other", source: "", description: "",
            uploadedAt: Date.now(), thumbnail: null,
          };
          setAssets(function(p) { return [asset].concat(p); });
          toast("Uploaded " + file.name);
        } else { toast("Upload failed", "error"); }
        setUploading(false);
      }).catch(function() { toast("Upload failed", "error"); setUploading(false); });
    };
    reader.readAsDataURL(file);
  }

  function updateAsset(updated: Asset) {
    setAssets(function(p) { return p.map(function(a) { return a.id === updated.id ? updated : a; }); });
  }

  function deleteAsset(id: string) {
    setAssets(function(p) { return p.filter(function(a) { return a.id !== id; }); });
    toast("Asset removed", "info");
  }

  // Filtering
  var filtered = assets.filter(function(a) {
    if (filterCat !== "All" && a.category !== filterCat) return false;
    if (filterType !== "All" && a.type !== filterType) return false;
    if (search) {
      var q = search.toLowerCase();
      var hay = ((a.filename || "") + " " + (a.description || "") + " " + (a.source || "") + " " + (a.category || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px" }}>
    <Toasts />

    {/* Header */}
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: ft, fontSize: 42, fontWeight: 900, color: D.tx, letterSpacing: -2, marginBottom: 6 }}>B-Roll Library</div>
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 500, color: D.txm }}>Manage video clips and images for Press to Premier productions.</div>
      <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginTop: 6 }}>{assets.length} asset{assets.length !== 1 ? "s" : ""} total</div>
    </div>

    {/* Upload Zone */}
    <div style={{ marginBottom: 28 }}>
      <UploadZone onUpload={handleUpload} uploading={uploading} />
    </div>

    {/* Search + Filters */}
    <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
      <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search by name, description, source..." style={{ flex: 1, minWidth: 200, padding: "10px 16px", borderRadius: 10, border: "1px solid " + D.border, background: D.surface, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none" }} />
      <select value={filterCat} onChange={function(e) { setFilterCat(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + D.border, background: D.surface, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none", cursor: "pointer" }}>
        <option value="All">All Categories</option>
        {CATEGORIES.map(function(c) { return <option key={c} value={c}>{c}</option>; })}
      </select>
      <select value={filterType} onChange={function(e) { setFilterType(e.target.value); }} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + D.border, background: D.surface, color: D.tx, fontFamily: ft, fontSize: 12, outline: "none", cursor: "pointer" }}>
        <option value="All">All Types</option>
        {TYPES.map(function(t) { return <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>; })}
      </select>
      {(search || filterCat !== "All" || filterType !== "All") && <button onClick={function() { setSearch(""); setFilterCat("All"); setFilterType("All"); }} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + D.border, background: "transparent", color: D.txm, fontFamily: ft, fontSize: 12, cursor: "pointer" }}>Clear</button>}
    </div>

    {/* Results count */}
    {(search || filterCat !== "All" || filterType !== "All") && <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, marginBottom: 16 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>}

    {/* Grid */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {filtered.map(function(a) {
        return <AssetCard key={a.id} asset={a} onUpdate={updateAsset} onDelete={deleteAsset} />;
      })}
    </div>

    {/* Empty state */}
    {filtered.length === 0 && loaded && <div style={{ textAlign: "center", padding: 80 }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.15 }}>{"\uD83C\uDFA5"}</div>
      <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 700, color: D.txd }}>{assets.length === 0 ? "No assets yet" : "No matching assets"}</div>
      <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 500, color: D.txd, marginTop: 6 }}>{assets.length === 0 ? "Upload video clips or images to build your b-roll library." : "Try adjusting your search or filters."}</div>
    </div>}
  </div>;
}
