import { NextRequest, NextResponse } from "next/server";

// Canva Connect API - OAuth2 Authorization
// Initiates the OAuth flow to get an access token
// User visits this endpoint to authorize, gets redirected back with a code

const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

// GET: Start OAuth flow (redirect user to Canva)
export async function GET(req: NextRequest) {
  const clientId = process.env.CANVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "CANVA_CLIENT_ID not configured" }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/canva/callback`;
  const state = Math.random().toString(36).slice(2);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "design:content:read design:content:write design:meta:read asset:read asset:write brandtemplate:content:read brandtemplate:meta:read",
    state,
  });

  return NextResponse.redirect(`${CANVA_AUTH_URL}?${params.toString()}`);
}
