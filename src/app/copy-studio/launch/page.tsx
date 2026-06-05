"use client";

import { useEffect, useState } from "react";
import CopyShell from "../shell";
import DistributionPack from "../../distribution-pack";

export default function LaunchPage() {
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
    <CopyShell title="Multi-Platform Launch" subtitle="Distribution Pack composer — X / LinkedIn / IG / TikTok variants in one click.">
      <DistributionPack />
    </CopyShell>
  );
}
