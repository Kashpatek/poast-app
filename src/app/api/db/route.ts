import { type NextRequest } from "next/server";
import { supabase } from "../../lib/supabase";

// Tables the POAST app supports
const VALID_TABLES = [
  "prospects",
  "episodes",
  "archive",
  "trends",
  "outreach",
  "projects",
  "weekly",
] as const;

type ValidTable = (typeof VALID_TABLES)[number];

function isValidTable(table: string): table is ValidTable {
  return VALID_TABLES.includes(table as ValidTable);
}

function notConfiguredResponse() {
  return Response.json(
    {
      error: "Supabase is not configured",
      message:
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file. " +
        "See supabase-schema.sql in the project root for the required database schema.",
    },
    { status: 503 }
  );
}

function invalidTableResponse(table: string) {
  return Response.json(
    {
      error: `Invalid table: "${table}"`,
      validTables: VALID_TABLES,
    },
    { status: 400 }
  );
}

/**
 * GET /api/db?table=prospects         -- fetch all rows from a table
 * GET /api/db?table=prospects&id=xyz  -- fetch a single row by ID
 */
export async function GET(request: NextRequest) {
  if (!supabase) return notConfiguredResponse();

  const searchParams = request.nextUrl.searchParams;
  const table = searchParams.get("table");
  const id = searchParams.get("id");

  if (!table) {
    return Response.json({ error: "Missing required query param: table" }, { status: 400 });
  }

  if (!isValidTable(table)) {
    return invalidTableResponse(table);
  }

  try {
    if (id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
      if (error) return Response.json({ error: error.message }, { status: 404 });
      return Response.json({ data });
    }

    const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "Unexpected error", details: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/db
 * Body: { table: "prospects", data: { ...row } }
 *
 * Upserts the row (inserts if new, updates if the ID already exists).
 */
export async function POST(request: Request) {
  if (!supabase) return notConfiguredResponse();

  let body: { table?: string; data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { table, data } = body;

  if (!table) {
    return Response.json({ error: "Missing required field: table" }, { status: 400 });
  }

  if (!isValidTable(table)) {
    return invalidTableResponse(table);
  }

  if (!data || typeof data !== "object") {
    return Response.json({ error: "Missing or invalid field: data" }, { status: 400 });
  }

  try {
    const { data: result, error } = await supabase
      .from(table)
      .upsert(data, { onConflict: "id" })
      .select();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data: result });
  } catch (err) {
    return Response.json({ error: "Unexpected error", details: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/db
 * Body: { table: "prospects", id: "some-uuid" }
 */
export async function DELETE(request: Request) {
  if (!supabase) return notConfiguredResponse();

  let body: { table?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { table, id } = body;

  if (!table) {
    return Response.json({ error: "Missing required field: table" }, { status: 400 });
  }

  if (!isValidTable(table)) {
    return invalidTableResponse(table);
  }

  if (!id) {
    return Response.json({ error: "Missing required field: id" }, { status: 400 });
  }

  try {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true, deleted: id });
  } catch (err) {
    return Response.json({ error: "Unexpected error", details: String(err) }, { status: 500 });
  }
}
