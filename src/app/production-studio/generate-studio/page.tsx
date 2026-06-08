"use client";
import { useEffect, useState } from "react";
import GenerateStudio from "../generate-studio";
import { ProductionStudioShell } from "../shell";

export default function GenerateStudioPage() {
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
    <ProductionStudioShell title="Generate Studio" subtitle="Image and video generation across every provider POAST has an API key for">
      <GenerateStudio />
    </ProductionStudioShell>
  );
}
