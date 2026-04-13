import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.BUFFER_CLIENT_ID;
  const redirectUri = process.env.BUFFER_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "BUFFER_CLIENT_ID and BUFFER_REDIRECT_URI must be set in env vars" },
      { status: 500 }
    );
  }

  const authUrl = `https://bufferapp.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
