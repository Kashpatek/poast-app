import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Canva Connect API - OAuth2 with PKCE
// Canva requires code_challenge (S256) on auth, code_verifier on token exchange

const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(req: NextRequest) {
  const clientId = process.env.CANVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "CANVA_CLIENT_ID not configured" }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/canva/callback`;
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "design:content:read design:content:write design:meta:read asset:read asset:write brandtemplate:content:read brandtemplate:meta:read",
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  const authUrl = `${CANVA_AUTH_URL}?${params.toString()}`;

  // Store code_verifier and state in cookies so callback can use them
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("canva_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });
  response.cookies.set("canva_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
