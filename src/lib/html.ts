/**
 * Strip HTML tags, scripts, styles and decode common entities to get plain text.
 */
export function stripHTML(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * The article's cover / thumbnail: og:image, twitter:image, or link[rel=image_src].
 * This is the hero image content scrapers usually skip (it lives in <head>, not
 * <img>), so we pull it explicitly and hand it back as the lead image. Returns an
 * absolute http(s) URL or null.
 */
export function extractCoverImage(html: string, baseUrl?: string): string | null {
  const abs = (u: string): string => {
    u = (u || "").trim();
    // Attribute values are HTML-encoded: a resizer URL like ...?w=1200&amp;h=630
    // must decode to a literal & or the browser requests a bogus "amp;h" param
    // (broken/wrong-size cover). Decode the ampersand forms before anything else.
    u = u.replace(/&amp;/gi, "&").replace(/&#0*38;/g, "&").replace(/&#x0*26;/gi, "&");
    if (u.startsWith("//")) return "https:" + u;
    if (u.startsWith("/") && baseUrl) {
      try { return new URL(baseUrl).origin + u; } catch { return u; }
    }
    return u;
  };
  const metaVal = (names: string[]): string | null => {
    for (const n of names) {
      // Attribute order varies: property/name before content, or after.
      const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*?content=["']([^"']+)["']`, "i");
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${n}["']`, "i");
      const m = html.match(re1) || html.match(re2);
      if (m && m[1]) return m[1];
    }
    return null;
  };
  let u = metaVal(["og:image:secure_url", "og:image:url", "og:image", "twitter:image:src", "twitter:image"]);
  if (!u) {
    const m = html.match(/<link[^>]+rel=["']image_src["'][^>]*?href=["']([^"']+)["']/i);
    if (m) u = m[1];
  }
  if (!u) return null;
  u = abs(u);
  return u.startsWith("http") ? u : null;
}

/**
 * Extract image URLs from HTML, filtering out junk (data URIs, SVGs, GIFs,
 * favicons, icons, tracking pixels, etc.). Returns up to `limit` absolute URLs.
 */
export function extractImages(
  html: string,
  baseUrl?: string,
  limit = 20
): string[] {
  const imgRegex =
    /<img[^>]+src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  const results: string[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1];

    // Skip junk
    if (src.startsWith("data:") || src.endsWith(".svg") || src.endsWith(".gif"))
      continue;
    if (
      /favicon|logo|icon|avatar|emoji|badge|button|arrow|spinner|loading|pixel|tracking|1x1|spacer/i.test(
        src
      )
    )
      continue;

    // Skip tiny dimension hints
    const widthMatch =
      src.match(/[?&]w=(\d+)/) ||
      html
        .slice(
          Math.max(0, match.index - 200),
          match.index + match[0].length + 200
        )
        .match(/width[=:]["'\s]*(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 100) continue;

    // Make absolute
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/") && baseUrl) {
      try {
        const u = new URL(baseUrl);
        src = u.origin + src;
      } catch {
        /* ignore bad URL */
      }
    }

    if (src.startsWith("http") && !results.includes(src)) {
      results.push(src);
    }
    if (results.length >= limit) break;
  }

  return results;
}
