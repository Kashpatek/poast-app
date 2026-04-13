import { NextRequest, NextResponse } from "next/server";

const BUFFER_API = "https://api.bufferapp.com/1";

function getToken() {
  return process.env.BUFFER_ACCESS_TOKEN || "";
}

// Get all profiles
async function getProfiles(token: string) {
  const r = await fetch(`${BUFFER_API}/profiles.json?access_token=${token}`);
  return r.json();
}

// Get pending (scheduled) updates for a profile
async function getPending(token: string, profileId: string) {
  const r = await fetch(`${BUFFER_API}/profiles/${profileId}/updates/pending.json?access_token=${token}&count=25`);
  return r.json();
}

// Get sent updates for a profile
async function getSent(token: string, profileId: string) {
  const r = await fetch(`${BUFFER_API}/profiles/${profileId}/updates/sent.json?access_token=${token}&count=25`);
  return r.json();
}

// Get analytics for a profile
async function getAnalytics(token: string, profileId: string) {
  // Buffer v1 doesn't have a dedicated analytics endpoint,
  // but sent updates contain engagement metrics
  const sent = await getSent(token, profileId);
  const updates = sent?.updates || [];
  let totalClicks = 0, totalReach = 0, totalLikes = 0, totalShares = 0, totalComments = 0;
  for (const u of updates) {
    const s = u.statistics || {};
    totalClicks += s.clicks || 0;
    totalReach += s.reach || s.impressions || 0;
    totalLikes += s.likes || s.favorites || 0;
    totalShares += s.shares || s.retweets || s.repins || 0;
    totalComments += s.comments || s.replies || 0;
  }
  return {
    posts: updates.length,
    clicks: totalClicks,
    reach: totalReach,
    likes: totalLikes,
    shares: totalShares,
    comments: totalComments,
  };
}

export async function GET(req: NextRequest) {
  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "BUFFER_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  const type = req.nextUrl.searchParams.get("type");

  try {
    if (type === "profiles") {
      const profiles = await getProfiles(token);
      return NextResponse.json({ profiles, ts: Date.now() });
    }

    // Default: get all profiles with their pending posts and stats
    const profiles = await getProfiles(token);
    if (!Array.isArray(profiles)) {
      return NextResponse.json({ error: "Failed to fetch profiles", detail: profiles }, { status: 500 });
    }

    const results = await Promise.allSettled(
      profiles.map(async (p: { id: string; service: string; formatted_username: string; avatar_https: string }) => {
        const [pending, analytics] = await Promise.all([
          getPending(token, p.id),
          getAnalytics(token, p.id),
        ]);
        return {
          id: p.id,
          service: p.service,
          username: p.formatted_username,
          avatar: p.avatar_https,
          pending: (pending?.updates || []).map((u: { id: string; text: string; due_at: number; day: string; due_time: string }) => ({
            id: u.id,
            text: u.text,
            due_at: u.due_at,
            day: u.day,
            time: u.due_time,
          })),
          analytics,
        };
      })
    );

    const data = results
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<unknown>).value);

    return NextResponse.json({ profiles: data, ts: Date.now() });
  } catch (error) {
    console.error("Buffer API error:", error);
    return NextResponse.json({ error: "Buffer API failed" }, { status: 500 });
  }
}
