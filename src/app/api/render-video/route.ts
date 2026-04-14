import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// Triggers a GitHub Actions workflow to render the video
export async function POST(req: NextRequest) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const renderId = "r" + Date.now().toString(36);

    // Trigger repository_dispatch event
    const r = await fetch("https://api.github.com/repos/Kashpatek/poast-app/dispatches", {
      method: "POST",
      headers: {
        "Authorization": "token " + pat,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "render-video",
        client_payload: {
          renderId: renderId,
          props: body,
        },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: "GitHub dispatch failed: " + err }, { status: r.status });
    }

    return NextResponse.json({
      renderId: renderId,
      status: "dispatched",
      message: "Render job submitted to GitHub Actions. Check progress at github.com/Kashpatek/poast-app/actions",
      checkUrl: "https://github.com/Kashpatek/poast-app/actions",
      ts: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Check render status by looking at workflow runs AND the release
export async function GET(req: NextRequest) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });

  const renderId = req.nextUrl.searchParams.get("id");
  if (!renderId) return NextResponse.json({ error: "No render ID" }, { status: 400 });

  const ghHeaders = { "Authorization": "token " + pat, "Accept": "application/vnd.github.v3+json" };

  try {
    // Check for finished release first (fastest path to "complete")
    const releaseRes = await fetch(
      "https://api.github.com/repos/Kashpatek/poast-app/releases/tags/render-" + renderId,
      { headers: ghHeaders }
    );

    if (releaseRes.ok) {
      const release = await releaseRes.json();
      const assets = (release.assets || []).map((a: { name: string; browser_download_url: string; size: number }) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
      }));
      return NextResponse.json({ status: "complete", runStatus: "complete", assets, ts: Date.now() });
    }

    // No release yet -- check workflow run status for progressive feedback
    const runsRes = await fetch(
      "https://api.github.com/repos/Kashpatek/poast-app/actions/runs?event=repository_dispatch&per_page=10",
      { headers: ghHeaders }
    );

    let runStatus = "queued" as string;
    let runConclusion = null as string | null;
    let runUrl = "" as string;
    let runStarted = "" as string;
    let progressPct = -1;

    if (runsRes.ok) {
      const runsData = await runsRes.json();
      const runs = runsData.workflow_runs || [];

      // Try to find the run matching our renderId by checking run names or timing
      // repository_dispatch runs carry the renderId in the client_payload, which shows
      // up in the run's "display_title" or we match by the most recent dispatch run
      let matchedRun = null as any;
      for (const run of runs) {
        // GitHub sets display_title from event_type or workflow name -- check if renderId appears
        if (run.display_title && run.display_title.indexOf(renderId) !== -1) {
          matchedRun = run;
          break;
        }
      }
      // Fallback: use the most recent repository_dispatch run if no exact match
      if (!matchedRun && runs.length > 0) {
        matchedRun = runs[0];
      }

      if (matchedRun) {
        runUrl = matchedRun.html_url || "";
        runStarted = matchedRun.run_started_at || matchedRun.created_at || "";
        runConclusion = matchedRun.conclusion || null;

        if (matchedRun.status === "queued" || matchedRun.status === "waiting" || matchedRun.status === "pending") {
          runStatus = "queued";
        } else if (matchedRun.status === "in_progress") {
          runStatus = "in_progress";

          // Try to fetch job steps for progress estimation
          if (matchedRun.jobs_url) {
            try {
              const jobsRes = await fetch(matchedRun.jobs_url, { headers: ghHeaders });
              if (jobsRes.ok) {
                const jobsData = await jobsRes.json();
                const jobs = jobsData.jobs || [];
                let totalSteps = 0;
                let completedSteps = 0;
                for (const job of jobs) {
                  const steps = job.steps || [];
                  totalSteps += steps.length;
                  for (const step of steps) {
                    if (step.status === "completed") completedSteps++;
                  }
                }
                if (totalSteps > 0) {
                  progressPct = Math.round((completedSteps / totalSteps) * 100);
                }
              }
            } catch (_e) { /* non-critical */ }
          }
        } else if (matchedRun.status === "completed") {
          if (matchedRun.conclusion === "success") {
            // Workflow done but release not yet published -- uploading phase
            runStatus = "uploading";
          } else {
            runStatus = "failure";
          }
        }
      }
    }

    return NextResponse.json({
      status: runStatus === "failure" ? "failure" : "rendering",
      runStatus,
      runConclusion,
      runUrl,
      runStarted,
      progressPct,
      message: runStatus === "queued" ? "Workflow queued, waiting for runner..."
        : runStatus === "in_progress" ? (progressPct >= 0 ? "Rendering " + progressPct + "%" : "Rendering in progress...")
        : runStatus === "uploading" ? "Render complete, uploading release..."
        : runStatus === "failure" ? "Workflow failed: " + (runConclusion || "unknown error")
        : "Waiting for workflow...",
      ts: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
