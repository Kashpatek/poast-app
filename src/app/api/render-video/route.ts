import { NextResponse } from "next/server";

export const maxDuration = 300;

// Server-side rendering requires Remotion Lambda or a dedicated render server.
// For now, video preview + export is handled client-side via @remotion/player.
// This route serves as a placeholder for future Lambda integration.

export async function POST() {
  return NextResponse.json({
    error: "Server-side rendering requires Remotion Lambda (AWS). Use the in-browser preview and screen-record for now, or set up AWS Lambda for automated exports.",
    alternatives: [
      "Use the in-browser Remotion Player preview",
      "Screen record the preview at full resolution",
      "Set up Remotion Lambda with AWS for automated MP4 export",
    ],
    docs: "https://www.remotion.dev/docs/lambda",
  }, { status: 501 });
}

export async function GET() {
  return NextResponse.json({
    status: "preview-only",
    message: "Video preview available in Press to Premier. Full rendering requires Remotion Lambda.",
  });
}
