// /api/marketing · CRUD for the MarketingSUITE spine (campaigns + events).
//
// Mirrors the /api/studio pattern: a service-role-first Supabase client so
// writes bypass RLS, light zod validation, and full PostgREST errors surfaced
// to the client. Two tables (marketing_campaigns, marketing_events) created by
// supabase/migrations/0003_marketing_spine.sql. If the tables don't exist yet
// (migration not applied) or the project is egress-restricted, GET returns an
// error and the client falls back to local demo data — the suite stays usable.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/neon-db";
import { z } from "zod";

export const dynamic = "force-dynamic";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;
  if (!url || !key) return null;
  _supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _supabase;
}

const EVENTS = "marketing_events";
const CAMPAIGNS = "marketing_campaigns";

// camelCase <-> snake_case row mappers.
type Row = Record<string, unknown>;
function eventFromRow(r: Row) {
  return {
    id: r.id, title: r.title, type: r.event_type, status: r.status,
    start: r.starts_at, end: r.ends_at, campaignId: r.campaign_id,
    channel: r.channel, source: r.source, gcalEventId: r.gcal_event_id,
    notes: r.notes, payload: r.payload || {},
  };
}
function campaignFromRow(r: Row) {
  return {
    id: r.id, name: r.name, color: r.color, status: r.status, goal: r.goal,
    start: r.starts_at, end: r.ends_at, series: Array.isArray(r.series) ? r.series : [],
    payload: r.payload || {},
  };
}

const EventSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  type: z.string().max(40).default("manual"),
  status: z.enum(["idea", "draft", "scheduled", "live", "done", "blocked"]).default("idea"),
  start: z.string(),
  end: z.string().optional().nullable(),
  campaignId: z.string().max(80).optional().nullable(),
  channel: z.string().max(40).optional().nullable(),
  source: z.enum(["manual", "buffer", "poast", "brianna", "gcal"]).default("manual"),
  gcalEventId: z.string().max(200).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  payload: z.unknown().optional(),
});

const CampaignSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  color: z.string().max(40).optional().nullable(),
  status: z.enum(["planning", "active", "wrapping", "done"]).default("planning"),
  goal: z.string().max(2000).optional().nullable(),
  start: z.string().optional().nullable(),
  end: z.string().optional().nullable(),
  series: z.array(z.unknown()).max(200).default([]),
  payload: z.unknown().optional(),
});

const PostSchema = z.union([
  z.object({ kind: z.literal("event"), data: EventSchema }),
  z.object({ kind: z.literal("campaign"), data: CampaignSchema }),
]);

const DeleteSchema = z.object({
  kind: z.enum(["event", "campaign"]),
  id: z.string().min(1).max(80),
});

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  try {
    const [ev, ca] = await Promise.all([
      supabase.from(EVENTS).select("*").order("starts_at", { ascending: true }).limit(2000),
      supabase.from(CAMPAIGNS).select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (ev.error) return NextResponse.json({ error: ev.error.message }, { status: 500 });
    if (ca.error) return NextResponse.json({ error: ca.error.message }, { status: 500 });
    return NextResponse.json({
      events: (ev.data || []).map((r: Row) => eventFromRow(r)),
      campaigns: (ca.data || []).map((r: Row) => campaignFromRow(r)),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }
  const now = new Date().toISOString();
  try {
    if (parsed.data.kind === "event") {
      const d = parsed.data.data;
      const row: Row = {
        id: d.id, title: d.title, event_type: d.type, status: d.status,
        starts_at: d.start, ends_at: d.end ?? null, campaign_id: d.campaignId ?? null,
        channel: d.channel ?? null, source: d.source, gcal_event_id: d.gcalEventId ?? null,
        notes: d.notes ?? null, payload: d.payload ?? {}, updated_at: now,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.from(EVENTS).upsert(row as any, { onConflict: "id" }).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: (data || []).map((r: Row) => eventFromRow(r)) });
    } else {
      const d = parsed.data.data;
      const row: Row = {
        id: d.id, name: d.name, color: d.color ?? null, status: d.status, goal: d.goal ?? null,
        starts_at: d.start ?? null, ends_at: d.end ?? null, series: d.series ?? [],
        payload: d.payload ?? {}, updated_at: now,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.from(CAMPAIGNS).upsert(row as any, { onConflict: "id" }).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: (data || []).map((r: Row) => campaignFromRow(r)) });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }
  try {
    const table = parsed.data.kind === "event" ? EVENTS : CAMPAIGNS;
    const { error } = await supabase.from(table).delete().eq("id", parsed.data.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
