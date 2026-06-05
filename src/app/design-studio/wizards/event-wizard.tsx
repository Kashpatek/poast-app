"use client";

// Three-step Event one-pager wizard:
// 1) Pick event from the SA roster
// 2) Pick format + size (flyer / sponsor slide / badge / backdrop)
// 3) Brief: SA role, key messages, contact CTA
//
// Submits as type: "event" with full brief on the row, then routes to the
// canvas. The brief pre-shape mechanism takes over and pre-fills the chat
// draft so the user can generate the first artboard immediately.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import {
  WizardShell,
  wizardLabel,
  wizardInput,
  wizardTextarea,
} from "./wizard-shell";
import {
  EVENT_CATEGORIES,
  findCategory,
  type Category,
} from "./categories";
import {
  GROUP_ORDER,
  SIZE_PRESETS,
  findPreset,
  type SizePreset,
  type SizeGroup,
} from "./size-presets";
import { EVENT_ROSTER, findEvent, type EventEntry } from "./events";

interface EventWizardProps {
  open: boolean;
  onClose: () => void;
  initialEventId?: string;
  initialCategoryId?: string;
  initialPresetId?: string;
}

const SA_ROLES = [
  { id: "speaker",  label: "Speaker" },
  { id: "sponsor",  label: "Sponsor" },
  { id: "attendee", label: "Attendee" },
  { id: "host",     label: "Host" },
];

