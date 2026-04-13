import { NextRequest, NextResponse } from "next/server";

const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George

export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
    });
    const data = await r.json();
    const voices = (data.voices || []).map((v: { voice_id: string; name: string; labels?: Record<string, string> }) => ({
      id: v.voice_id,
      name: v.name,
      labels: v.labels || {},
    }));
    return NextResponse.json({ voices, ts: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { text, voiceId } = body;
    const vid = voiceId || DEFAULT_VOICE;

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return NextResponse.json({ error: "ElevenLabs error: " + (err.detail?.message || r.statusText) }, { status: r.status });
    }

    // Return audio as base64
    const buffer = await r.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return NextResponse.json({
      audio: "data:audio/mpeg;base64," + base64,
      ts: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
