// /api/google/callback · OAuth redirect target. Exchanges the code for tokens,
// stores them per-user, and bounces back into the suite.
import { NextRequest, NextResponse } from "next/server";
import { isConfigured, exchangeCode, fetchUserEmail, saveTokens } from "@/lib/google-cal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (s: string) => NextResponse.redirect(`${origin}/marketing-suite?gcal=${s}`);
  if (!isConfigured()) return back("error");
  const code = req.nextUrl.searchParams.get("code");
  const owner = req.nextUrl.searchParams.get("state") || "shared";
  if (!code) return back("error");
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`;
    const t = await exchangeCode(code, redirectUri);
    const email = await fetchUserEmail(t.access_token);
    await saveTokens(owner, t, email);
    return back("connected");
  } catch {
    return back("error");
  }
}
