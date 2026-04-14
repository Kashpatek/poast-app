import { NextRequest, NextResponse } from "next/server";
import { setCanvaTokens } from "../token";

// Canva Connect API - OAuth2 Callback with PKCE
// Exchanges authorization code + code_verifier for access token

const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/?canva_error=" + error, req.nextUrl.origin));
  }

  if (!code) {
    return NextResponse.json({ error: "No authorization code received" }, { status: 400 });
  }

  // Verify state matches
  const savedState = req.cookies.get("canva_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.json({ error: "State mismatch. Possible CSRF attack." }, { status: 400 });
  }

  // Get code_verifier from cookie
  const codeVerifier = req.cookies.get("canva_code_verifier")?.value;
  if (!codeVerifier) {
    return NextResponse.json({ error: "Code verifier not found. Try authorizing again at /api/canva/auth" }, { status: 400 });
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Canva credentials not configured" }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/canva/callback`;

  try {
    const r = await fetch(CANVA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("[Canva OAuth] Token exchange failed:", JSON.stringify(data));
      return NextResponse.json({
        error: "Token exchange failed",
        details: data,
      }, { status: 400 });
    }

    // Store tokens in memory for auto-refresh
    setCanvaTokens(data.access_token, data.refresh_token || null, data.expires_in || 14400);

    console.log("[Canva OAuth] Connected and tokens stored in memory. Auto-refresh enabled.");

    // Redirect home with success indicator
    const response = NextResponse.redirect(new URL("/?canva_connected=true", origin));
    response.cookies.delete("canva_code_verifier");
    response.cookies.delete("canva_state");

    return response;
  } catch (err) {
    console.error("[Canva OAuth] Network error:", err);
    return NextResponse.json({ error: "Network error: " + String(err) }, { status: 500 });
  }
}
