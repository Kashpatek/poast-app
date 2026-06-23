// Google Calendar integration — server-only OAuth + Calendar API helpers.
//
// Gated entirely behind GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: when those env
// vars are absent isConfigured() is false and every route degrades to a clean
// "not configured" response, so this can ship dark and light up the moment the
// credentials land. Per-user tokens live in the Neon `google_tokens` table.
import { neon } from "@neondatabase/serverless";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export function isConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
function clientId() { return process.env.GOOGLE_CLIENT_ID || ""; }
function clientSecret() { return process.env.GOOGLE_CLIENT_SECRET || ""; }

function sql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ─── OAuth ───
export function buildAuthUrl(redirectUri: string, owner: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",          // force a refresh_token every time
    state: owner,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

interface TokenResponse {
  access_token: string; refresh_token?: string; expires_in: number; scope?: string;
}
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId(), client_secret: clientSecret(),
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Token exchange failed: " + (await res.text()));
  return res.json();
}
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId(), client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed: " + (await res.text()));
  return res.json();
}

// ─── Token store (Neon) ───
export interface TokenRow {
  owner: string; email: string | null; access_token: string | null;
  refresh_token: string | null; expiry: string | null; scope: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calendar_prefs: Record<string, any>;
}
export async function getTokenRow(owner: string): Promise<TokenRow | null> {
  const rows = (await sql().query("select * from google_tokens where owner=$1", [owner])) as TokenRow[];
  return rows[0] || null;
}
export async function saveTokens(owner: string, t: TokenResponse, email?: string | null) {
  const expiry = new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString();
  // Keep the existing refresh_token if Google didn't return a new one.
  await sql().query(
    `insert into google_tokens (owner, email, access_token, refresh_token, expiry, scope, updated_at)
     values ($1,$2,$3,$4,$5,$6, now())
     on conflict (owner) do update set
       email=coalesce(excluded.email, google_tokens.email),
       access_token=excluded.access_token,
       refresh_token=coalesce(excluded.refresh_token, google_tokens.refresh_token),
       expiry=excluded.expiry, scope=excluded.scope, updated_at=now()`,
    [owner, email ?? null, t.access_token, t.refresh_token ?? null, expiry, t.scope ?? null]
  );
}
export async function saveCalendarPrefs(owner: string, prefs: Record<string, unknown>) {
  await sql().query("update google_tokens set calendar_prefs=$1, updated_at=now() where owner=$2", [JSON.stringify(prefs), owner]);
}
export async function disconnect(owner: string) {
  await sql().query("delete from google_tokens where owner=$1", [owner]);
}

// Returns a valid access token for the owner, refreshing if needed. null = not connected.
export async function getValidAccessToken(owner: string): Promise<string | null> {
  const row = await getTokenRow(owner);
  if (!row || !row.access_token) return null;
  const exp = row.expiry ? new Date(row.expiry).getTime() : 0;
  if (Date.now() < exp - 60_000) return row.access_token;
  if (!row.refresh_token) return row.access_token; // best effort
  const t = await refreshAccessToken(row.refresh_token);
  await saveTokens(owner, t, row.email);
  return t.access_token;
}

// ─── Calendar API ───
async function gapi(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`Google API ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchUserEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return j.email || null;
  } catch { return null; }
}

export interface GCalCalendar { id: string; summary: string; primary?: boolean; backgroundColor?: string; accessRole?: string; }
export async function listCalendars(token: string): Promise<GCalCalendar[]> {
  const j = await gapi(token, "/users/me/calendarList?minAccessRole=writer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (j.items || []).map((c: any) => ({ id: c.id, summary: c.summary, primary: c.primary, backgroundColor: c.backgroundColor, accessRole: c.accessRole }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listEvents(token: string, calendarId: string, timeMin: string, timeMax: string): Promise<any[]> {
  const p = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const j = await gapi(token, `/calendars/${encodeURIComponent(calendarId)}/events?${p.toString()}`);
  return j.items || [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertEvent(token: string, calendarId: string, resource: any): Promise<any> {
  return gapi(token, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(resource) });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function patchEvent(token: string, calendarId: string, eventId: string, resource: any): Promise<any> {
  return gapi(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(resource) });
}
