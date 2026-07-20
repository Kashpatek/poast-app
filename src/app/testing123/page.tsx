// /testing123 — the "what we're testing in production" hub. Admin-gated in
// proxy.ts. New experiments add a card here + a nested route.
import Link from "next/link";

export const metadata = { title: "Testing · POAST" };

const EXPERIMENTS = [
  {
    href: "/testing123/cover-creator",
    name: "CoverCreator",
    tag: "images",
    blurb:
      "Multi-model cover-image lab — develop one reusable SemiAnalysis article-image style across Grok / Gemini / Midjourney. Design-trends gallery, clashing style-fusions, an inspo wall, and reverse-engineer-from-reference.",
  },
];

export default function TestingHub() {
  return (
    <div style={{ minHeight: "100vh", background: "#0B0B0B", color: "#F3E9D8", padding: "48px 24px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#8a8a8a", textTransform: "uppercase" }}>Testing</div>
        <h1 style={{ fontSize: 26, margin: "6px 0 4px" }}>What we&rsquo;re testing in production</h1>
        <p style={{ color: "#8a8a8a", margin: "0 0 30px", fontSize: 14 }}>Experiments live here while we shape them — not final, and admin-only.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {EXPERIMENTS.map((e) => (
            <Link key={e.href} href={e.href} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 14, padding: 18, height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{e.name}</div>
                  <span style={{ fontSize: 10, color: "#F7B041", border: "1px solid #2a2a2a", borderRadius: 20, padding: "2px 8px" }}>{e.tag}</span>
                </div>
                <div style={{ color: "#8a8a8a", fontSize: 13, lineHeight: 1.5 }}>{e.blurb}</div>
                <div style={{ marginTop: 14, color: "#0C86D1", fontSize: 13 }}>open &rarr;</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
