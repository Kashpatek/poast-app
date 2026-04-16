import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { log } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, filename, contentType } = body;

    if (!data || !filename) {
      return NextResponse.json({ error: "Missing data or filename" }, { status: 400 });
    }

    // Convert base64 data URL to buffer
    const base64 = data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: contentType || "audio/mpeg",
    });

    return NextResponse.json({
      url: blob.url,
      size: buffer.length,
      ts: Date.now(),
    });
  } catch (error) {
    log.error("upload-asset error", { error: String(error) });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
