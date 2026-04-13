import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { prompt, duration } = body;

    // ElevenLabs Sound Generation / Music API
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: prompt || "ambient tech background music, cinematic, minimal, dark tone",
        duration_seconds: duration || 30,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return NextResponse.json({
        error: "ElevenLabs music error: " + (err.detail?.message || err.detail || r.statusText),
        code: r.status,
      }, { status: r.status });
    }

    const buffer = await r.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return NextResponse.json({
      audio: "data:audio/mpeg;base64," + base64,
      size: buffer.byteLength,
      ts: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
