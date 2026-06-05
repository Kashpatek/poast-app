"use client";

import { useState } from "react";
import IntelligenceSuiteShell, { DateRange, LayoutMode } from "./shell";
import SignalFeedPanel from "./signal-feed";
import StoryRadarPanel from "./story-radar";
import IdeationBoardPanel from "./ideation-board";
import MorningBrief from "./morning-brief";
import WatchlistAlertsPanel from "./watchlist-alerts";
import CompetitiveRadarPanel from "./competitive-radar";

// Default landing for /intelligence-suite. Mounts the 4 sub-panels
// inside the shell. The "Generate Morning Brief" toolbar button bumps
// a counter that the MorningBrief panel reads as a refresh trigger —
// the panel owns its own state and fetching logic.
export default function HubLanding() {
  const [range, setRange] = useState<DateRange>("7d");
  const [layout, setLayout] = useState<LayoutMode>("focus");
  const [briefTick, setBriefTick] = useState(0);

  return (
    <IntelligenceSuiteShell
      dateRange={range}
      onDateRangeChange={setRange}
      layoutMode={layout}
      onLayoutModeChange={setLayout}
      onGenerateBrief={function () { setBriefTick(function (n) { return n + 1; }); }}
      morningBrief={<MorningBrief />}
      signalFeed={<SignalFeedPanel />}
      storyRadar={<StoryRadarPanel />}
      ideationBoard={<IdeationBoardPanel />}
      watchlist={<WatchlistAlertsPanel />}
      competitive={<CompetitiveRadarPanel />}
    />
  );
}
