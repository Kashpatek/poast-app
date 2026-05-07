"use client";

import React from "react";
import { useUser } from "../user-context";
import { useOnboarding } from "../onboarding-context";
import { WelcomeModal } from "./welcome-modal";
import { CoachMark } from "./coach-mark";
import { ChartMakerTour } from "./chart-maker-tour";
import {
  STEP_WELCOME,
  STEP_TOOL_SLOPTOP,
  STEP_TOOL_CAROUSEL,
  STEP_TOOL_CAPTIONS,
  STEP_TOOL_CHART2,
  STEP_CHART2_DEEP,
  TOOL_COACH,
} from "./tours";

interface OnboardingHostProps {
  sec: string;
}

const SEC_TO_STEP: Record<string, string> = {
  sloptop: STEP_TOOL_SLOPTOP,
  carousel: STEP_TOOL_CAROUSEL,
  captions: STEP_TOOL_CAPTIONS,
  chart2: STEP_TOOL_CHART2,
};

// Singleton overlay that decides what onboarding surface, if any, to render
// for the current user + section. Mounted once at the top level of poast-client.
export function OnboardingHost({ sec }: OnboardingHostProps) {
  const { user } = useUser();
  const { hasSeen, markSeen, activeStep, setActiveStep } = useOnboarding();

  const isAnalyst = user?.role === "Analyst";

  // Tiny global stylesheet for the coach-card pop animation. Defined here so
  // every onboarding surface can use it without duplicating <style> blocks.
  const styleTag = (
    <style
      dangerouslySetInnerHTML={{
        __html:
          "@keyframes coachPop{0%{opacity:0;transform:translateY(12px) scale(0.97)}100%{opacity:1;transform:translateY(0) scale(1)}}",
      }}
    />
  );

  // 1. Explicit replays (triggered from Settings or the Chart Maker toolbar)
  // beat the auto-detection logic below.
  if (activeStep === STEP_WELCOME) {
    return (
      <>
        {styleTag}
        <WelcomeModal
          onClose={() => {
            markSeen(STEP_WELCOME);
            setActiveStep(null);
          }}
          onComplete={() => {
            markSeen(STEP_WELCOME);
            setActiveStep(null);
          }}
        />
      </>
    );
  }

  if (activeStep === STEP_CHART2_DEEP) {
    return (
      <>
        {styleTag}
        <ChartMakerTour
          onClose={() => {
            markSeen(STEP_CHART2_DEEP);
            setActiveStep(null);
          }}
          onComplete={() => {
            markSeen(STEP_CHART2_DEEP);
            setActiveStep(null);
          }}
        />
      </>
    );
  }

  // Per-section auto-replay (rare — only fires if Settings replay set the step).
  if (activeStep && activeStep.indexOf("tool-") === 0) {
    const toolKey = activeStep.replace("tool-", "");
    const content = TOOL_COACH[toolKey];
    if (content) {
      return (
        <>
          {styleTag}
          <CoachMark
            content={content}
            onDismiss={() => { markSeen(activeStep); setActiveStep(null); }}
            onHidePermanent={() => { markSeen(activeStep); setActiveStep(null); }}
          />
        </>
      );
    }
  }

  // 2. Auto-detection. Only Analysts get the auto-show; other roles can replay
  // from Settings if they want a refresher.
  if (!user || !isAnalyst) return null;

  // Welcome takes priority over per-tool coach marks. New analysts see this
  // first regardless of which section they land on.
  if (!hasSeen(STEP_WELCOME)) {
    return (
      <>
        {styleTag}
        <WelcomeModal
          onClose={() => markSeen(STEP_WELCOME)}
          onComplete={() => markSeen(STEP_WELCOME)}
        />
      </>
    );
  }

  // Per-tool coach mark on first visit. Includes a primary action linking to
  // the deep tour for Chart Maker 2.
  const stepId = SEC_TO_STEP[sec];
  if (stepId && !hasSeen(stepId)) {
    const content = TOOL_COACH[sec];
    if (content) {
      const primaryAction =
        sec === "chart2"
          ? {
              label: "Take the tour",
              onClick: () => {
                markSeen(STEP_TOOL_CHART2);
                setActiveStep(STEP_CHART2_DEEP);
              },
            }
          : undefined;
      return (
        <>
          {styleTag}
          <CoachMark
            content={content}
            onDismiss={() => markSeen(stepId)}
            onHidePermanent={() => markSeen(stepId)}
            primaryAction={primaryAction}
          />
        </>
      );
    }
  }

  return null;
}
