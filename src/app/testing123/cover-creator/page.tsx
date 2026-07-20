// CoverCreator, mounted full-bleed via iframe so the standalone studio's styles
// stay fully isolated from POAST's. The studio is served from public/cover-lab/
// and talks to /api/cover/* (admin-gated in proxy.ts).
export const metadata = { title: "CoverCreator · Testing" };

export default function CoverCreatorPage() {
  return (
    <iframe
      src="/cover-lab/studio.html"
      title="CoverCreator"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0, background: "#0B0B0B" }}
    />
  );
}
