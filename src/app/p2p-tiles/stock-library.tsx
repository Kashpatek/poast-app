"use client";

// Stock Library — batch upload + auto-tag clips from Envato Elements and
// other stock sources. Tags are stored in the existing broll-master row;
// the Article-to-Video clip picker reads from this same pool.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { TileShell, type TileProps } from "./index";

interface StockAsset {
  id: string;
  url: string;
  filename: string;
  type: string;        // "video" | "image"
  format: string;
  size: number;
  category: string;
  source: string;      // Envato Elements / Pexels / Manual / etc.
  description: string;
  tags?: string[];
  mood?: string;
  suggestedAspect?: string;
  thumbnail?: string;
  uploadedAt: string;
}

const SOURCES = ["Envato Elements", "Pexels", "Unsplash", "SemiAnalysis archive", "Manual"];
const CATEGORIES = ["AI", "Semiconductors", "Data Centers", "Networking", "Memory", "Cloud", "Energy", "Packaging", "Software", "Other"];

export function StockLibraryView({ onBack }: TileProps) {
  const [assets, setAssets] = useState<StockAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; status: string }[]>([]);
  const [filter, setFilter] = useState("");
  const [source, setSource] = useState<string>("Envato Elements");
  const [autoTag, setAutoTag] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "broll-master" && r.type === "broll-library");
      if (row?.data?.assets) setAssets(row.data.assets);
    } catch {
      /* tolerate */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function persist(next: StockAsset[]) {
    setAssets(next);
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "projects",
          id: "broll-master",
          type: "broll-library",
          data: { assets: next },
        }),
      });
    } catch { /* ignore */ }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    const queue = arr.map((f) => ({ name: f.name, status: "queued" }));
    setUploadQueue(queue);
    const newAssets: StockAsset[] = [];

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      queue[i].status = "uploading…";
      setUploadQueue([...queue]);

      try {
        const data = await fileToDataUrl(file);
        const upRes = await fetch("/api/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, filename: file.name, contentType: file.type }),
        });
        const upJson = await upRes.json();
        if (!upRes.ok || !upJson.url) {
          queue[i].status = "upload failed";
          setUploadQueue([...queue]);
          continue;
        }

        let tags: string[] = [];
        let category = "Other";
        let description = file.name.replace(/\.[^.]+$/, "");
        let mood = "";
        let suggestedAspect: string | undefined;

        if (autoTag && file.type.startsWith("image/")) {
          queue[i].status = "auto-tagging…";
          setUploadQueue([...queue]);
          try {
            const tagRes = await fetch("/api/press-to-premier/stock-tag", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: upJson.url, filename: file.name }),
            });
            const tagJson = await tagRes.json();
            if (tagRes.ok && tagJson.tags) {
              tags = tagJson.tags;
              category = tagJson.category || category;
              description = tagJson.description || description;
              mood = tagJson.mood || mood;
              suggestedAspect = tagJson.suggestedAspect;
            }
          } catch { /* ignore tag failure */ }
        }

        const asset: StockAsset = {
          id: "stock-" + Date.now() + "-" + i,
          url: upJson.url,
          filename: file.name,
          type: file.type.startsWith("video/") ? "video" : "image",
          format: file.type,
          size: file.size,
          category,
          source,
          description,
          tags,
          mood,
          suggestedAspect,
          uploadedAt: new Date().toISOString(),
        };
        newAssets.push(asset);
        queue[i].status = "ready";
        setUploadQueue([...queue]);
      } catch (e) {
        queue[i].status = "error: " + String(e).slice(0, 40);
        setUploadQueue([...queue]);
      }
    }

    if (newAssets.length) await persist([...newAssets, ...assets]);
    setTimeout(() => setUploadQueue([]), 1500);
  }

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(f);
    });
  }

  async function removeAsset(id: string) {
    const next = assets.filter((a) => a.id !== id);
    await persist(next);
  }

  const filtered = assets.filter((a) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    const hay = `${a.filename} ${a.description} ${a.category} ${a.source} ${(a.tags || []).join(" ")} ${a.mood || ""}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <TileShell
      title="Stock Library"
      badge="STOCK"
      sub="Batch-upload from Envato Elements, Pexels, or your own archive. Claude auto-tags each clip on import so the Article-to-Video picker can match the right b-roll."
      onBack={onBack}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.amber; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = D.border; }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.border; handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `1px dashed ${D.border}`,
            borderRadius: 12,
            padding: 28,
            background: D.surface,
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.15s ease",
            fontFamily: ft,
          }}
        >
          <div style={{ fontFamily: gf, fontSize: 17, color: D.tx, marginBottom: 6 }}>Drop clips here</div>
          <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5 }}>
            Or click to browse. Drag multiple at once for batch upload.
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="video/*,image/*"
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: "none" }}
          />
        </div>

        {/* Controls */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16 }}>
          <div style={lbl}>Source for this batch</div>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={inputStyle}
          >
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontFamily: ft, fontSize: 13, color: D.tx }}>
            <input
              type="checkbox"
              checked={autoTag}
              onChange={(e) => setAutoTag(e.target.checked)}
              style={{ accentColor: D.amber }}
            />
            <span>Auto-tag with Claude vision <span style={{ color: D.txm }}>(images only for now)</span></span>
          </label>

          <div style={{ marginTop: 14, fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.4, lineHeight: 1.5 }}>
            Auto-tag returns:<br/>
            • category (Semis, AI, Data Centers, …)<br/>
            • topical tags<br/>
            • mood (technical / industrial / cinematic)<br/>
            • suggested aspect (16:9 / 9:16 / 1:1)
          </div>
        </div>
      </div>

      {/* Upload queue */}
      {uploadQueue.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={lbl}>Uploading</div>
          {uploadQueue.map((u, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8, marginBottom: 4, fontFamily: mn, fontSize: 11, color: D.tx }}>
              <span>{u.name}</span>
              <span style={{ color: u.status.includes("error") || u.status.includes("failed") ? D.coral : D.amber }}>{u.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Library grid */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={lbl}>{loading ? "Loading…" : `${filtered.length} clip${filtered.length === 1 ? "" : "s"}`}</div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by tag, source, category…"
          style={{ ...inputStyle, width: 280, marginTop: 0 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {filtered.map((a) => (
          <div key={a.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ aspectRatio: "16/9", background: "#06060C", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {a.type === "video" ? (
                <video src={a.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={a.url} alt={a.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>
            <div style={{ padding: "10px 12px", flex: 1 }}>
              <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description || a.filename}</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, letterSpacing: 0.4, marginBottom: 6 }}>
                {a.category} · {a.source}{a.mood ? " · " + a.mood : ""}{a.suggestedAspect ? " · " + a.suggestedAspect : ""}
              </div>
              {(a.tags || []).length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {(a.tags || []).slice(0, 4).map((t) => (
                    <span key={t} style={{ fontFamily: mn, fontSize: 9, padding: "1px 6px", background: D.amber + "1c", color: D.amber, border: `1px solid ${D.amber}55`, borderRadius: 4, letterSpacing: 0.4 }}>{t}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ borderTop: `1px solid ${D.border}`, padding: "6px 12px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => removeAsset(a.id)}
                style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 10, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </TileShell>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${D.border}`,
  borderRadius: 6,
  color: D.tx,
  fontFamily: ft,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  marginTop: 4,
};
