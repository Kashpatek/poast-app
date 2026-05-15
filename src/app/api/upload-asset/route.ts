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

    // Upload to Vercel Blob. addRandomSuffix prevents the "blob already
    // exists" error when two uploads share a filename (common when users
    // drag the same screenshot twice, or when generators emit
    // edit-<timestamp>.png with low timestamp resolution).
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: contentType || "application/octet-stream",
      addRandomSuffix: true,
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
