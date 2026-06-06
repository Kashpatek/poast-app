#!/usr/bin/env node
// ============================================================================
// SA Brand · Excel sheet → PNG rasterizer
// ============================================================================
// Walks SA_TABLE_REFS_DIR (default: ~/Desktop/SEMIANALYSIS/Brand/) for every
// .xlsx / .xls / .ods file, shells out to LibreOffice headless to convert
// each sheet to a PNG, and copies the resulting images into the Next.js
// public/sa-table-refs/ folder. Filename of each PNG matches the source
// workbook stem (LibreOffice gives one PNG per workbook — the first sheet),
// so the chart-maker-2 gallery can resolve a template-id → png path through
// src/app/charts/lib/sa-table-thumbs.ts.
//
// This script NEVER crashes the build. If `soffice` is not on PATH it prints
// a friendly message and exits 0. The Next.js build does not depend on the
// generated PNGs — they're lazy-loaded by <img> tags in the gallery.
//
// Usage:
//   npm run rasterize-tables
//   SA_TABLE_REFS_DIR=/some/other/dir npm run rasterize-tables
// ============================================================================

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ── config ──────────────────────────────────────────────────────────────────
const HOME = process.env.HOME || process.env.USERPROFILE || "";
const SOURCE_DIR =
  process.env.SA_TABLE_REFS_DIR ||
  path.join(HOME, "Desktop", "SEMIANALYSIS", "Brand");
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(REPO_ROOT, "public", "sa-table-refs");
const EXTS = new Set([".xlsx", ".xls", ".ods"]);

// ── helpers ─────────────────────────────────────────────────────────────────
function findSoffice() {
  // Common install locations on macOS + brew cask, then PATH lookup.
  const candidates = [
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/local/bin/soffice",
    "/opt/homebrew/bin/soffice",
    "soffice",
  ];
  for (const c of candidates) {
    const probe = spawnSync(c, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) return c;
  }
  return null;
}

function walk(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

// Slugify a filename stem to a safe asset key. We preserve case-insensitively
// the recognisable parts of the original name so a human can map them by eye.
function slugify(stem) {
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  console.log("[sa-tables] source:", SOURCE_DIR);
  console.log("[sa-tables] output:", OUT_DIR);

  if (!existsSync(SOURCE_DIR)) {
    console.log("[sa-tables] source directory does not exist — nothing to do.");
    console.log("[sa-tables] set SA_TABLE_REFS_DIR to point at your SA Brand assets.");
    process.exit(0);
  }

  const soffice = findSoffice();
  if (!soffice) {
    console.log("[sa-tables] LibreOffice (soffice) not found on PATH.");
    console.log("[sa-tables] install it and re-run:");
    console.log("[sa-tables]   brew install --cask libreoffice");
    console.log("[sa-tables]   npm run rasterize-tables");
    process.exit(0); // graceful skip — never break the build
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const files = walk(SOURCE_DIR);
  console.log(`[sa-tables] found ${files.length} workbook${files.length === 1 ? "" : "s"}`);

  let generated = 0;
  let skipped = 0;
  const session = "sa-table-refs-" + Date.now();
  const work = path.join(tmpdir(), session);
  mkdirSync(work, { recursive: true });

  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    const slug = slugify(stem);
    if (!slug) { skipped++; continue; }
    const subdir = path.join(work, slug);
    mkdirSync(subdir, { recursive: true });

    const res = spawnSync(
      soffice,
      ["--headless", "--convert-to", "png", "--outdir", subdir, file],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 90_000 },
    );

    if (res.status !== 0) {
      const err = (res.stderr?.toString() || "").trim();
      console.warn(`[sa-tables] FAIL  ${path.basename(file)}${err ? "  · " + err.split("\n")[0] : ""}`);
      skipped++;
      continue;
    }

    let produced = [];
    try { produced = readdirSync(subdir).filter(n => n.toLowerCase().endsWith(".png")); }
    catch { produced = []; }

    if (produced.length === 0) {
      console.warn(`[sa-tables] WARN  ${path.basename(file)}  · no PNG produced`);
      skipped++;
      continue;
    }

    produced.forEach((name, i) => {
      const out =
        produced.length === 1
          ? `${slug}.png`
          : `${slug}-${String(i + 1).padStart(2, "0")}.png`;
      const dest = path.join(OUT_DIR, out);
      copyFileSync(path.join(subdir, name), dest);
      generated++;
      console.log(`[sa-tables] OK    ${path.basename(file)} → ${out}`);
    });
  }

  // best-effort cleanup of the temp working directory
  try { rmSync(work, { recursive: true, force: true }); } catch {}

  console.log("");
  console.log(`[sa-tables] summary · processed=${files.length} · generated=${generated} · skipped=${skipped}`);
  console.log(`[sa-tables] thumbs land in ${path.relative(REPO_ROOT, OUT_DIR)}/`);
  process.exit(0);
}

main();
