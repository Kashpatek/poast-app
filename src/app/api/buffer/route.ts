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
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 30 },
  });

  const data = await r.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "GraphQL error");
  return data.data;
}

export async function GET(req: NextRequest) {
  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });
  }

  const type = req.nextUrl.searchParams.get("type");

  try {
    if (type === "channels") {
      // First get org ID
      const acct = await gql(`query { account { organizations { id } } }`);
      const orgId = acct?.account?.organizations?.[0]?.id;
      if (!orgId) return NextResponse.json({ error: "No organization found" }, { status: 404 });

      const data = await gql(`query GetChannels($input: ChannelsInput!) {
        channels(input: $input) { id name service timezone avatar isDisconnected }
      }`, { input: { organizationId: orgId } });

      return NextResponse.json({ channels: data?.channels || [], ts: Date.now() });
    }

    if (type === "posts") {
      const acct = await gql(`query { account { organizations { id } } }`);
      const orgId = acct?.account?.organizations?.[0]?.id;
      if (!orgId) return NextResponse.json({ error: "No organization found" }, { status: 404 });

      const filter = req.nextUrl.searchParams.get("filter") || "scheduled";
      const data = await gql(`query GetPosts($input: PostsInput!, $first: Int) {
        posts(input: $input, first: $first) {
          edges {
            node {
              id text status dueAt createdAt
              channel { id name service }
              tags { id name color }
            }
          }
        }
      }`, { input: { organizationId: orgId, filter: filter }, first: 50 });

      const posts = (data?.posts?.edges || []).map((e: { node: unknown }) => e.node);
      return NextResponse.json({ posts, ts: Date.now() });
    }

    // Default: get everything (org, channels, scheduled + sent posts)
    const acct = await gql(`query { account { organizations { id } } }`);
    const orgId = acct?.account?.organizations?.[0]?.id;
    if (!orgId) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const [channels, scheduled, sent] = await Promise.all([
      gql(`query($input: ChannelsInput!) { channels(input: $input) { id name service timezone avatar } }`, { input: { organizationId: orgId } }),
      gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt channel { name service } tags { name color } } } } }`, { input: { organizationId: orgId, filter: "scheduled" }, first: 30 }),
      gql(`query($input: PostsInput!, $first: Int) { posts(input: $input, first: $first) { edges { node { id text status dueAt createdAt channel { name service } tags { name color } } } } }`, { input: { organizationId: orgId, filter: "sent" }, first: 30 }),
    ]);

    return NextResponse.json({
      orgId,
      channels: channels?.channels || [],
      scheduled: (scheduled?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      sent: (sent?.posts?.edges || []).map((e: { node: unknown }) => e.node),
      ts: Date.now(),
    });
  } catch (error) {
    console.error("Buffer API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Create a post
export async function POST(req: NextRequest) {
  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "BUFFER_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { channelId, text, dueAt, tagIds } = body;

    const data = await gql(`mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) { id text status dueAt }
    }`, {
      input: {
        channelId,
        text,
        dueAt: dueAt || undefined,
        schedulingType: dueAt ? "scheduled" : "now",
        tagIds: tagIds || [],
      },
    });

    return NextResponse.json({ post: data?.createPost, ts: Date.now() });
  } catch (error) {
    console.error("Buffer create post error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
