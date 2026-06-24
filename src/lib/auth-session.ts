// Google sign-in session — server-only OAuth identity + signed session cookie.
//
// This is the FRONT-DOOR gate: it verifies the visitor owns a real
// @semianalysis.com Google account, then issues a signed `poast_session`
// cookie. It deliberately does NOT add per-API authorization — the app's API
// routes stay client-trusted exactly as before (identity is already kept in
// localStorage `poast-current-user`). The cookie answers "who walked through
// the door," not "is this individual API call authorized."
//
// Reuses the OAuth token exchange from google-cal.ts (same GOOGLE_CLIENT_ID/
// SECRET, a shared OAuth client can serve multiple redirect URIs + scope sets)
// but keeps sign-in concerns separate: narrow `openid email profile` scopes, a
// dedicated callback, and NO writes to the calendar `google_tokens` table.
//
// Env:
//   POAST_SESSION_SECRET   HMAC secret for the session cookie. REQUIRED in prod
//                          (fail-closed); a dev fallback applies only off-prod.
//   POAST_ALLOWED_DOMAIN   email domain allowed to sign in (default semianalysis.com)
//   POAST_DEV_AUTH=1       local-only: enables /api/auth/google/start?dev=<email>
//                          to mint a session without Google (never honored in prod)
import { exchangeCode } from "./google-cal";

export const SESSION_COOKIE = "poast_session";
export const NONCE_COOKIE = "poast_oauth_nonce";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (seconds)
const NONCE_MAX_AGE = 600; // 10 minutes (seconds)

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

// Only sign-in plumbing depends on this — the calendar flow has its own helpers.
export { exchangeCode };

// ─── environment ───
// "Real deployment" = NODE_ENV==="production". Local `next dev` is always
// "development", so this stays false locally EVEN IF a pulled .env.local leaked
// VERCEL_ENV=production. A built/deployed app (incl. Vercel preview) is
// "production" → dev-mint blocked, secure cookies, session secret required.
// (Keying on VERCEL_ENV would wrongly enable dev-mint on a public preview.)
export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}
// Dev sign-in is opt-in AND off-prod — never inferred from "Google not configured"
// (a transient prod misconfig must not silently turn login into "type any email").
export function devAuthEnabled(): boolean {
  return process.env.POAST_DEV_AUTH === "1" && !isProd();
}
export function isConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function allowedDomain(): string {
  return (process.env.POAST_ALLOWED_DOMAIN || "semianalysis.com").trim().toLowerCase();
}

const DEV_SECRET = "poast-dev-session-secret-not-for-production-use-only";
// Fail-closed in prod: a missing secret must break minting/verifying (so routes
// degrade to "unconfigured") rather than fall back to a publicly-known string
// that anyone could use to forge {email:"akash@semianalysis.com"}.
function sessionSecret(): string {
  const s = process.env.POAST_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (isProd()) throw new Error("POAST_SESSION_SECRET is required in production");
  return DEV_SECRET;
}

// ─── domain enforcement ───
// Parse the domain off the LAST '@' and compare exactly — `endsWith("...com")`
// is bypassable (attacker@evil-semianalysis.com).
export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).trim().toLowerCase();
}
export function emailAllowed(email: string): boolean {
  const d = domainOf(email);
  return !!d && d === allowedDomain();
}

// ─── signed session token (HMAC-SHA256, base64url(payload).base64url(sig)) ───
export interface SessionPayload { email: string; name: string; iat: number; exp: number }

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  return Buffer.from(u8).toString("base64url");
}
// Decode base64url into a FRESH ArrayBuffer-backed Uint8Array (a raw Buffer is
// typed over ArrayBufferLike, which crypto.subtle won't accept as BufferSource).
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b = Buffer.from(s, "base64url");
  const u8 = new Uint8Array(new ArrayBuffer(b.byteLength));
  u8.set(b);
  return u8;
}
async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export async function signSession(p: SessionPayload): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(p));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), payload);
  return b64url(payload) + "." + b64url(sig);
}

// Mint a 30-day session for a verified identity.
export async function mintSession(email: string, name: string): Promise<string> {
  const now = Date.now();
  return signSession({ email, name, iat: now, exp: now + SESSION_MAX_AGE * 1000 });
}

// Verify signature (constant-time via subtle.verify) + expiry. null = invalid.
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;
  let payloadBytes: Uint8Array<ArrayBuffer>, sigBytes: Uint8Array<ArrayBuffer>;
  try {
    payloadBytes = fromB64url(payloadPart);
    sigBytes = fromB64url(sigPart);
  } catch { return null; }
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(), sigBytes, payloadBytes); }
  catch { return null; }
  if (!ok) return null;
  let payload: SessionPayload;
  try { payload = JSON.parse(new TextDecoder().decode(payloadBytes)); } catch { return null; }
  if (!payload || typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  if (!payload.email || !emailAllowed(payload.email)) return null; // domain can tighten later
  return payload;
}

// ─── CSRF nonce (double-submit: cookie value must equal the `state` param) ───
export function newNonce(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

// ─── cookie option helpers (consistent flags across routes) ───
export function sessionCookieOptions() {
  return { httpOnly: true, secure: isProd(), sameSite: "lax" as const, path: "/", maxAge: SESSION_MAX_AGE };
}
export function nonceCookieOptions() {
  return { httpOnly: true, secure: isProd(), sameSite: "lax" as const, path: "/", maxAge: NONCE_MAX_AGE };
}
export function clearedCookieOptions() {
  return { httpOnly: true, secure: isProd(), sameSite: "lax" as const, path: "/", maxAge: 0 };
}

// ─── OAuth: sign-in authorization URL (narrow scopes; hd is a hint only) ───
export function buildSignInAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    hd: allowedDomain(),
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

// userinfo with the fields sign-in needs (email + verified flag + display name).
// A SIBLING of google-cal's fetchUserEmail (which the calendar callback uses) —
// kept separate so the calendar path's signature is never touched.
export interface GoogleUserInfo { email: string; verified_email: boolean; name: string }
export async function fetchUserInfo(token: string): Promise<GoogleUserInfo | null> {
  try {
    const res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return { email: (j.email || "").toLowerCase(), verified_email: !!j.verified_email, name: j.name || j.given_name || "" };
  } catch { return null; }
}