export function EventWizard({ open, onClose, initialEventId, initialCategoryId, initialPresetId }: EventWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const validEventId = initialEventId && findEvent(initialEventId) ? initialEventId : "";
  const validCatId = initialCategoryId && findCategory(initialCategoryId) ? initialCategoryId : "event-flyer";
  // Step 0=event, 1=category+size, 2=brief. Skip what's preselected.
  const startStep = validEventId && initialPresetId ? 2 : validEventId ? 1 : 0;
  const [step, setStep] = useState<number>(startStep);
  const [eventId, setEventId] = useState(validEventId);
  const [categoryId, setCategoryId] = useState(validCatId);
  const [presetId, setPresetId] = useState(initialPresetId ?? "event-flyer-letter");
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [saRole, setSaRole] = useState("speaker");
  const [keyMessages, setKeyMessages] = useState("");
  const [cta, setCta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const event: EventEntry | undefined = useMemo(() => findEvent(eventId), [eventId]);
  const category: Category | undefined = useMemo(() => findCategory(categoryId), [categoryId]);
  const visibleGroups: SizeGroup[] = useMemo(() => category?.sizeGroups ?? [], [category]);
  const recommendedPresets: SizePreset[] = useMemo(
    () =>
      (category?.recommendedPresets ?? [])
        .map((id) => findPreset(id))
        .filter((p): p is SizePreset => !!p),
    [category]
  );

  function reset() {
    setStep(0);
    setEventId("");
    setCategoryId("event-flyer");
    setPresetId("event-flyer-letter");
    setShowAllSizes(false);
    setSaRole("speaker");
    setKeyMessages("");
    setCta("");
    setSubmitting(false);
  }

  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  const canGoNext = (() => {
    if (step === 0) return !!eventId;
    if (step === 1) return !!presetId;
    if (step === 2) return !submitting;
    return false;
  })();

  async function submit() {
    if (submitting || !event) return;
    setSubmitting(true);
    try {
      const preset = findPreset(presetId);
      const contextLines = [
        `Event: ${event.label}`,
        `When/where: ${event.sub}`,
        `SA role: ${saRole}`,
        `Format: ${category?.label}${preset ? ` · ${preset.label} (${preset.w}×${preset.h}px)` : ""}`,
        keyMessages ? `Key messages:\n${keyMessages}` : "",
        cta ? `CTA: ${cta}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const payload = {
        name: `${event.label} · ${category?.label ?? "one-pager"}`,
        type: "event" as const,
        fidelity: "high" as const,
        size_preset: preset?.id ?? null,
        category: categoryId,
        purpose: categoryId,
        brief: {
          title: event.label,
          subtitle: category?.label,
          audience: "Conference attendees",
          tone: "institutional",
          context: contextLines,
          keyPoints: keyMessages
            ? keyMessages.split("\n").map((s) => s.trim()).filter(Boolean)
            : undefined,
        },
        format: "svg",
      };

      const res = await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Couldn't create event one-pager");
        setSubmitting(false);
        return;
      }
      const id = j.data?.id;
      const w = preset?.w ?? 1080;
      const h = preset?.h ?? 1350;
      const name = `${event.label} · ${category?.label ?? "one-pager"}`;
      reset();
      onClose();
      const params = new URLSearchParams({
        category: "event",
        w: String(w),
        h: String(h),
        name,
        template: categoryId === "sponsor-slide" ? "event-agenda-strip" : "event-headliner",
      });
      if (id) params.set("project", id);
      router.push(`/design-studio/canvas-editor?${params.toString()}`);
    } catch (e) {
      showToast(String(e));
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title={WIZARD_TITLES[step]}
      badge="EVENT ONE-PAGER"
      step={step}
      totalSteps={3}
      canGoNext={canGoNext}
      isFinalStep={step === 2}
      finalLabel={submitting ? "Creating…" : "Create project"}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (step === 2 ? submit() : setStep((s) => Math.min(2, s + 1)))}
      onClose={close}
    >
      {step === 0 ? (
        <EventStep value={eventId} onChange={setEventId} />
      ) : null}

      {step === 1 ? (
        <FormatStep
          category={categoryId}
          setCategory={(id) => {
            setCategoryId(id);
            const c = findCategory(id);
            if (c?.defaultPreset) setPresetId(c.defaultPreset);
          }}
          recommended={recommendedPresets}
          allGroups={visibleGroups}
          presetId={presetId}
          setPresetId={setPresetId}
          showAll={showAllSizes}
          setShowAll={setShowAllSizes}
        />
      ) : null}

      {step === 2 ? (
        <BriefStep
          saRole={saRole}
          setSaRole={setSaRole}
          keyMessages={keyMessages}
          setKeyMessages={setKeyMessages}
          cta={cta}
          setCta={setCta}
        />
      ) : null}
    </WizardShell>
  );
}

const WIZARD_TITLES = ["Which event?", "What format?", "Brief"];

// ─── Step 0 — Event ─────────────────────────────────────────────────
function EventStep({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginBottom: 14, lineHeight: 1.5 }}>
        Pick from the SA event roster. The wizard pre-fills the brief with
        what we know about the event.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {EVENT_ROSTER.map((e) => {
          const active = value === e.id;
          return (
            <button
              type="button"
              key={e.id}
              onClick={() => onChange(e.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                padding: "10px 12px",
                background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 10,
                color: D.tx,
                cursor: "pointer",
                fontFamily: ft,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  background: "#0A0A14",
                  border: `1px solid ${D.border}`,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {e.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.logoUrl} alt="" style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain", filter: "brightness(1.1)" }} />
                ) : (
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>—</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: gf, fontSize: 13, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.5 }}>{e.sub} · {e.category}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1 — Format + Size ─────────────────────────────────────────
function FormatStep({
  category,
  setCategory,
  recommended,
  allGroups,
  presetId,
  setPresetId,
  showAll,
  setShowAll,
}: {
  category: string;
  setCategory: (id: string) => void;
  recommended: SizePreset[];
  allGroups: SizeGroup[];
  presetId: string;
  setPresetId: (id: string) => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) {
  const orderedGroups = GROUP_ORDER.filter((g) => allGroups.includes(g.group));
  return (
    <div>
      <div style={wizardLabel}>Format</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {EVENT_CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategory(c.id)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 8,
                color: D.tx,
                cursor: "pointer",
                fontFamily: ft,
              }}
            >
              <div style={{ fontFamily: gf, fontSize: 13, marginBottom: 2 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: D.txm }}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={wizardLabel}>Size</div>
        <button type="button" onClick={() => setShowAll(!showAll)} style={{ background: "transparent", border: "none", color: D.amber, fontFamily: ft, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          {showAll ? "show fewer" : "show all sizes"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {recommended.map((p) => (
          <PresetTile key={p.id} p={p} active={presetId === p.id} onClick={() => setPresetId(p.id)} />
        ))}
      </div>

      {showAll
        ? orderedGroups.map((g) => {
            const set = new Set(recommended.map((r) => r.id));
            const items = SIZE_PRESETS.filter((p) => p.group === g.group && !set.has(p.id));
            if (!items.length) return null;
            return (
              <div key={g.group} style={{ marginTop: 12 }}>
                <div style={wizardLabel}>{g.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                  {items.map((p) => (
                    <PresetTile key={p.id} p={p} active={presetId === p.id} onClick={() => setPresetId(p.id)} />
                  ))}
                </div>
              </div>
            );
          })
        : null}
    </div>
  );
}

function PresetTile({ p, active, onClick }: { p: SizePreset; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "8px 10px",
        background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${active ? D.amber : D.border}`,
        borderRadius: 8,
        color: D.tx,
        cursor: "pointer",
        fontFamily: ft,
      }}
    >
      <div style={{ fontSize: 12, lineHeight: 1.3 }}>{p.label}</div>
      <div style={{ fontSize: 10, fontFamily: mn, color: D.txd, marginTop: 2, letterSpacing: 0.4 }}>
        {p.w} × {p.h} {p.units}
      </div>
    </button>
  );
}

// ─── Step 2 — Brief ─────────────────────────────────────────────────
function BriefStep({
  saRole,
  setSaRole,
  keyMessages,
  setKeyMessages,
  cta,
  setCta,
}: {
  saRole: string;
  setSaRole: (v: string) => void;
  keyMessages: string;
  setKeyMessages: (v: string) => void;
  cta: string;
  setCta: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={wizardLabel}>SA role at the event</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          {SA_ROLES.map((r) => {
            const active = saRole === r.id;
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => setSaRole(r.id)}
                style={{
                  padding: "8px 10px",
                  background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? D.amber : D.border}`,
                  borderRadius: 8,
                  color: D.tx,
                  cursor: "pointer",
                  fontFamily: ft,
                  fontSize: 13,
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label style={wizardLabel}>Key messages · one per line</label>
        <textarea
          value={keyMessages}
          onChange={(e) => setKeyMessages(e.target.value)}
          placeholder="Why SA is at this event\nWhat we'll showcase\nWho should care"
          style={{ ...wizardTextarea, minHeight: 100 }}
        />
      </div>
      <div>
        <label style={wizardLabel}>Call to action</label>
        <input
          type="text"
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="Visit booth 42 · semianalysis.com · book a meeting"
          style={wizardInput}
        />
      </div>
    </div>
  );
}
