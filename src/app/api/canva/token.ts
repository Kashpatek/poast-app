// Canva token management with auto-refresh
// Tokens are stored in memory (resets on cold start) with env var fallback
// On cold start, reads from CANVA_ACCESS_TOKEN / CANVA_REFRESH_TOKEN env vars
// After a refresh, the new tokens live in memory until the next cold start

const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

let memoryTokens: {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number; // unix ms
} = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
};

function getEnvTokens() {
  return {
    accessToken: process.env.CANVA_ACCESS_TOKEN || null,
    refreshToken: process.env.CANVA_REFRESH_TOKEN || null,
  };
}

async function refreshAccessToken(): Promise<string | null> {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const refreshToken = memoryTokens.refreshToken || getEnvTokens().refreshToken;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("[Canva] Cannot refresh: missing client credentials or refresh token");
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

    // Store new tokens in memory
    memoryTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Canva may or may not return a new refresh token
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // Refresh 1 min early
    };

    console.log("[Canva] Token refreshed successfully, expires in", data.expires_in, "seconds");
    return data.access_token;
  } catch (err) {
    console.error("[Canva] Token refresh network error:", err);
    return null;
  }
}

export async function getCanvaAccessToken(): Promise<string | null> {
  // Check memory first
  if (memoryTokens.accessToken && Date.now() < memoryTokens.expiresAt) {
    return memoryTokens.accessToken;
  }

  // Try env var (cold start)
  const env = getEnvTokens();
  if (env.accessToken && !memoryTokens.accessToken) {
    // First request after cold start -- use env token but we don't know when it expires
    // Assume it might be expired, try it, and if it fails we'll refresh
    memoryTokens = {
      accessToken: env.accessToken,
      refreshToken: env.refreshToken,
      expiresAt: Date.now() + 300000, // Assume valid for 5 min, will refresh on 401
    };
    return env.accessToken;
  }

  // Token expired or missing -- try refresh
  if (memoryTokens.refreshToken || env.refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) return newToken;
  }

  return null;
}

// Call this when a Canva API request returns 401 to force a refresh
export async function forceRefreshCanvaToken(): Promise<string | null> {
  memoryTokens.expiresAt = 0; // Force expiry
  return refreshAccessToken();
}

// Store tokens from OAuth callback
export function setCanvaTokens(accessToken: string, refreshToken: string | null, expiresIn: number) {
  memoryTokens = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (expiresIn * 1000) - 60000,
  };
}
