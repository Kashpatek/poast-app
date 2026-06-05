"use client";

import { useEffect, useState } from "react";
import CopyShell from "../shell";
import HeadlineDoctor from "../../headline-doctor";

export default function HeadlinePage() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch {}
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);
  if (!ok) return null;
  return (
    <CopyShell title="Headline / Hook" subtitle="Doctor your opener, A/B variants, history, send to Voice Gate.">
      <HeadlineDoctor />
    </CopyShell>
  );
}
