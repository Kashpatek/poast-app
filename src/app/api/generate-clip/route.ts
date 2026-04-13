import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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

// Submit a text-to-video generation task
export async function POST(req: NextRequest) {
  const token = getKlingToken();
  if (!token) return NextResponse.json({ error: "KLING_ACCESS_KEY / KLING_SECRET_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "generate") {
      const { prompt, duration, aspectRatio } = body;
      const r = await fetch("https://api.klingai.com/v1/videos/text2video", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          duration: duration || "5",
          aspect_ratio: aspectRatio || "16:9",
          model: "kling-v1",
        }),
      });
      const data = await r.json();
      if (data.code && data.code !== 0) {
        return NextResponse.json({ error: "Kling error: " + data.message, code: data.code }, { status: 400 });
      }
      return NextResponse.json({ task: data.data, ts: Date.now() });
    }

    if (action === "status") {
      const { taskId } = body;
      const r = await fetch("https://api.klingai.com/v1/videos/text2video/" + taskId, {
        headers: { "Authorization": "Bearer " + token },
      });
      const data = await r.json();
      return NextResponse.json({ task: data.data, ts: Date.now() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
