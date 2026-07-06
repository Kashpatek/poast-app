// Carousel 2.0 · deck editor (the make-flow).
//
// The multi-slide surface: a slide strip (reorder / add / duplicate / delete),
// a large preview of the current slide, and a per-slide inspector (pick
// template, pick background, edit the overlay's fields, open in the canvas
// editor). "Export deck" rasterizes every slide to a PNG — the carousel-2
// equivalent of the production carousel's Edit + Export steps, using the same
// catalog assets. Autosaves the deck to IndexedDB (local-only, no Neon).

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { D as C, ft, gf, mn } from "../../shared-constants";
import {
  createDeck,
  makeSlide,
  addSlide,
  duplicateSlide,
  removeSlide,
  moveSlide,
  setSlideValue,
  setSlideBackground,
  setSlideOverlay,
  renameDeck,
  updateSlide,
  renderDeckSlideSvg,
} from "../catalog/deck";
import { saveDeck, loadCurrentDeck } from "../catalog/deck-store";
import { exportDeckPngs } from "../catalog/export";
import { openSvgInEditor, editorHref } from "../catalog/editor-bridge";
import {
  isBackground,
  isTemplate,
  type CatalogBackground,
  type CatalogField,
  type CatalogProduct,
  type CatalogTemplate,
  type Deck,
  type DeckSlide,
  type SlideRole,
} from "../catalog/types";

const ROLES: SlideRole[] = ["cover", "body", "closer"];
const ROLE_COLOR: Record<SlideRole, string> = { cover: C.amber, body: C.blue, closer: C.teal };

function inlineStyle(svg: string): string {
  return svg.replace(/^<svg /, '<svg style="width:100%;height:100%;display:block" ');
}

function seedDeck(products: CatalogProduct[]): Deck {
  const templates = products.filter(isTemplate);
  const backgrounds = products.filter(isBackground);
  const cover = templates.find((t) => t.coverEligible) || templates[0];
  const bg = backgrounds[0];
  if (!cover) return createDeck("Untitled carousel", []);
  return createDeck("Untitled carousel", [makeSlide(cover, "cover", bg)]);
}

