import { NextRequest, NextResponse } from "next/server";
import { generateImagenImages, ImagenError } from "@/lib/imagen";
import { generateGrokImages, GrokImageError } from "@/lib/grok-image";
import { getProvider, getActiveModel, type Provider } from "@/lib/generation-providers";

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
    firstFrameDataUrl?: string;
    lastFrameDataUrl?: string;
    modelId?: string;
  };
  taskId?: string;
}

function dataUrlToInline(dataUrl?: string): { bytesBase64Encoded: string; mimeType: string } | null {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], bytesBase64Encoded: match[2] };
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
          model: getActiveModel(provider, knobs || {}).modelId,
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
        const model = getActiveModel(provider, knobs || {}).modelId;
        const firstFrame = dataUrlToInline(knobs?.firstFrameDataUrl);
        const instance: { prompt: string; image?: { bytesBase64Encoded: string; mimeType: string } } = { prompt };
        if (firstFrame) instance.image = firstFrame;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [instance],
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
          body: JSON.stringify({ model: getActiveModel(provider, knobs || {}).modelId, prompt }),
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
        const firstFrame = knobs?.firstFrameDataUrl || knobs?.referenceImageDataUrl;
        if (!firstFrame) {
          return NextResponse.json({ error: "Runway video needs a first frame (upload one or generate via Runway Gen-4 Image first)" }, { status: 400 });
        }
        const key = process.env.RUNWAYML_API_SECRET!;
        // Runway image_to_video accepts a single image (string) or
        // [{uri, position}] for first+last-frame interpolation.
        const promptImage = knobs?.lastFrameDataUrl
          ? [
              { uri: firstFrame, position: "first" },
              { uri: knobs.lastFrameDataUrl, position: "last" },
            ]
          : firstFrame;
        const r = await runwayPost("/v1/image_to_video", key, {
          promptImage,
          promptText: prompt,
          model: getActiveModel(provider, knobs || {}).modelId,
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

      return NextResponse.json({ error: `Provider ${provider.id} does not support polling` }, { status: 400 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof ImagenError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof GrokImageError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
