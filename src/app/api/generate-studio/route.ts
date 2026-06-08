import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { generateImagenImages, ImagenError } from "@/lib/imagen";
import { generateGrokImages, GrokImageError } from "@/lib/grok-image";
import { getProvider, type Provider } from "@/lib/generation-providers";

// Unified entry point for the Generate Studio. Dispatches to the right
// vendor library or vendor HTTP endpoint based on the provider id chosen
// by the UI. Returns a consistent envelope so the client can render
// results without branching on vendor.

interface GenerateBody {
  action: "generate" | "status";
  providerId: string;
  prompt?: string;
  knobs?: {
    aspectRatio?: string;
    quality?: string;
    duration?: number;
    count?: number;
    seed?: number;
    negativePrompt?: string;
    stylePreset?: string;
    personGeneration?: string;
    referenceImageDataUrl?: string;
  };
  taskId?: string;
}

const RUNWAY_VERSION = "2024-11-06";

async function runwayPost(path: string, key: string, payload: object) {
  return fetch(`https://api.dev.runwayml.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Runway-Version": RUNWAY_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function runwayPollTask(taskId: string, key: string) {
  return fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Runway-Version": RUNWAY_VERSION,
    },
  });
}

function getKlingToken(): string | null {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;
  if (!ak || !sk) return null;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 })).toString("base64url");
  const sig = crypto.createHmac("sha256", sk).update(header + "." + payload).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function envCheck(provider: Provider): string | null {
  for (const key of provider.envKeys) {
    if (!process.env[key]) return `${key} not configured`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const { action, providerId, prompt, knobs, taskId } = body;
  if (!action || !providerId) {
    return NextResponse.json({ error: "action + providerId required" }, { status: 400 });
  }

  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: `Unknown providerId: ${providerId}` }, { status: 400 });

  const envErr = envCheck(provider);
  if (envErr) return NextResponse.json({ error: envErr }, { status: 500 });

  try {
    if (action === "generate") {
      if (!prompt || !prompt.trim()) {
        return NextResponse.json({ error: "prompt required" }, { status: 400 });
      }

      // ─── IMAGE ────────────────────────────────────────
      if (provider.id === "imagen-3") {
        const images = await generateImagenImages({
          prompt,
          count: knobs?.count || 3,
          aspectRatio: (knobs?.aspectRatio || "1:1") as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        });
        return NextResponse.json({
          kind: "image",
          provider: provider.id,
          images: images.map((url) => ({ url })),
          ts: Date.now(),
        });
      }

      if (provider.id === "grok-image") {
        const images = await generateGrokImages({
          prompt,
          count: knobs?.count || 2,
        });
        return NextResponse.json({
          kind: "image",
          provider: provider.id,
          images: images.map((url) => ({ url })),
          ts: Date.now(),
        });
      }

      if (provider.id === "runway-image") {
        const key = process.env.RUNWAYML_API_SECRET!;
        const r = await runwayPost("/v1/text_to_image", key, {
          promptText: prompt,
          model: provider.modelId,
          ratio: knobs?.aspectRatio || "1024:1024",
          seed: knobs?.seed,
        });
        const data = await r.json();
        if (!r.ok || data.error) {
          return NextResponse.json({ error: `Runway image: ${data.error || data.message || r.statusText}` }, { status: r.status || 400 });
        }
        return NextResponse.json({
          kind: "image",
          provider: provider.id,
          task: { taskId: data.id, status: "processing", progress: 5 },
          ts: Date.now(),
        });
      }

      // ─── VIDEO ────────────────────────────────────────
      if (provider.id === "veo-3") {
        const apiKey = process.env.GEMINI_API_KEY!;
        const model = provider.modelId;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              aspectRatio: knobs?.aspectRatio || "16:9",
              durationSeconds: knobs?.duration || 8,
              personGeneration: knobs?.personGeneration || "allow_adult",
            },
          }),
        });
        const data = await r.json();
        if (!r.ok || data.error) {
          return NextResponse.json({ error: `Veo: ${data.error?.message || JSON.stringify(data.error) || r.statusText}` }, { status: r.status || 400 });
        }
        return NextResponse.json({
          kind: "video",
          provider: provider.id,
          task: { taskId: data.name, status: "processing", progress: 5 },
          ts: Date.now(),
        });
      }

      if (provider.id === "grok-video") {
        const xaiKey = process.env.XAI_API_KEY!;
        const r = await fetch("https://api.x.ai/v1/videos/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${xaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: provider.modelId, prompt }),
        });
        const data = await r.json();
        if (data.error) return NextResponse.json({ error: `Grok video: ${data.error.message || data.error}` }, { status: 400 });
        return NextResponse.json({
          kind: "video",
          provider: provider.id,
          task: { taskId: data.request_id, status: "processing", progress: 5 },
          ts: Date.now(),
        });
      }

      if (provider.id === "runway-video") {
        if (!knobs?.referenceImageDataUrl) {
          return NextResponse.json({ error: "Runway video needs a reference image (upload one or generate via Runway Gen-4 Image first)" }, { status: 400 });
        }
        const key = process.env.RUNWAYML_API_SECRET!;
        const r = await runwayPost("/v1/image_to_video", key, {
          promptImage: knobs.referenceImageDataUrl,
          promptText: prompt,
          model: provider.modelId,
          ratio: knobs?.aspectRatio || "1280:720",
          duration: knobs?.duration || 5,
          seed: knobs?.seed,
        });
        const data = await r.json();
        if (!r.ok || data.error) {
          return NextResponse.json({ error: `Runway video: ${data.error || data.message || r.statusText}` }, { status: r.status || 400 });
        }
        return NextResponse.json({
          kind: "video",
          provider: provider.id,
          task: { taskId: data.id, status: "processing", progress: 5 },
          ts: Date.now(),
        });
      }

      if (provider.id === "kling-v1") {
        const token = getKlingToken();
        if (!token) return NextResponse.json({ error: "KLING keys not configured" }, { status: 500 });
        const r = await fetch("https://api.klingai.com/v1/videos/text2video", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            duration: String(knobs?.duration || 5),
            aspect_ratio: knobs?.aspectRatio || "16:9",
            model: provider.modelId,
            negative_prompt: knobs?.negativePrompt || undefined,
          }),
        });
        const data = await r.json();
        if (data.code && data.code !== 0) {
          return NextResponse.json({ error: `Kling: ${data.message}`, code: data.code }, { status: 400 });
        }
        return NextResponse.json({
          kind: "video",
          provider: provider.id,
          task: { taskId: data.data?.task_id, status: data.data?.task_status || "processing", progress: 5 },
          ts: Date.now(),
        });
      }

      return NextResponse.json({ error: `Provider ${provider.id} not yet wired` }, { status: 501 });
    }

    if (action === "status") {
      if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

      if (provider.id === "veo-3") {
        const apiKey = process.env.GEMINI_API_KEY!;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${encodeURIComponent(taskId)}?key=${apiKey}`);
        const data = await r.json();
        if (!r.ok) return NextResponse.json({ error: `Veo status: ${data.error?.message || r.statusText}` }, { status: r.status });
        if (data.done) {
          type VeoVideo = { url?: string; bytesBase64Encoded?: string; mimeType?: string };
          const videos: VeoVideo[] =
            data.response?.generateVideoResponse?.generatedSamples ||
            data.response?.predictions ||
            [];
          const out = videos
            .map((v: VeoVideo) => {
              if (v.url) return { url: v.url };
              if (v.bytesBase64Encoded) return { url: `data:${v.mimeType || "video/mp4"};base64,${v.bytesBase64Encoded}` };
              return null;
            })
            .filter(Boolean) as { url: string }[];
          if (!out.length) return NextResponse.json({ task: { status: "failed", progress: 100 }, ts: Date.now() });
          return NextResponse.json({ task: { status: "succeeded", progress: 100, videos: out }, ts: Date.now() });
        }
        return NextResponse.json({ task: { status: "processing", progress: 50 }, ts: Date.now() });
      }

      if (provider.id === "grok-video") {
        const xaiKey = process.env.XAI_API_KEY!;
        const r = await fetch(`https://api.x.ai/v1/videos/${taskId}`, {
          headers: { Authorization: `Bearer ${xaiKey}` },
        });
        const data = await r.json();
        if (data.status === "done" && data.video) {
          return NextResponse.json({ task: { status: "succeeded", progress: 100, videos: [{ url: data.video.url }] }, ts: Date.now() });
        } else if (data.status === "failed") {
          return NextResponse.json({ task: { status: "failed", progress: 100 }, ts: Date.now() });
        }
        return NextResponse.json({ task: { status: "processing", progress: data.progress || 25 }, ts: Date.now() });
      }

      if (provider.id === "runway-image" || provider.id === "runway-video") {
        const key = process.env.RUNWAYML_API_SECRET!;
        const r = await runwayPollTask(taskId, key);
        const data = await r.json();
        if (!r.ok) return NextResponse.json({ error: `Runway status: ${data.error || data.message || r.statusText}` }, { status: r.status });
        const status = data.status as string;
        if (status === "SUCCEEDED") {
          const urls: string[] = data.output || [];
          const items = urls.map((url) => ({ url }));
          if (provider.kind === "image") {
            return NextResponse.json({ task: { status: "succeeded", progress: 100, images: items }, ts: Date.now() });
          }
          return NextResponse.json({ task: { status: "succeeded", progress: 100, videos: items }, ts: Date.now() });
        }
        if (status === "FAILED" || status === "CANCELLED") {
          return NextResponse.json({ task: { status: "failed", progress: 100, failure: data.failure || data.failureCode }, ts: Date.now() });
        }
        return NextResponse.json({ task: { status: "processing", progress: data.progress ? Math.round(data.progress * 100) : 35 }, ts: Date.now() });
      }

      if (provider.id === "kling-v1") {
        const token = getKlingToken();
        if (!token) return NextResponse.json({ error: "KLING keys not configured" }, { status: 500 });
        const r = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        const status = data.data?.task_status || "processing";
        if (status === "succeed") {
          const videos = (data.data?.task_result?.videos || []).map((v: { url: string }) => ({ url: v.url }));
          return NextResponse.json({ task: { status: "succeeded", progress: 100, videos }, ts: Date.now() });
        }
        if (status === "failed") {
          return NextResponse.json({ task: { status: "failed", progress: 100 }, ts: Date.now() });
        }
        return NextResponse.json({ task: { status: "processing", progress: data.data?.progress || 40 }, ts: Date.now() });
      }

      return NextResponse.json({ error: `Provider ${provider.id} does not support polling` }, { status: 400 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof ImagenError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof GrokImageError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
