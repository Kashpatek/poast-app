"use client";

import React from "react";
import { useOnboarding } from "../onboarding-context";
import { STEP_CHART2_DEEP } from "./tours";
import { D, ft, mn } from "../shared-constants";

// Tiny floating trigger that lives in the top-right of the Chart Maker 2 view.
// Click → starts the deep tour overlay. Hidden while the tour is already open
// or if the user has dismissed it permanently and not opted to replay from
// Settings (we still show it after dismiss — discoverability matters more than
// neatness). Cheap to mount.
export function ChartTourTrigger() {
  const { activeStep, setActiveStep } = useOnboarding();
  if (activeStep === STEP_CHART2_DEEP) return null;

  return (
    <button
      type="button"
      onClick={() => setActiveStep(STEP_CHART2_DEEP)}
      style={btn}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = D.amber;
        e.currentTarget.style.color = D.amber;
        e.currentTarget.style.boxShadow = "0 0 16px rgba(247,176,65,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = D.border;
        e.currentTarget.style.color = D.txm;
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      }}
      title="Walk through the Chart Maker features"
    >
      <span style={dot} />
      Take the tour
    </button>
  );
}

const btn: React.CSSProperties = {
  position: "fixed",
  top: 14,
  right: 18,
  zIndex: 90,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(10,10,20,0.85)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  color: D.txm,
  border: `1px solid ${D.border}`,
  padding: "6px 12px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  transition: "all 0.18s ease",
};

const dot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: D.amber,
  fontFamily: mn,
  display: "inline-block",
  boxShadow: "0 0 8px rgba(247,176,65,0.6)",
};
