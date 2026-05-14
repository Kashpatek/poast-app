// Tiny Express service that wraps `libreoffice --headless` for the
// DesignStudio /api/design-studio/generate-file flow.
//
// POST /convert
//   body: { url?: string, html?: string, base64?: string, from?: string, to: string }
//   returns: binary stream of converted file (mime per `to`)
//
// LibreOffice CLI is slow to spin up per call (~2-3s). For a tiny team that's
// acceptable; if traffic grows, switch to `unoconv` or run a persistent
// soffice daemon.

const express = require("express");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: "30mb" }));

app.get("/health", (req, res) => res.send("ok"));

app.post("/convert", async (req, res) => {
  const { url, html, base64, from, to } = req.body || {};
  if (!to || typeof to !== "string") {
    return res.status(400).json({ error: "Missing `to` format" });
  }
  if (!url && !html && !base64) {
    return res.status(400).json({ error: "Provide one of url, html, base64" });
  }

  let inputBuf;
  let sourceExt = from || (html ? "html" : "bin");

  try {
    if (url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Fetch source failed: ${r.status}`);
      inputBuf = Buffer.from(await r.arrayBuffer());
      // Try to infer ext from URL.
      const m = url.match(/\.([a-z0-9]{2,5})(\?|$)/i);
      if (m) sourceExt = m[1].toLowerCase();
    } else if (base64) {
      const clean = base64.replace(/^data:[^;]+;base64,/, "");
      inputBuf = Buffer.from(clean, "base64");
    } else {
      inputBuf = Buffer.from(html, "utf8");
      sourceExt = "html";
    }
  } catch (e) {
    return res.status(400).json({ error: "Failed to read source: " + e.message });
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lo-"));
  const inPath = path.join(tmp, `in.${sourceExt}`);
  await fs.writeFile(inPath, inputBuf);

  try {
    await new Promise((resolve, reject) => {
      execFile(
        "libreoffice",
        ["--headless", "--convert-to", to, "--outdir", tmp, inPath],
        { timeout: 120000 },
        (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message));
          resolve(null);
        }
      );
    });
    const outName = path.basename(inPath, path.extname(inPath)) + "." + to;
    const outPath = path.join(tmp, outName);
    if (!fsSync.existsSync(outPath)) {
      throw new Error("LibreOffice did not produce expected output: " + outName);
    }
    const out = await fs.readFile(outPath);
    res.setHeader("Content-Type", mimeFor(to));
    res.setHeader("Content-Length", out.length);
    res.send(out);
  } catch (e) {
    res.status(500).json({ error: "Conversion failed: " + e.message });
  } finally {
    // Best-effort cleanup.
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
});

function mimeFor(ext) {
  switch ((ext || "").toLowerCase()) {
    case "pdf":  return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "html": return "text/html";
    default:     return "application/octet-stream";
  }
}

app.listen(PORT, () => {
  console.log(`libreoffice-headless listening on :${PORT}`);
});
