import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";

const BUFFER_API = "https://api.buffer.com";

// Simple cache to avoid rate limits (60s TTL)
let _cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 60000;

function getToken() {
  return process.env.BUFFER_API_KEY || "";
}

class BufferRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("Buffer rate limit exceeded");
    this.retryAfter = retryAfter;
  }
}

async function gql(query: string, variables?: Record<string, unknown>) {
  const token = getToken();
  if (!token) throw new Error("BUFFER_API_KEY not set");
  const r = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ query, variables }),
  });
  // Buffer publishes rate limits as of 2026; on 429 they include a
  // Retry-After header AND a `retryAfter` field on the body. Surface
  // both up so callers can back off cleanly.
  if (r.status === 429) {
    const retryHeader = Number(r.headers.get("Retry-After")) || 0;
    let retryBody = 0;
    try { const j = await r.json(); retryBody = Number(j?.retryAfter || 0); } catch { /* ignore */ }
    throw new BufferRateLimitError(Math.max(retryHeader, retryBody, 1));
  }
  const data = await r.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "GraphQL error");
  return data.data;
}

// ─── Asset shape migration (May 2026) ─────────────────────────────
// Buffer hard-removed the legacy single `media: { url }` shape on
// May 25, 2026. The new schema is `assets: [AssetInput!]` where each
// AssetInput is a discriminated union (image|video|document|link).
// This shim accepts the old shape from callers and converts so we
// can migrate UI surfaces incrementally without breaking createPost.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePostInput(input: any): any {
  if (!input || typeof input !== "object") return input;
  const out = { ...input };
  // Legacy `media: { url, type? }` → `assets: [{ image|video: { url } }]`
  if (out.media && !out.assets) {
    const m = out.media as { url?: string; type?: string; thumbnailUrl?: string };
    if (m.url) {
      const variant = m.type === "video" ? "video" : "image";
      out.assets = [{ [variant]: { url: m.url, ...(m.thumbnailUrl ? { thumbnailUrl: m.thumbnailUrl } : {}) } }];
    }
    delete out.media;
  }
  // Legacy `status: "draft"` was an older alias; current schema uses
  // `schedulingType: "draft"`. Map only if status is set without one.
  if (out.status && !out.schedulingType) {
    out.schedulingType = out.status;
    delete out.status;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const token = getToken();
  if (!token) return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });

  const type = req.nextUrl.searchParams.get("type");

  try {
    log.info("Buffer GET request", { type: type || "all" });
    // Get org ID first
    const acct = await gql(`query { account { organizations { id } } }`);
    const orgId = acct?.account?.organizations?.[0]?.id;
    if (!orgId) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    if (type === "channels") {
      const data = await gql(`query($input: ChannelsInput!) {
        channels(input: $input) { id name service timezone avatar isDisconnected }
      }`, { input: { organizationId: orgId } });
      return NextResponse.json({ channels: data?.channels || [], ts: Date.now() });
    }

    if (type === "scheduled") {
      const data = await gql(`query($input: PostsInput!, $first: Int) {
        posts(input: $input, first: $first) { edges { node {
          id text status dueAt createdAt channelService
          channel { id name service }
          tags { id name color }
          notes { id text createdAt author { name } }
        } } }
      }`, { input: { organizationId: orgId, filter: { status: ["scheduled"] } }, first: 50 });
      return NextResponse.json({ posts: (data?.posts?.edges || []).map((e: { node: unknown }) => e.node), ts: Date.now() });
    }

    if (type === "sent") {
      const data = await gql(`query($input: PostsInput!, $first: Int) {
        posts(input: $input, first: $first) { edges { node {
          id text status dueAt sentAt createdAt channelService
          channel { id name service }
          tags { id name color }
        } } }
      }`, { input: { organizationId: orgId, filter: { status: ["sent"] } }, first: 50 });
      return NextResponse.json({ posts: (data?.posts?.edges || []).map((e: { node: unknown }) => e.node), ts: Date.now() });
    }

    if (type === "drafts") {
      const data = await gql(`query($input: PostsInput!, $first: Int) {
        posts(input: $input, first: $first) { edges { node {
          id text status dueAt createdAt channelService
          channel { id name service }
          tags { id name color }
        } } }
      }`, { input: { organizationId: orgId, filter: { status: ["draft"] } }, first: 50 });
      return NextResponse.json({ posts: (data?.posts?.edges || []).map((e: { node: unknown }) => e.node), ts: Date.now() });
    }

    if (type === "limits") {
      const data = await gql(`query($input: DailyPostingLimitsInput!) {
        dailyPostingLimits(input: $input) { channel { id name service } limit used }
      }`, { input: { organizationId: orgId } });
      return NextResponse.json({ limits: data?.dailyPostingLimits || [], ts: Date.now() });
    }

    // Return cached response if fresh (avoids rate limits)
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
      return NextResponse.json(_cache.data);
    }

    // Default: everything (sequential to avoid rate limits)
    const channels = await gql(`query($input: ChannelsInput!) { channels(input: $input) { id name service timezone avatar isDisconnected } }`, { input: { organizationId: orgId } });
    const scheduled = await gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt createdAt channelService channel { id name service } tags { id name color } } } } }`, { input: { organizationId: orgId, filter: { status: ["scheduled"] } }, first: 50 });
    const sent = await gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt sentAt createdAt channelService channel { id name service } tags { id name color } } } } }`, { input: { organizationId: orgId, filter: { status: ["sent"] } }, first: 50 });
    const drafts = await gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt createdAt channelService channel { id name service } tags { id name color } } } } }`, { input: { organizationId: orgId, filter: { status: ["draft"] } }, first: 30 });

    const result = {
      orgId,
      channels: channels?.channels || [],
      scheduled: (scheduled?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      sent: (sent?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      drafts: (drafts?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      ts: Date.now(),
    };
    _cache = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BufferRateLimitError) {
      log.warn("Buffer rate limit hit", { type: type || "all", retryAfter: error.retryAfter });
      return NextResponse.json(
        { error: "Buffer rate limit exceeded", retryAfter: error.retryAfter },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } }
      );
    }
    log.error("Buffer API error", { error: String(error), type: type || "all" });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = getToken();
  if (!token) return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action } = body;
    log.info("Buffer POST request", { action });

    if (action === "createPost") {
      const data = await gql(`mutation($input: CreatePostInput!) {
        createPost(input: $input) { post { id text status dueAt channel { name service } } }
      }`, { input: normalizePostInput(body.input) });
      _cache = null;
      log.info("Buffer cache invalidated", { action });
      return NextResponse.json({ post: data?.createPost?.post, ts: Date.now() });
    }

    if (action === "editPost") {
      // Optional: omit `assets` to preserve existing media; pass [] to clear.
      const data = await gql(`mutation($input: EditPostInput!) {
        editPost(input: $input) { post { id text status dueAt channel { name service } } }
      }`, { input: normalizePostInput(body.input) });
      _cache = null;
      log.info("Buffer cache invalidated", { action });
      return NextResponse.json({ post: data?.editPost?.post, ts: Date.now() });
    }

    if (action === "deletePost") {
      await gql(`mutation($input: DeletePostInput!) { deletePost(input: $input) { id } }`, { input: { postId: body.postId } });
      _cache = null;
      log.info("Buffer cache invalidated", { action });
      return NextResponse.json({ ok: true, ts: Date.now() });
    }

    if (action === "createIdea") {
      const acct = await gql(`query { account { organizations { id } } }`);
      const orgId = acct?.account?.organizations?.[0]?.id;
      const data = await gql(`mutation($input: CreateIdeaInput!) {
        createIdea(input: $input) { id }
      }`, { input: { organizationId: orgId, content: body.content } });
      _cache = null;
      log.info("Buffer cache invalidated", { action });
      return NextResponse.json({ idea: data?.createIdea, ts: Date.now() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof BufferRateLimitError) {
      log.warn("Buffer rate limit hit", { retryAfter: error.retryAfter });
      return NextResponse.json(
        { error: "Buffer rate limit exceeded", retryAfter: error.retryAfter },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } }
      );
    }
    log.error("Buffer mutation error", { error: String(error) });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
