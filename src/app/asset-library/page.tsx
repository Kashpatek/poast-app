"use client";
import { useEffect, useState } from "react";
import { AssetLibraryView } from "./asset-library-view";

// SemiAnalysis Asset Library — native React rewrite. Replaces the old
// /asset-library-content.html iframe shell with a real page (logos,
// palette, type, brand guide, drag-drop upload). Auth gate reads
// localStorage directly to avoid the UserContext hydration race that
// flickered the iframe redirect on fresh tabs.
export default function AssetLibraryPage() {
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

  return <AssetLibraryView />;
}
