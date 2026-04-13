import { NextRequest, NextResponse } from "next/server";

const BUFFER_API = "https://api.buffer.com";

function getToken() {
  return process.env.BUFFER_API_KEY || "";
}

async function gql(query: string, variables?: Record<string, unknown>) {
  const token = getToken();
  if (!token) throw new Error("BUFFER_API_KEY not set");
  const r = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ query, variables }),
  });
  const data = await r.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "GraphQL error");
  return data.data;
}

export async function GET(req: NextRequest) {
  const token = getToken();
  if (!token) return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });

  const type = req.nextUrl.searchParams.get("type");

  try {
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

    // Default: everything
    const [channels, scheduled, sent, drafts] = await Promise.all([
      gql(`query($input: ChannelsInput!) { channels(input: $input) { id name service timezone avatar isDisconnected } }`, { input: { organizationId: orgId } }),
      gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt createdAt channelService channel { id name service } tags { id name color } } } } }`, { input: { organizationId: orgId, filter: { status: ["scheduled"] } }, first: 50 }),
      gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt sentAt createdAt channelService channel { id name service } tags { id name color } } } } }`, { input: { organizationId: orgId, filter: { status: ["sent"] } }, first: 50 }),
      gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt createdAt channelService channel { id name service } tags { id name color } } } } }`, { input: { organizationId: orgId, filter: { status: ["draft"] } }, first: 30 }),
    ]);

    return NextResponse.json({
      orgId,
      channels: channels?.channels || [],
      scheduled: (scheduled?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      sent: (sent?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      drafts: (drafts?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      ts: Date.now(),
    });
  } catch (error) {
    console.error("Buffer API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = getToken();
  if (!token) return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "createPost") {
      const data = await gql(`mutation($input: CreatePostInput!) {
        createPost(input: $input) { id text status dueAt channel { name service } }
      }`, { input: body.input });
      return NextResponse.json({ post: data?.createPost, ts: Date.now() });
    }

    if (action === "deletePost") {
      await gql(`mutation($input: DeletePostInput!) { deletePost(input: $input) { id } }`, { input: { postId: body.postId } });
      return NextResponse.json({ ok: true, ts: Date.now() });
    }

    if (action === "createIdea") {
      const acct = await gql(`query { account { organizations { id } } }`);
      const orgId = acct?.account?.organizations?.[0]?.id;
      const data = await gql(`mutation($input: CreateIdeaInput!) {
        createIdea(input: $input) { id }
      }`, { input: { organizationId: orgId, content: body.content } });
      return NextResponse.json({ idea: data?.createIdea, ts: Date.now() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Buffer mutation error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
