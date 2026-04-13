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

// Check render status by looking for the release
export async function GET(req: NextRequest) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });

  const renderId = req.nextUrl.searchParams.get("id");
  if (!renderId) return NextResponse.json({ error: "No render ID" }, { status: 400 });

  try {
    const r = await fetch("https://api.github.com/repos/Kashpatek/poast-app/releases/tags/render-" + renderId, {
      headers: { "Authorization": "token " + pat, "Accept": "application/vnd.github.v3+json" },
    });

    if (r.status === 404) {
      return NextResponse.json({ status: "rendering", message: "Still rendering..." });
    }

    const release = await r.json();
    const assets = (release.assets || []).map((a: { name: string; browser_download_url: string; size: number }) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
    }));

    return NextResponse.json({ status: "complete", assets, ts: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
