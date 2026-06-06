"use client";

import React, { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleJsonLd } from "next-seo";
import type { ArticleJsonLdProps } from "next-seo";
import CopyShell, { COPY_SOLID, COPY_GLOW } from "../shell";
import { D, ft, gf, mn, copyText } from "../../shared-constants";
import { Copy as CopyIcon, Code2, Download, Loader2 } from "lucide-react";
import { showToast } from "../../toast-context";

export default function SEOPage() {
  const [ok, setOk] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [siteName, setSiteName] = useState("SemiAnalysis");
  const [author, setAuthor] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("@SemiAnalysis_");
  const [tab, setTab] = useState<"google" | "twitter" | "facebook" | "tags">("google");

  // ─── Auto-fill from URL (metascraper) ───
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch {}
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  async function handleFetch() {
    const u = scrapeUrl.trim();
    if (!u) { showToast("Enter a URL to scrape.", "error"); return; }
    setScraping(true);
    try {
      const r = await fetch("/api/seo-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { showToast(d.error || "Scrape failed.", "error"); return; }
      if (d.title) setTitle(d.title);
      if (d.description) setDesc(d.description);
      if (d.image) setImage(d.image);
      if (d.url) setUrl(d.url);
      showToast("Filled from page metadata.", "success");
    } catch (e) {
      showToast("Network error fetching URL.", "error");
    } finally {
      setScraping(false);
    }
  }

  const titleLen = title.length;
  const descLen = desc.length;

  const tags = useMemo(() => buildTags({ title, desc, url, image, siteName, author, twitterHandle }), [title, desc, url, image, siteName, author, twitterHandle]);
  const jsonLd = useMemo(() => buildJsonLd({ title, desc, url, image, siteName, author }), [title, desc, url, image, siteName, author]);

  if (!ok) return null;

  return (
    <CopyShell title="SEO / Metadata" subtitle="Title, description, OG, Twitter card, JSON-LD. Live previews for what Google, Twitter and Facebook actually show.">
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 18, padding: "20px 28px 40px", maxWidth: 1320, margin: "0 auto" }}>
        {/* LEFT — inputs */}
        <aside style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12, height: "fit-content", position: "sticky", top: 76 }}>
          {/* Auto-fill from URL */}
          <Field label="Auto-fill from URL" sub="metascraper">
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={scrapeUrl}
                onChange={e => setScrapeUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !scraping) { e.preventDefault(); handleFetch(); } }}
                placeholder="https://example.com/article"
                style={inputStyle()}
              />
              <button
                onClick={handleFetch}
                disabled={scraping}
                style={{
                  padding: "0 12px", background: COPY_SOLID + "1F", border: "1px solid " + COPY_SOLID + "55", borderRadius: 7,
                  color: COPY_SOLID, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                  cursor: scraping ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                  opacity: scraping ? 0.65 : 1,
                }}
              >
                {scraping ? <Loader2 size={12} className="spin" /> : <Download size={12} strokeWidth={2} />}
                {scraping ? "Fetching" : "Fetch"}
              </button>
            </div>
          </Field>
          <Field label="Title" sub={charSub(titleLen, 60)}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title (≤ 60 chars sweet spot)" style={inputStyle()} />
          </Field>
          <Field label="Meta description" sub={charSub(descLen, 160)}>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="One-paragraph summary (≤ 160 chars)" style={Object.assign({}, inputStyle(), { minHeight: 80, resize: "vertical", lineHeight: 1.5 })} />
          </Field>
          <Field label="Canonical URL">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://semianalysis.com/p/article-slug" style={inputStyle()} />
          </Field>
          <Field label="OG image URL">
            <input value={image} onChange={e => setImage(e.target.value)} placeholder="https://…/og-card.png  (1200×630)" style={inputStyle()} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Site name">
              <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="SemiAnalysis" style={inputStyle()} />
            </Field>
            <Field label="Author">
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Dylan Patel" style={inputStyle()} />
            </Field>
          </div>
          <Field label="Twitter handle">
            <input value={twitterHandle} onChange={e => setTwitterHandle(e.target.value)} placeholder="@SemiAnalysis_" style={inputStyle()} />
          </Field>
        </aside>

        {/* RIGHT — previews + output */}
        <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 6, padding: 4, background: D.surface, border: "1px solid " + D.border, borderRadius: 8, alignSelf: "flex-start" }}>
            {(["google", "twitter", "facebook", "tags"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "6px 12px", borderRadius: 5, background: tab === t ? COPY_SOLID + "1F" : "transparent", border: "none",
                color: tab === t ? COPY_SOLID : D.txm, cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
              }}>{t === "google" ? "Google" : t === "twitter" ? "X / Twitter" : t === "facebook" ? "Facebook" : "Tags + JSON-LD"}</button>
            ))}
          </div>

          {tab === "google" && (
            <PreviewCard>
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#5f6368", marginBottom: 4 }}>{(siteName || "semianalysis.com")} {url ? "› " + url.replace(/^https?:\/\/[^/]+/, "") : ""}</div>
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 20, color: "#1a0dab", lineHeight: 1.3, marginBottom: 4 }}>{title || "Article title preview"}</div>
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#4d5156", lineHeight: 1.5 }}>{desc || "Meta description preview — the snippet Google shows below the title."}</div>
            </PreviewCard>
          )}

          {tab === "twitter" && (
            <PreviewCard padded={false}>
              {image && <div style={{ aspectRatio: "1200/630", background: "#000", borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="OG" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>}
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12.5, color: "#536471" }}>{url ? url.replace(/^https?:\/\//, "").split("/")[0] : "semianalysis.com"}</div>
                <div style={{ fontFamily: "Arial, sans-serif", fontSize: 15, color: "#0F1419", fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>{title || "Article title preview"}</div>
                <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "#536471", lineHeight: 1.4, marginTop: 2 }}>{desc || "Meta description preview."}</div>
              </div>
            </PreviewCard>
          )}

          {tab === "facebook" && (
            <PreviewCard padded={false}>
              {image && <div style={{ aspectRatio: "1200/630", background: "#000", borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="OG" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>}
              <div style={{ padding: "12px 14px", background: "#F0F2F5" }}>
                <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#65676B", textTransform: "uppercase", letterSpacing: 0.6 }}>{url ? url.replace(/^https?:\/\//, "").split("/")[0] : "semianalysis.com"}</div>
                <div style={{ fontFamily: "Arial, sans-serif", fontSize: 16, color: "#050505", fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>{title || "Article title preview"}</div>
                <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#65676B", lineHeight: 1.4, marginTop: 2 }}>{desc || "Meta description preview."}</div>
              </div>
            </PreviewCard>
          )}

          {tab === "tags" && (
            <>
              <CodeBlock label="<head> tags" code={tags} />
              <CodeBlock label="JSON-LD (Article)" code={jsonLd} />
            </>
          )}
        </main>
      </div>
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        :global(.spin) { animation: spin 0.9s linear infinite; }
      `}</style>
    </CopyShell>
  );
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", marginBottom: 4 }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.6, textTransform: "uppercase" }}>{label}</span>
        {sub && <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 7,
    color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box",
  };
}

function charSub(len: number, target: number): string {
  const remaining = target - len;
  return len + " / " + target + (remaining < 0 ? " · over" : "");
}

function PreviewCard({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: padded ? "16px 18px" : 0, border: "1px solid " + D.border,
      boxShadow: "0 0 22px " + COPY_GLOW,
    }}>{children}</div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid " + D.border, background: "rgba(255,255,255,0.02)" }}>
        <Code2 size={12} color={COPY_SOLID} />
        <span style={{ fontFamily: mn, fontSize: 10, color: D.tx, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
        <button onClick={() => { copyText(code); showToast("Copied.", "success"); }} style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + D.border, color: D.txm, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: mn, fontSize: 9.5, letterSpacing: 0.8, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <CopyIcon size={10} strokeWidth={1.8} /> Copy
        </button>
      </div>
      <pre style={{ margin: 0, padding: "14px 16px", fontFamily: mn, fontSize: 11.5, color: D.tx, lineHeight: 1.55, overflow: "auto", whiteSpace: "pre-wrap" }}>{code}</pre>
    </div>
  );
}

interface MetaArgs {
  title: string; desc: string; url: string; image: string; siteName: string; author: string; twitterHandle: string;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── <head> tag generator ───
// next-seo's <NextSeo> + <ArticleJsonLd> render the same set of <meta> tags
// when used in a real page. There's no exported helper that returns a meta-tag
// string standalone, so we mirror their output here using next-seo's type
// shape to keep us aligned with what they would actually emit.
function buildTags({ title, desc, url, image, siteName, author, twitterHandle }: MetaArgs): string {
  const t = escapeAttr(title || "Untitled");
  const d = escapeAttr(desc || "");
  const u = escapeAttr(url || "");
  const i = escapeAttr(image || "");
  const sn = escapeAttr(siteName || "SemiAnalysis");
  const tw = escapeAttr(twitterHandle || "@SemiAnalysis_");
  const lines = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}">`,
    u ? `<link rel="canonical" href="${u}">` : null,
    author ? `<meta name="author" content="${escapeAttr(author)}">` : null,
    "",
    `<!-- Open Graph -->`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    u ? `<meta property="og:url" content="${u}">` : null,
    `<meta property="og:site_name" content="${sn}">`,
    `<meta property="og:type" content="article">`,
    i ? `<meta property="og:image" content="${i}">` : null,
    i ? `<meta property="og:image:width" content="1200">` : null,
    i ? `<meta property="og:image:height" content="630">` : null,
    "",
    `<!-- Twitter -->`,
    `<meta name="twitter:card" content="${i ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:site" content="${tw}">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    i ? `<meta name="twitter:image" content="${i}">` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

// ─── JSON-LD generator (next-seo) ───
// Build a strongly-typed ArticleJsonLdProps payload, hand it to next-seo's
// <ArticleJsonLd>, render to static markup. The output is exactly the
// <script type="application/ld+json"> that next-seo would emit server-side.
function buildJsonLd({ title, desc, url, image, siteName, author }: Omit<MetaArgs, "twitterHandle">): string {
  const props: ArticleJsonLdProps = {
    type: "Article",
    headline: title || "Untitled",
    datePublished: new Date().toISOString(),
    publisher: { "@type": "Organization", name: siteName || "SemiAnalysis" },
    ...(desc ? { description: desc } : {}),
    ...(url ? { url, mainEntityOfPage: url } : {}),
    ...(image ? { image: [image] } : {}),
    ...(author ? { author: { "@type": "Person", name: author } } : {}),
  };
  try {
    return renderToStaticMarkup(<ArticleJsonLd {...props} />);
  } catch {
    // Fallback in the very unlikely case renderToStaticMarkup throws — keep
    // the code-block populated rather than blanking the UI.
    return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: props.headline }, null, 2)}</script>`;
  }
}

