// ═══════════════════════════════════════════════════════════════════════════
// Wizard engine · captions .docx builder
//
// VERBATIM extraction of ExportStep.downloadCaptionsDocx (carousel.tsx:
// 2701-2775). The docx Document/Paragraph/TextRun construction is copied
// exactly; only the values the closure captured (selected caption option,
// cover title, source URL, theme, file prefix) are parameterized. The date
// stamp is computed with the same formula as carousel.tsx:2643.
// ═══════════════════════════════════════════════════════════════════════════

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { CaptionOption } from "./types";

export async function buildCaptionsDocx(opts: {
  captionOption: CaptionOption | null | undefined;
  sourceUrl: string;
  articleTitle: string;
  theme: string;
  filePrefix: string;
}): Promise<void> {
  var selectedCap = opts.captionOption;
  if (!selectedCap) return;
  var sourceUrl = opts.sourceUrl;
  var coverTitle = opts.articleTitle;
  var theme = opts.theme;
  var filePrefix = opts.filePrefix;
  // Same formula as carousel.tsx:2643
  var dateStamp = (new Date().getMonth() + 1) + "." + new Date().getDate() + "." + String(new Date().getFullYear()).slice(2);

  var AMBER = "F7B041";
  var BLUE = "0B86D1";
  var BODY = "1A1A1A";
  var FONT = "Outfit";
  var children = [];

  // Title
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { color: AMBER, size: 6, space: 8, style: "single" } },
    children: [new TextRun({ text: coverTitle || "Carousel Captions", bold: true, size: 44, color: AMBER, font: { name: FONT } })],
  }));

  // Metadata
  if (sourceUrl) {
    children.push(new Paragraph({ spacing: { after: 80 }, children: [
      new TextRun({ text: "Source: ", bold: true, size: 22, color: "666666", font: { name: FONT } }),
      new TextRun({ text: sourceUrl, size: 22, color: BLUE, font: { name: FONT } }),
    ]}));
  }
  children.push(new Paragraph({ spacing: { after: 80 }, children: [
    new TextRun({ text: "Date: ", bold: true, size: 22, color: "666666", font: { name: FONT } }),
    new TextRun({ text: dateStamp, size: 22, color: BODY, font: { name: FONT } }),
  ]}));
  children.push(new Paragraph({ spacing: { after: 200 }, children: [
    new TextRun({ text: "Theme: ", bold: true, size: 22, color: "666666", font: { name: FONT } }),
    new TextRun({ text: theme || "general", size: 22, color: BODY, font: { name: FONT } }),
  ]}));

  // Each platform
  var platNames: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", shorts: "YouTube Shorts" };
  ["instagram", "tiktok", "shorts"].forEach(function(key) {
    var data = (selectedCap![key] || {}) as Record<string, unknown>;
    var text = key === "shorts" ? String(data.title || "") : String(data.caption || "");
    if (!text) return;

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 120 },
      children: [new TextRun({ text: platNames[key], bold: true, size: 32, color: BLUE, font: { name: FONT } })],
    }));

    var lines = text.split("\n");
    var runs: TextRun[] = [];
    lines.forEach(function(line: string, idx: number) {
      if (idx > 0) runs.push(new TextRun({ break: 1, text: "", font: { name: "Arial" } }));
      runs.push(new TextRun({ text: line, size: 22, color: BODY, font: { name: FONT } }));
    });
    children.push(new Paragraph({ spacing: { after: 120 }, children: runs }));

    if (key !== "shorts" && data.hashtags && (data.hashtags as string[]).length > 0) {
      children.push(new Paragraph({ spacing: { after: 160 }, children: [
        new TextRun({ text: (data.hashtags as string[]).map(function(t: string) { return "#" + t.replace(/^#/, ""); }).join("  "), size: 20, color: BLUE, font: { name: FONT } }),
      ]}));
    }
  });

  var doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22, color: BODY } } } },
    sections: [{ properties: {}, children: children }],
  });
  return Packer.toBlob(doc).then(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filePrefix + "_captions.docx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
