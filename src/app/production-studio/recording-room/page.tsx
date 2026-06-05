"use client";
import { useEffect, useState } from "react";
import RecordingRoom from "../recording-room";
import { ProductionStudioShell } from "../shell";

// Auth gate mirrors /asset-library — read localStorage directly to skip
// the UserContext hydration race that bounces fresh tabs.
export default function RecordingRoomPage() {
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
    <ProductionStudioShell title="Recording Room" subtitle="Solo browser recording — mic + camera to Vercel Blob">
      <RecordingRoom />
    </ProductionStudioShell>
  );
}
