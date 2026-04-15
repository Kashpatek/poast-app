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
