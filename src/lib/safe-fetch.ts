// SSRF guard for server-side fetches of request-supplied URLs.
//
// Several routes fetch a URL that comes straight from the client (image-proxy,
// seo-scrape, rss-feed, distribution-pack, the design-studio image ingests,
// etc.). Unguarded, a signed-in user can point those at internal targets —
// `http://localhost:PORT/api/...`, the cloud metadata endpoint
// (169.254.169.254), private RFC-1918 hosts — and read the response (or have it
// reflected through an AI/error path). Verified live before this fix.
//
// Defense, in order of strength:
//   1. Scheme allowlist (http/https only) — no file:, gopher:, data:, etc.
//   2. Reject literal internal IP hosts up front (fast path).
//   3. Pin the connection to a VALIDATED public IP at CONNECT time via a custom
//      undici lookup. Because every connection — including each redirect hop —
//      goes through this lookup, it also defeats redirect-to-internal AND DNS
//      rebinding (the address the socket connects to is the one we checked).
//   4. Bounded redirects + a request timeout.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export class SsrfBlockedError extends Error {
  constructor(msg: string) { super(msg); this.name = "SsrfBlockedError"; }
}

// ─── IP range classification ───
function ipToLong(ip: string): number {
  const p = ip.split(".");
  if (p.length !== 4) return -1;
  let n = 0;
  for (const oct of p) {
    const v = Number(oct);
    if (!Number.isInteger(v) || v < 0 || v > 255) return -1;
    n = n * 256 + v;
  }
  return n >>> 0;
}
function inV4(ip: string, cidr: string): boolean {
  const [net, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const a = ipToLong(ip), b = ipToLong(net);
  if (a < 0 || b < 0) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}
// Non-public IPv4: loopback, private, link-local (incl. cloud metadata),
// CGNAT, broadcast, benchmarking, TEST-NETs, multicast, reserved.
const V4_BLOCKED = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24",
  "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24",
  "224.0.0.0/4", "240.0.0.0/4", "255.255.255.255/32",
];
function v4Blocked(ip: string): boolean { return V4_BLOCKED.some((c) => inV4(ip, c)); }

function v6Blocked(raw: string): boolean {
  const ip = raw.toLowerCase().split("%")[0]; // strip zone id
  if (ip === "::1" || ip === "::" || ip === "::0") return true;      // loopback / unspecified
  // IPv4-mapped/-compatible → validate the embedded v4. Two forms reach us: the
  // dotted tail (::ffff:127.0.0.1) and — because the WHATWG URL parser
  // normalizes it — the compressed hex tail (::ffff:7f00:1).
  const dotted = ip.match(/((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) return v4Blocked(dotted[1]);
  const mapped = ip.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
    return v4Blocked(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
  }
  if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true; // fe80::/10 link-local
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;       // fc00::/7 unique-local
  if (ip.startsWith("ff")) return true;                              // ff00::/8 multicast
  if (ip.startsWith("2001:db8")) return true;                        // documentation
  if (ip.startsWith("64:ff9b")) return true;                         // NAT64 (maps to v4 space)
  return false;
}

export function addrIsBlocked(address: string, family?: number): boolean {
  const fam = family || (isIP(address) as 0 | 4 | 6) || 4;
  return fam === 6 ? v6Blocked(address) : v4Blocked(address);
}

// ─── URL-shape validation (sync, no DNS) ───
export function assertAllowedUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new SsrfBlockedError("invalid URL"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SsrfBlockedError(`scheme not allowed: ${u.protocol}`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, ""); // unwrap [::1]
  if (!host) throw new SsrfBlockedError("empty host");
  if (host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost")) {
    throw new SsrfBlockedError("localhost blocked");
  }
  // Literal-IP hosts are checked synchronously here; DNS names are checked at
  // connect time by the guarded lookup below.
  const ipFam = isIP(host);
  if (ipFam && addrIsBlocked(host, ipFam)) throw new SsrfBlockedError(`internal IP blocked: ${host}`);
  return u;
}

// ─── connect-time DNS validation + pinning ───
type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
function guardedLookup(hostname: string, options: unknown, callback?: LookupCb): void {
  const cb = (typeof options === "function" ? options : callback) as LookupCb;
  const opts = (typeof options === "function" ? {} : (options || {})) as { all?: boolean };
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return cb(err);
    const list = (Array.isArray(addresses) ? addresses : [addresses]) as LookupAddress[];
    const allowed = list.filter((a) => !addrIsBlocked(a.address, a.family));
    if (!allowed.length) {
      return cb(new SsrfBlockedError(`blocked host ${hostname} → ${list.map((a) => a.address).join(",")}`) as NodeJS.ErrnoException);
    }
    if (opts.all) return cb(null, allowed);
    return cb(null, allowed[0].address, allowed[0].family);
  });
}

// One shared dispatcher: every socket it opens (initial + redirect hops) is
// validated + pinned by guardedLookup.
const guardedAgent = new Agent({
  connect: { lookup: guardedLookup as unknown as LookupFunction, timeout: 10_000 },
  headersTimeout: 15_000,
  bodyTimeout: 20_000,
});

export interface SafeFetchOpts { timeoutMs?: number; maxRedirects?: number; }

// Drop-in for fetch() for request-supplied URLs. Validates the URL shape, then
// fetches via undici's fetch through the guarded dispatcher so internal targets
// can't be reached even via redirect or DNS rebinding. We call undici directly
// (not Next's cache-wrapped global fetch) so the dispatcher is guaranteed to be
// honored and these proxy fetches never enter the data cache. The returned
// undici Response is structurally the WHATWG Response the routes expect
// (.ok/.status/.text()/.arrayBuffer()/.headers.get()). Throws SsrfBlockedError
// on a blocked URL.
export async function safeFetch(raw: string, init: RequestInit = {}, opts: SafeFetchOpts = {}): Promise<Response> {
  assertAllowedUrl(raw);
  const timeout = opts.timeoutMs ?? 15_000;
  const signal = init.signal ?? AbortSignal.timeout(timeout);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await undiciFetch(raw, { redirect: "follow", ...(init as any), signal: signal as any, dispatcher: guardedAgent });
  return res as unknown as Response;
}
