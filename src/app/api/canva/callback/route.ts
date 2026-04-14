import { NextRequest, NextResponse } from "next/server";

// Canva Connect API - OAuth2 Callback
// Exchanges the authorization code for an access token

const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/?canva_error=" + error, req.nextUrl.origin));
  }

  if (!code) {
    return NextResponse.json({ error: "No authorization code received" }, { status: 400 });
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Canva credentials not configured" }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/canva/callback`;

  try {
    // Exchange code for token
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
      }).toString(),
    });

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.redirect(new URL("/?canva_error=token_exchange_failed", req.nextUrl.origin));
    }

    // Store tokens - in production use a database
    // For now, return them so the user can add to .env
    // The access_token and refresh_token are in data
    const successUrl = new URL("/", req.nextUrl.origin);
    successUrl.searchParams.set("canva_connected", "true");

    // In a real setup, save to database. For now log it.
    console.log("[Canva OAuth] Access token received. Set CANVA_ACCESS_TOKEN in .env.local:");
    console.log("[Canva OAuth] access_token:", data.access_token?.slice(0, 20) + "...");
    console.log("[Canva OAuth] refresh_token:", data.refresh_token?.slice(0, 20) + "...");
    console.log("[Canva OAuth] expires_in:", data.expires_in);

    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    return NextResponse.redirect(new URL("/?canva_error=network_error", req.nextUrl.origin));
  }
}
