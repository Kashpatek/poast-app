"use client";

// Motion editor — embeds Motionity (alyssaxuu/motionity, MIT) via iframe.
// v1 points at the hosted instance at motionity.app; v2 will swap to a
// self-hosted build under /motionity/.

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { D, ft, gf, mn } from "../../../shared-constants";

const MOTIONITY_URL = "https://motionity.app/";

interface ProjectRow {
  id: string;
  name: string;
  type: string;
}

interface PageProps { params: Promise<{ id: string }> }

export default function MotionPage({ params }: PageProps) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/docu-design/projects?id=${encodeURIComponent(id)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) setError(j.error || "Failed to load");
        else setProject(j.data as ProjectRow);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 18px",
          borderBottom: `1px solid ${D.border}`,
          background: D.card,
        }}
      >
        <Link href="/design-studio" style={{ color: D.txm, textDecoration: "none", fontFamily: mn, fontSize: 12 }}>
          ← DesignStudio
        </Link>
        <div style={{ width: 1, height: 18, background: D.border }} />
        <div style={{ fontFamily: gf, fontSize: 16, color: D.tx }}>{project?.name || "Motion"}</div>
        <span style={{ marginLeft: 6, fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber }}>MOTION</span>
        <span style={{ marginLeft: 8, fontFamily: mn, fontSize: 9, padding: "2px 6px", border: `1px solid ${D.border}`, borderRadius: 4, color: D.txd }}>
          Hosted Motionity · self-host pending
        </span>
        <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 11, color: D.txd }}>
          Export from inside Motionity → upload the file as an asset.
        </div>
      </header>

      {error ? (
        <div style={{ padding: 32, color: D.coral, fontFamily: ft }}>{error}</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <iframe
            src={MOTIONITY_URL}
            title="Motionity"
            style={{ width: "100%", height: "100%", border: "none", background: "#0A0A14" }}
            allow="clipboard-read; clipboard-write"
          />
        </div>
      )}
    </div>
  );
}
