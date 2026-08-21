// ─── Caption sanitizer ────────────────────────────────────────────────────
// The caption models occasionally leak markdown into the caption *content*
// (headings like "###", **bold**, bullet dashes) even when told to return plain
// JSON — the JSON-fence strippers only touch the outer envelope, not the string
// values. This strips markdown syntax from caption text before it is stored,
// displayed, or copied. Plain-text only: it removes the SYNTAX, keeps the words.

export function stripCaptionMarkdown(input: string): string {
  if (!input) return input;
  let t = String(input);
  // Fenced code blocks → drop the fences (keep any inner text)
  t = t.replace(/```[a-zA-Z0-9]*\n?/g, "");
  // ATX headings: leading #, ##, ### … at the start of a line
  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  // Blockquote markers at line start
  t = t.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
  // Bullet list markers (-, *, +) at line start
  t = t.replace(/^[ \t]{0,3}[-*+][ \t]+/gm, "");
  // Numbered list markers (1. 2. …) at line start
  t = t.replace(/^[ \t]{0,3}\d+\.[ \t]+/gm, "");
  // Markdown links [text](url) → text
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Bold / italic wrappers **x** __x__ *x* _x_ → x
  t = t.replace(/(\*\*|__)(.+?)\1/g, "$2");
  t = t.replace(/(^|[^A-Za-z0-9])[*_](\S(?:.*?\S)?)[*_]([^A-Za-z0-9]|$)/g, "$1$2$3");
  // Inline code `x` → x
  t = t.replace(/`([^`]+)`/g, "$1");
  // Any stray runs of ## left over anywhere
  t = t.replace(/#{2,}/g, "");
  // Horizontal rules on their own line
  t = t.replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");
  // Collapse 3+ blank lines to a single blank line, trim edges
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

type CaptionPlat = { caption?: string; title?: string; hashtags?: string[]; [k: string]: unknown };
type CaptionOpt = { label?: string; instagram?: CaptionPlat; tiktok?: CaptionPlat; shorts?: CaptionPlat; [k: string]: unknown };

/** Strip markdown from every platform caption/title in a CaptionOption[]. */
export function cleanCaptionOptions<T>(options: T): T {
  if (!Array.isArray(options)) return options;
  return (options as CaptionOpt[]).map(function (o) {
    if (!o || typeof o !== "object") return o;
    const out: CaptionOpt = { ...o };
    (["instagram", "tiktok", "shorts"] as const).forEach(function (plat) {
      const p = out[plat];
      if (p && typeof p === "object") {
        const pp: CaptionPlat = { ...p };
        if (typeof pp.caption === "string") pp.caption = stripCaptionMarkdown(pp.caption);
        if (typeof pp.title === "string") pp.title = stripCaptionMarkdown(pp.title);
        out[plat] = pp;
      }
    });
    return out;
  }) as unknown as T;
}
