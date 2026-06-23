// Neon-backed drop-in for @supabase/supabase-js's query builder.
//
// POAST used Supabase purely as Postgres + PostgREST (no Auth/Storage/Realtime).
// This shim exposes the same createClient().from(table).select()/insert()/
// upsert()/update()/delete() chain — but executes SQL against Neon via the
// serverless driver. Every route keeps its exact `.from('<table>')` calls, so
// each data point maps to the same table; only the import path changes.
//
// Returns { data, error } like supabase-js. Covers the methods POAST actually
// uses: select, insert, upsert(onConflict), update, delete, eq, neq, gt(e),
// lt(e), like, ilike, is, in, match, filter, order, limit, single, maybeSingle.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Row = Record<string, unknown>;
type ErrShape = { message: string; code?: string; details?: string; hint?: string };
export interface PgResult {
  // `any` to stay a drop-in for supabase-js's untyped result.data (.map/.field).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: ErrShape | null;
  count?: number | null;
}

let _sql: NeonQueryFunction<false, false> | null = null;
function sqlClient(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  _sql = neon(url);
  return _sql;
}

// Per-table column-type cache (so we coerce jsonb/array values correctly).
const _types: Record<string, Record<string, string>> = {};
async function colTypes(table: string): Promise<Record<string, string>> {
  if (_types[table]) return _types[table];
  const rows = (await sqlClient().query(
    "select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1",
    [table]
  )) as Array<{ column_name: string; data_type: string }>;
  const m: Record<string, string> = {};
  for (const r of rows) m[r.column_name] = r.data_type;
  _types[table] = m;
  return m;
}
function coerce(val: unknown, type?: string): unknown {
  if (val === undefined || val === null) return null;
  if (type === "jsonb" || type === "json") return JSON.stringify(val);
  if (type === "ARRAY") {
    const arr = Array.isArray(val) ? val : [val];
    return "{" + arr.map((x) => '"' + String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"').join(",") + "}";
  }
  return val;
}

const OP: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };

