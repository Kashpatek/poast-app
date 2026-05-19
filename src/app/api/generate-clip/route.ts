import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// ═══ KLING AUTH ═══
function getKlingToken() {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;
  if (!ak || !sk) return null;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 })).toString("base64url");
  const sig = crypto.createHmac("sha256", sk).update(header + "." + payload).digest("base64url");
  return header + "." + payload + "." + sig;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, engine } = body;

    // ═══ VEO (Google) ═══
    if (engine === "veo") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
      const model = process.env.VEO_MODEL || "veo-3.0-generate-001";

      if (action === "generate") {
        // Veo uses a long-running operation: start returns an operation name we poll.
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: body.prompt }],
            parameters: {
              aspectRatio: body.aspectRatio || "16:9",
              durationSeconds: Number(body.duration) || 8,
              personGeneration: "allow_adult",
            },
          }),
        });
        const data = await r.json();
        if (!r.ok || data.error) return NextResponse.json({ error: "Veo: " + (data.error?.message || JSON.stringify(data.error) || r.statusText) }, { status: r.status || 400 });
        // `name` is the operation handle; we use it as task_id.
        return NextResponse.json({ task: { task_id: data.name, provider: "veo" }, ts: Date.now() });
      }

      if (action === "status") {
        // Poll the long-running operation by its name.
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(body.taskId)}?key=${apiKey}`);
        const data = await r.json();
        if (!r.ok) return NextResponse.json({ error: "Veo status: " + (data.error?.message || r.statusText) }, { status: r.status });
        if (data.done) {
          const videos: Array<{ url?: string; bytesBase64Encoded?: string; mimeType?: string }> = data.response?.generateVideoResponse?.generatedSamples || data.response?.predictions || [];
          const out = videos.map((v) => {
            if (v.url) return { url: v.url };
            if (v.bytesBase64Encoded) return { url: `data:${v.mimeType || "video/mp4"};base64,${v.bytesBase64Encoded}` };
            return null;
          }).filter(Boolean);
          if (!out.length) return NextResponse.json({ task: { task_status: "failed", provider: "veo" }, ts: Date.now() });
          return NextResponse.json({ task: { task_status: "succeed", task_result: { videos: out }, progress: 100, provider: "veo" }, ts: Date.now() });
        }
        return NextResponse.json({ task: { task_status: "processing", progress: 50, provider: "veo" }, ts: Date.now() });
      }
    }

    const useGrok = engine === "grok" || !process.env.KLING_ACCESS_KEY;

    // ═══ GROK VIDEO ═══
    if (useGrok) {
      const xaiKey = process.env.XAI_API_KEY;
      if (!xaiKey) return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 });

      if (action === "generate") {
        const r = await fetch("https://api.x.ai/v1/videos/generations", {
          method: "POST",
          headers: { "Authorization": "Bearer " + xaiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "grok-imagine-video", prompt: body.prompt }),
        });
        const data = await r.json();
        if (data.error) return NextResponse.json({ error: "Grok error: " + (data.error.message || data.error) }, { status: 400 });
        return NextResponse.json({ task: { task_id: data.request_id, provider: "grok" }, ts: Date.now() });
      }

      if (action === "status") {
        const r = await fetch("https://api.x.ai/v1/videos/" + body.taskId, {
          headers: { "Authorization": "Bearer " + xaiKey },
        });
        const data = await r.json();
        if (data.status === "done" && data.video) {
          return NextResponse.json({ task: { task_status: "succeed", task_result: { videos: [{ url: data.video.url }] }, progress: 100, provider: "grok" }, ts: Date.now() });
        } else if (data.status === "failed") {
          return NextResponse.json({ task: { task_status: "failed", provider: "grok" }, ts: Date.now() });
        } else {
          return NextResponse.json({ task: { task_status: "processing", progress: data.progress || 0, provider: "grok" }, ts: Date.now() });
        }
      }
    }

    // ═══ KLING VIDEO ═══
    const token = getKlingToken();
    if (!token) return NextResponse.json({ error: "KLING keys not configured" }, { status: 500 });

    if (action === "generate") {
      const r = await fetch("https://api.klingai.com/v1/videos/text2video", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: body.prompt, duration: body.duration || "5", aspect_ratio: body.aspectRatio || "16:9", model: "kling-v1" }),
      });
      const data = await r.json();
      if (data.code && data.code !== 0) return NextResponse.json({ error: "Kling: " + data.message, code: data.code }, { status: 400 });
      return NextResponse.json({ task: { ...data.data, provider: "kling" }, ts: Date.now() });
    }

    if (action === "status") {
      const r = await fetch("https://api.klingai.com/v1/videos/text2video/" + body.taskId, {
        headers: { "Authorization": "Bearer " + token },
      });
      const data = await r.json();
      return NextResponse.json({ task: { ...data.data, provider: "kling" }, ts: Date.now() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ═══ GROK IMAGE GENERATION ═══
export async function GET(req: NextRequest) {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 });

  const prompt = req.nextUrl.searchParams.get("prompt");
  if (!prompt) return NextResponse.json({ error: "No prompt" }, { status: 400 });

  try {
    const r = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": "Bearer " + xaiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "grok-imagine-image", prompt: prompt, n: 1 }),
    });
    const data = await r.json();
    const images = (data.data || []).map((i: { url?: string; b64_json?: string }) => i.url || ("data:image/png;base64," + i.b64_json));
    return NextResponse.json({ images, ts: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
