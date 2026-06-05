"use client";
import { useEffect, useState } from "react";
import { ProductionStudioShell } from "./shell";
import { HubLanding } from "./hub-landing";

export default function ProductionStudioPage() {
  const [ok, setOk] = useState(false);

  useEffect(function () {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) {
        setOk(true);
        return;
      }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  return (
    <ProductionStudioShell>
      <HubLanding />
    </ProductionStudioShell>
  );
}
