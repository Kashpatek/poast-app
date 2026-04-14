// Canva token management for serverless (cookie-based persistence)
// Tokens are stored in httpOnly cookies so they survive across function instances
// Auto-refreshes when access token expires

import { cookies } from "next/headers";

const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const COOKIE_ACCESS = "canva_at";
const COOKIE_REFRESH = "canva_rt";
const COOKIE_EXPIRES = "canva_exp";

export async function getCanvaAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();

  // Check cookie first
  const accessToken = cookieStore.get(COOKIE_ACCESS)?.value;
  const expiresAt = parseInt(cookieStore.get(COOKIE_EXPIRES)?.value || "0");

  if (accessToken && Date.now() < expiresAt) {
    return accessToken;
  }

  // Token expired or missing -- try refresh
  const refreshToken = cookieStore.get(COOKIE_REFRESH)?.value || process.env.CANVA_REFRESH_TOKEN;
  if (refreshToken) {
    const result = await refreshAccessToken(refreshToken);
    if (result) return result.accessToken;
  }

  // Fall back to env var (might be expired but worth trying)
  const envToken = process.env.CANVA_ACCESS_TOKEN;
  if (envToken) return envToken;

  return null;
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Canva] Cannot refresh: missing client credentials");
    return null;
  }

  try {
    const r = await fetch(CANVA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("[Canva] Token refresh failed:", JSON.stringify(data));
      return null;
    }

    console.log("[Canva] Token refreshed, expires in", data.expires_in, "seconds");

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in || 14400,
    };
  } catch (err) {
    console.error("[Canva] Token refresh error:", err);
    return null;
  }
}

export async function forceRefreshCanvaToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_REFRESH)?.value || process.env.CANVA_REFRESH_TOKEN;

  if (!refreshToken) return null;

  const result = await refreshAccessToken(refreshToken);
  if (result) {
    setCanvaTokenCookies(result.accessToken, result.refreshToken, result.expiresIn);
    return result.accessToken;
  }
  return null;
}

export function setCanvaTokenCookies(accessToken: string, refreshToken: string | null, expiresIn: number) {
  // This is called from route handlers that can set cookies on the response
  // We use a different approach -- return the cookie values to be set by the caller
}

// Helper for route handlers to set cookies on a NextResponse
export function applyCanvaTokens(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } },
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number
) {
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

  response.cookies.set(COOKIE_ACCESS, accessToken, { ...opts, maxAge: expiresIn });
  if (refreshToken) {
    response.cookies.set(COOKIE_REFRESH, refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 30 }); // 30 days
  }
  response.cookies.set(COOKIE_EXPIRES, String(Date.now() + (expiresIn * 1000) - 60000), { ...opts, maxAge: expiresIn });
}
