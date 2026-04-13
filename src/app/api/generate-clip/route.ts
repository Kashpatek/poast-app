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

      // Grok video polling not yet documented -- return pending
      if (action === "status") {
        return NextResponse.json({ task: { task_status: "processing", provider: "grok" }, ts: Date.now() });
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
