// /api/auth/me · who is signed in (verified poast_session cookie). The client
// derives the canonical POAST user from this email via its email→user map.
import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!p) return NextResponse.json({ signedIn: false });
  return NextResponse.json({ signedIn: true, email: p.email, name: p.name });
}
