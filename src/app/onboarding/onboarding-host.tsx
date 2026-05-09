"use client";

import React from "react";
import { useUser, isAnalyst } from "../user-context";
import { useOnboarding } from "../onboarding-context";
import { WelcomeModal } from "./welcome-modal";
import { CoachMark } from "./coach-mark";
import { ChartMakerTour } from "./chart-maker-tour";
import {
  STEP_WELCOME,
  STEP_TOOL_CHART2,
  STEP_CHART2_DEEP,
  TOOL_COACH,
  WELCOME_STEPS_ANALYST,
  WELCOME_STEPS_MARKETING,
} from "./tours";

interface OnboardingHostProps {
  sec: string;
}

// Singleton overlay that decides what onboarding surface, if any, to render
// for the current user + section. Mounted once at the top level of poast-client.
export function OnboardingHost({ sec }: OnboardingHostProps) {
  const { user } = useUser();
  const { hasSeen, markSeen, activeStep, setActiveStep } = useOnboarding();

  const analyst = isAnalyst(user);
  // Welcome is content-tailored per role. Analyst sees the four-tool intro;
  // marketing sees the suite-wide intro. We fire it for both roles on first
  // arrival now (was analyst-only — user wanted both).
  const welcomeSteps = analyst ? WELCOME_STEPS_ANALYST : WELCOME_STEPS_MARKETING;

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
          steps={welcomeSteps}
          onClose={() => { markSeen(STEP_WELCOME); setActiveStep(null); }}
          onComplete={() => { markSeen(STEP_WELCOME); setActiveStep(null); }}
        />
      </>
    );
  }

  if (activeStep === STEP_CHART2_DEEP) {
    return (
      <>
        {styleTag}
        <ChartMakerTour
          onClose={() => { markSeen(STEP_CHART2_DEEP); setActiveStep(null); }}
          onComplete={() => { markSeen(STEP_CHART2_DEEP); setActiveStep(null); }}
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

  // 2. Auto-detection. Need a user before anything fires.
  if (!user) return null;

  // Welcome takes priority over per-tool coach marks. New users see this
  // first regardless of which section they land on. Independent of role
  // since both analyst + marketing have suite-tailored welcome content.
  if (!hasSeen(STEP_WELCOME)) {
    return (
      <>
        {styleTag}
        <WelcomeModal
          steps={welcomeSteps}
          onClose={() => markSeen(STEP_WELCOME)}
          onComplete={() => markSeen(STEP_WELCOME)}
        />
      </>
    );
  }

  // Per-tool coach mark on first visit. Step ID derives from the current
  // sec — every entry in TOOL_COACH gets a one-paragraph intro on first
  // arrival, with a "Don't show again" affordance baked into the card.
  // Special case: Chart Maker 2's coach mark surfaces a "Take the tour"
  // button that launches the deep tour overlay.
  const toolStepId = "tool-" + sec;
  const toolContent = TOOL_COACH[sec];
  if (toolContent && !hasSeen(toolStepId)) {
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
          content={toolContent}
          onDismiss={() => markSeen(toolStepId)}
          onHidePermanent={() => markSeen(toolStepId)}
          primaryAction={primaryAction}
        />
      </>
    );
  }

  return null;
}