function Chip({ active, color, onClick, children, title }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        cursor: "pointer",
        background: active ? color + "22" : C.bg,
        border: "1px solid " + (active ? color + "80" : C.border),
        color: active ? color : C.txm,
        fontFamily: mn,
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function DeckEditor({ products, onClose }: { products: CatalogProduct[]; onClose: () => void }) {
  const router = useRouter();
  const get = useMemo(() => {
    const m = new Map(products.map((p) => [p.id, p] as const));
    return (id: string): CatalogProduct | undefined => m.get(id);
  }, [products]);
  const templates = useMemo(() => products.filter(isTemplate) as CatalogTemplate[], [products]);
  const backgrounds = useMemo(() => products.filter(isBackground) as CatalogBackground[], [products]);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [currentId, setCurrentId] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [opening, setOpening] = useState(false);

  // Resume the last deck, else seed a fresh one (runs once, after products load).
  useEffect(() => {
    let live = true;
    (async () => {
      const resumed = await loadCurrentDeck();
      if (!live) return;
      const d = resumed && resumed.slides.length ? resumed : seedDeck(products);
      setDeck(d);
      setCurrentId(d.slides[0]?.id || "");
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (local IndexedDB) on every change.
  useEffect(() => {
    if (deck) void saveDeck(deck);
  }, [deck]);

  const current = deck?.slides.find((s) => s.id === currentId) || deck?.slides[0] || null;
  const currentOverlay = current ? (get(current.overlayId) as CatalogTemplate | undefined) : undefined;

  // Render every slide once per deck change (used by strip + preview).
  const slideSvgs = useMemo(() => {
    if (!deck) return new Map<string, string>();
    const m = new Map<string, string>();
    deck.slides.forEach((s) => m.set(s.id, renderDeckSlideSvg(s, get, deck.dims)));
    return m;
  }, [deck, get]);

  if (!deck) {
    return <div style={{ padding: 48, textAlign: "center", fontFamily: ft, fontSize: 13, color: C.txm }}>Preparing carousel…</div>;
  }

  const mutate = (next: Deck) => {
    setDeck(next);
  };
  const patchCurrent = (patch: Partial<DeckSlide>) => {
    if (current) mutate(updateSlide(deck, current.id, patch));
  };

  const onAdd = () => {
    const base = currentOverlay || templates[0];
    if (!base) return;
    const slide = makeSlide(base, "body", current?.backgroundId ? (get(current.backgroundId) as CatalogBackground) : undefined);
    const next = addSlide(deck, slide);
    mutate(next);
    setCurrentId(slide.id);
  };
  const onDuplicate = (id: string) => {
    const next = duplicateSlide(deck, id);
    mutate(next);
    const idx = next.slides.findIndex((s) => s.id === id);
    const dup = next.slides[idx + 1];
    if (dup) setCurrentId(dup.id);
  };
  const onRemove = (id: string) => {
    const next = removeSlide(deck, id);
    mutate(next);
    if (id === currentId) setCurrentId(next.slides[0]?.id || "");
  };

  const editInCanvas = async () => {
    if (!current || opening) return;
    setOpening(true);
    try {
      const svg = slideSvgs.get(current.id) || renderDeckSlideSvg(current, get, deck.dims);
      const id = await openSvgInEditor({ svg, width: deck.dims.width, height: deck.dims.height, title: `${deck.title} · slide ${deck.slides.indexOf(current) + 1}` });
      router.push(editorHref(id));
    } catch {
      setOpening(false);
    }
  };

  const exportDeck = async () => {
    if (exporting || !deck.slides.length) return;
    setExporting(true);
    setExportMsg("Rendering…");
    try {
      const svgs = deck.slides.map((s) => slideSvgs.get(s.id) || renderDeckSlideSvg(s, get, deck.dims));
      await exportDeckPngs(svgs, deck.dims.width, deck.dims.height, deck.title, {
        onProgress: (done, total) => setExportMsg(`Downloading ${done}/${total}…`),
      });
      setExportMsg(`Exported ${deck.slides.length} slides`);
      setTimeout(() => setExportMsg(""), 2500);
    } catch {
      setExportMsg("Export failed");
      setTimeout(() => setExportMsg(""), 2500);
    } finally {
      setExporting(false);
    }
  };

  const previewSvg = current ? inlineStyle(slideSvgs.get(current.id) || "") : "";

  return (
    <div data-testid="carousel2-deck" data-slide-count={deck.slides.length}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <button
          onClick={onClose}
          style={{ padding: "8px 12px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}
        >
          ← Library
        </button>
        <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 3 }}>Carousel 2.0 · Make carousel</div>
          <input
            value={deck.title}
            onChange={(e) => mutate(renameDeck(deck, e.target.value))}
            spellCheck={false}
            style={{ background: "transparent", border: "none", outline: "none", fontFamily: gf, fontSize: 24, fontWeight: 900, color: C.tx, letterSpacing: -0.5, width: 420, maxWidth: "60vw" }}
          />
        </div>
        <div style={{ flex: 1 }} />
        {exportMsg && <span style={{ fontFamily: mn, fontSize: 11, color: C.txm }}>{exportMsg}</span>}
        <button
          data-testid="carousel2-deck-export"
          onClick={exportDeck}
          disabled={exporting}
          title="Download every slide as a PNG (like the production carousel export)"
          style={{ padding: "10px 18px", borderRadius: 9, background: exporting ? C.surface : C.teal + "18", border: "1px solid " + C.teal + "66", color: C.teal, fontFamily: ft, fontSize: 14, fontWeight: 800, cursor: exporting ? "wait" : "pointer" }}
        >
          {exporting ? "Exporting…" : `⬇ Export deck (${deck.slides.length})`}
        </button>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        {/* Slide strip */}
        <div data-testid="carousel2-deck-strip" style={{ width: 168, flexShrink: 0, maxHeight: "calc(100vh - 120px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
          {deck.slides.map((s, i) => {
            const active = s.id === current?.id;
            return (
              <div key={s.id}>
                <div
                  onClick={() => setCurrentId(s.id)}
                  style={{ position: "relative", cursor: "pointer", border: "2px solid " + (active ? C.amber : C.border), borderRadius: 9, overflow: "hidden", background: "#06060C", aspectRatio: "1080/1350" }}
                >
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: inlineStyle(slideSvgs.get(s.id) || "") }} />
                  <div style={{ position: "absolute", top: 5, left: 5, display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 800, color: "#fff", background: "#000A", borderRadius: 5, padding: "2px 5px" }}>{i + 1}</span>
                    <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, color: ROLE_COLOR[s.role], background: "#000A", borderRadius: 5, padding: "2px 5px", textTransform: "uppercase" }}>{s.role}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3, marginTop: 4, opacity: active ? 1 : 0.55 }}>
                  <StripBtn label="↑" title="Move up" onClick={() => mutate(moveSlide(deck, s.id, -1))} />
                  <StripBtn label="↓" title="Move down" onClick={() => mutate(moveSlide(deck, s.id, 1))} />
                  <StripBtn label="⧉" title="Duplicate" onClick={() => onDuplicate(s.id)} />
                  <StripBtn label="✕" title="Delete" onClick={() => onRemove(s.id)} disabled={deck.slides.length <= 1} />
                </div>
              </div>
            );
          })}
          <button
            data-testid="carousel2-deck-add"
            onClick={onAdd}
            style={{ padding: "10px 0", borderRadius: 9, background: C.card, border: "1px dashed " + C.border, color: C.txm, fontFamily: mn, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            + Add slide
          </button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
          <div
            data-testid="carousel2-deck-preview"
            style={{ width: "100%", maxWidth: 460, aspectRatio: "1080/1350", background: "#06060C", borderRadius: 14, overflow: "hidden", border: "1px solid " + C.border }}
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
        </div>

        {/* Inspector */}
        <div style={{ width: 372, flexShrink: 0, maxHeight: "calc(100vh - 120px)", overflowY: "auto", background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: 18 }}>
          {!current && <div style={{ fontFamily: ft, fontSize: 13, color: C.txm }}>No slide selected.</div>}
          {current && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                <button
                  data-testid="carousel2-deck-edit"
                  onClick={editInCanvas}
                  disabled={opening}
                  title="Open this slide as editable objects in the canvas editor"
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, background: opening ? C.surface : C.violet + "18", border: "1px solid " + C.violet + "55", color: C.violet, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: opening ? "wait" : "pointer" }}
                >
                  {opening ? "Opening…" : "✎ Edit in canvas"}
                </button>
              </div>

              {/* Role */}
              <Section label="Slide role" color={C.amber} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {ROLES.map((r) => (
                  <Chip key={r} active={current.role === r} color={ROLE_COLOR[r]} onClick={() => patchCurrent({ role: r })}>
                    {r}
                  </Chip>
                ))}
              </div>

              {/* Template */}
              <Section label={`Template · ${templates.length}`} color={C.violet} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {templates.map((t) => (
                  <Chip
                    key={t.id}
                    active={current.overlayId === t.id}
                    color={C.violet}
                    onClick={() => mutate(setSlideOverlay(deck, current.id, t))}
                    title={t.coverEligible ? "cover-eligible" : undefined}
                  >
                    {t.coverEligible ? "★ " : ""}
                    {t.title}
                  </Chip>
                ))}
              </div>

              {/* Background */}
              <Section label="Background" color={C.blue} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                <Chip active={!current.backgroundId} color={C.blue} onClick={() => mutate(setSlideBackground(deck, current.id, undefined))}>
                  none
                </Chip>
                {backgrounds.map((b) => (
                  <Chip key={b.id} active={current.backgroundId === b.id} color={C.blue} onClick={() => mutate(setSlideBackground(deck, current.id, b.id))}>
                    {b.title}
                  </Chip>
                ))}
              </div>

              {/* Fields */}
              <Section label="Content" color={C.teal} />
              {currentOverlay ? (
                <FieldEditors overlay={currentOverlay} slide={current} onChange={(name, value) => mutate(setSlideValue(deck, current.id, name, value))} />
              ) : (
                <div style={{ fontFamily: ft, fontSize: 12, color: C.txm }}>Template not found in catalog.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, color }: { label: string; color: string }) {
  return <div style={{ fontFamily: mn, fontSize: 9, color, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 9 }}>{label}</div>;
}

function StripBtn({ label, title, onClick, disabled }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      title={title}
      disabled={disabled}
      style={{ flex: 1, padding: "3px 0", borderRadius: 5, background: C.surface, border: "1px solid " + C.border, color: disabled ? C.txd : C.txm, fontFamily: mn, fontSize: 11, cursor: disabled ? "default" : "pointer" }}
    >
      {label}
    </button>
  );
}

function FieldEditors({ overlay, slide, onChange }: { overlay: CatalogTemplate; slide: DeckSlide; onChange: (name: string, value: string) => void }) {
  const editable = overlay.fields.filter((f) => f.type !== "chart");
  if (!editable.length) return <div style={{ fontFamily: ft, fontSize: 12, color: C.txm }}>This template has no fillable fields.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {editable.map((f) => (
        <FieldRow key={f.name} field={f} value={slide.values[f.name] ?? f.defaultValue ?? ""} onChange={(v) => onChange(f.name, v)} />
      ))}
    </div>
  );
}

function FieldRow({ field, value, onChange }: { field: CatalogField; value: string; onChange: (v: string) => void }) {
  const role = field.locator.role;
  const maxLen = field.constraints?.maxLen;
  const over = typeof maxLen === "number" && value.length > maxLen;
  const multiline = field.type === "richtext" || field.constraints?.multiline || role === "body";
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    background: C.bg,
    border: "1px solid " + (over ? C.coral + "80" : C.border),
    borderRadius: 7,
    color: C.tx,
    fontFamily: field.type === "image" ? mn : ft,
    fontSize: 13,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: C.txm }}>
          {field.label || field.name}
          {role && <span style={{ color: C.txd, fontWeight: 500 }}> · {role}</span>}
        </span>
        {typeof maxLen === "number" && (
          <span style={{ fontFamily: mn, fontSize: 9, color: over ? C.coral : C.txd }}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea data-field-name={field.name} data-field-type={field.type} value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={inputStyle} spellCheck={false} />
      ) : (
        <input data-field-name={field.name} data-field-type={field.type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.type === "image" ? "image URL…" : field.placeholder} style={inputStyle} spellCheck={false} />
      )}
    </div>
  );
}