class QueryBuilder implements PromiseLike<PgResult> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private cols = "*";
  private filters: { col: string; op: string; val: unknown }[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private rows: Row[] = [];
  private conflict: string[] = [];
  private singleMode: 0 | 1 | 2 = 0;
  private ret = false;
  private wantCount = false;
  constructor(private table: string) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") { this.cols = cols && cols.trim() && cols !== "*" ? cols : "*"; if (opts?.count) this.wantCount = true; }
    else { this.ret = true; }
    return this;
  }
  insert(values: Row | Row[]) { this.op = "insert"; this.rows = Array.isArray(values) ? values : [values]; return this; }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) { this.op = "upsert"; this.rows = Array.isArray(values) ? values : [values]; if (opts?.onConflict) this.conflict = opts.onConflict.split(",").map((s) => s.trim()); return this; }
  update(patch: Row) { this.op = "update"; this.rows = [patch]; return this; }
  delete() { this.op = "delete"; return this; }

  eq(c: string, v: unknown) { this.filters.push({ col: c, op: "eq", val: v }); return this; }
  neq(c: string, v: unknown) { this.filters.push({ col: c, op: "neq", val: v }); return this; }
  gt(c: string, v: unknown) { this.filters.push({ col: c, op: "gt", val: v }); return this; }
  gte(c: string, v: unknown) { this.filters.push({ col: c, op: "gte", val: v }); return this; }
  lt(c: string, v: unknown) { this.filters.push({ col: c, op: "lt", val: v }); return this; }
  lte(c: string, v: unknown) { this.filters.push({ col: c, op: "lte", val: v }); return this; }
  like(c: string, v: unknown) { this.filters.push({ col: c, op: "like", val: v }); return this; }
  ilike(c: string, v: unknown) { this.filters.push({ col: c, op: "ilike", val: v }); return this; }
  is(c: string, v: unknown) { this.filters.push({ col: c, op: "is", val: v }); return this; }
  in(c: string, v: unknown[]) { this.filters.push({ col: c, op: "in", val: v }); return this; }
  match(obj: Row) { for (const k of Object.keys(obj)) this.filters.push({ col: k, op: "eq", val: obj[k] }); return this; }
  filter(c: string, op: string, v: unknown) { this.filters.push({ col: c, op, val: v }); return this; }
  order(c: string, opts?: { ascending?: boolean }) { this.orders.push({ col: c, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }

  private whereSQL(params: unknown[]): string {
    if (!this.filters.length) return "";
    const parts = this.filters.map((f) => {
      const id = `"${f.col}"`;
      if (f.op === "is") return `${id} is ${f.val === null ? "null" : f.val === true ? "true" : f.val === false ? "false" : "null"}`;
      if (f.op === "in") { const a = (f.val as unknown[]) || []; if (!a.length) return "false"; const ph = a.map((v) => { params.push(v); return "$" + params.length; }).join(","); return `${id} in (${ph})`; }
      params.push(f.val); return `${id} ${OP[f.op] || "="} $${params.length}`;
    });
    return " where " + parts.join(" and ");
  }

  private async exec(): Promise<PgResult> {
    try {
      const c = sqlClient();
      const params: unknown[] = [];
      if (this.op === "select") {
        let text = `select ${this.cols} from "${this.table}"` + this.whereSQL(params);
        if (this.orders.length) text += " order by " + this.orders.map((o) => `"${o.col}" ${o.asc ? "asc" : "desc"}`).join(", ");
        if (this.limitN != null) text += ` limit ${this.limitN}`;
        else if (this.singleMode) text += " limit 2";
        const rows = (await c.query(text, params)) as Row[];
        if (this.singleMode === 1) {
          if (rows.length !== 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
          return { data: rows[0], error: null };
        }
        if (this.singleMode === 2) return { data: rows.length ? rows[0] : null, error: null };
        return { data: rows, error: null, count: this.wantCount ? rows.length : null };
      }
      if (this.op === "delete") {
        let text = `delete from "${this.table}"` + this.whereSQL(params);
        if (this.ret) text += " returning *";
        const rows = (await c.query(text, params)) as Row[];
        return { data: this.ret ? rows : null, error: null };
      }
      const types = await colTypes(this.table);
      if (this.op === "update") {
        const patch = this.rows[0] || {};
        const sets = Object.keys(patch).map((k) => { params.push(coerce(patch[k], types[k])); return `"${k}" = $${params.length}`; });
        let text = `update "${this.table}" set ${sets.join(", ")}` + this.whereSQL(params);
        if (this.ret) text += " returning *";
        const rows = (await c.query(text, params)) as Row[];
        return { data: this.ret ? rows : null, error: null };
      }
      // insert / upsert
      const cols = Array.from(new Set(this.rows.flatMap((r) => Object.keys(r))));
      const tuples = this.rows.map((r) => "(" + cols.map((col) => { params.push(coerce(r[col], types[col])); return "$" + params.length; }).join(",") + ")").join(", ");
      let text = `insert into "${this.table}" (${cols.map((x) => `"${x}"`).join(",")}) values ${tuples}`;
      if (this.op === "upsert") {
        const keys = this.conflict.length ? this.conflict : ["id"];
        const upd = cols.filter((x) => !keys.includes(x)).map((x) => `"${x}" = excluded."${x}"`);
        text += ` on conflict (${keys.map((x) => `"${x}"`).join(",")}) do ${upd.length ? `update set ${upd.join(", ")}` : "nothing"}`;
      }
      if (this.ret) text += " returning *";
      const rows = (await c.query(text, params)) as Row[];
      return { data: this.ret ? rows : null, error: null };
    } catch (e) {
      const err = e as { message?: string; code?: string; detail?: string; hint?: string };
      return { data: null, error: { message: err?.message || String(e), code: err?.code, details: err?.detail, hint: err?.hint } };
    }
  }

  // single()/maybeSingle() return a thenable resolving to the shaped result.
  single() { this.singleMode = 1; return this; }
  maybeSingle() { this.singleMode = 2; return this; }

  then<R1 = PgResult, R2 = never>(onF?: ((v: PgResult) => R1 | PromiseLike<R1>) | null, onR?: ((r: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return this.exec().then(onF, onR);
  }
}

class NeonClient {
  from(table: string) { return new QueryBuilder(table); }
}

export function createClient(_url?: string, _key?: string, _opts?: unknown): NeonClient {
  return new NeonClient();
}
export type SupabaseClient = NeonClient;
