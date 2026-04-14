import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get("paperId");

  if (!paperId) {
    return NextResponse.json({ error: "paperId is required" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://arxiv.lol/${paperId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SlopTop/1.0)",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ ready: false, title: null });
    }

    const html = await response.text();

    // Check if the page has actual meme content vs just the default "Live arXiv Feed" page
    // A generated page typically has the paper title and generated content
    const hasContent =
      html.includes("<article") ||
      html.includes("paper-content") ||
      html.includes("meme-container") ||
      (html.includes(paperId) &&
        !html.includes("Live arXiv Feed") &&
        html.length > 5000);

    // Try to extract a title from the page
    let title: string | null = null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const rawTitle = titleMatch[1].trim();
      // Filter out generic titles
      if (
        rawTitle &&
        rawTitle !== "arxiv.lol" &&
        !rawTitle.includes("Live arXiv Feed")
      ) {
        title = rawTitle;
      }
    }

    // Also try og:title
    if (!title) {
      const ogMatch = html.match(
        /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i
      );
      if (ogMatch && ogMatch[1]) {
        title = ogMatch[1].trim();
      }
    }

    return NextResponse.json({
      ready: hasContent,
      title: title,
    });
  } catch (error) {
    return NextResponse.json({ ready: false, title: null });
  }
}
